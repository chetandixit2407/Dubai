import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'crypto';
import { INITIAL_PROJECTS } from '../src/data/uaeCatalog.ts';
import {
  AdvisorLanguagePreference,
  AdvisorResolvedLanguage,
  CurrencyCode,
  Project,
} from '../src/types/realEstate.ts';
import { CURRENCY_RATES_FROM_AED, EXCHANGE_RATE_UPDATED_AT } from '../src/utils/currency.ts';
import { formatPropertyBhk } from '../src/utils/propertySpecs.ts';
import { getFirebaseRuntimeConfig } from './firebaseConfig.ts';
import { logServerError, logServerEvent } from './logger.ts';

export type AdvisorCurrency = CurrencyCode;
export type AdvisorLanguageMode = AdvisorLanguagePreference;
export type { AdvisorResolvedLanguage };

export type AdvisorPurpose =
  | ''
  | 'Investment'
  | 'Personal living'
  | 'Rental income'
  | 'Capital appreciation';

export interface AdvisorPreferences {
  minBudget?: number | null;
  maxBudget?: number | null;
  currency?: AdvisorCurrency;
  location?: string;
  propertyType?: string;
  purpose?: AdvisorPurpose;
}

export interface AdvisorHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AdvisorRequestBody {
  message?: string;
  preferences?: AdvisorPreferences;
  history?: AdvisorHistoryMessage[];
  previousProjectIds?: string[];
  language?: AdvisorLanguageMode;
}

export interface FxRatesSnapshot {
  base: 'AED';
  ratesFromAed: Record<AdvisorCurrency, number>;
  lastUpdatedAt: string;
  source: string;
  isFallback: boolean;
}

export interface AdvisorRecommendationCard {
  id: string;
  slug: string;
  name: string;
  developerName: string;
  heroImage: string;
  community: string;
  emirate: string;
  startingPriceAed: number;
  maxPriceAed: number;
  startingPriceSelected: number;
  formattedStartingPriceAed: string;
  formattedStartingPriceSelected: string;
  currency: AdvisorCurrency;
  isEstimatedConversion: boolean;
  propertyTypes: string[];
  bedroomOptions: string;
  paymentPlan: string;
  handoverDate: string;
  verifiedGrossYieldPct: number | null;
  verifiedNetYieldPct: number | null;
  estimatedAppreciationPct: number | null;
  category: string;
  status: string;
  matchType: 'exact' | 'alternative';
  matchReason: string;
  availableUnits: number | null;
  inventoryStatus: string;
}

export interface AdvisorResponsePayload {
  ok: boolean;
  reply: string;
  aiStatus: 'ok' | 'cached' | 'unavailable';
  aiNotice?: string;
  recommendations: AdvisorRecommendationCard[];
  hasExactMatches: boolean;
  detectedLanguage: AdvisorResolvedLanguage;
  fxInfo: {
    selectedCurrency: AdvisorCurrency;
    rateFromAed: number;
    lastUpdatedAt: string;
    source: string;
    isEstimatedConversion: boolean;
  };
  resolvedContext: {
    minBudget: number | null;
    maxBudget: number | null;
    minBudgetAed: number | null;
    maxBudgetAed: number | null;
    currency: AdvisorCurrency;
    location: string;
    propertyType: string;
    purpose: AdvisorPurpose;
    language: AdvisorLanguageMode;
    detectedLanguage: AdvisorResolvedLanguage;
  };
  followUpSuggestions: string[];
  dataSource: 'firebase_firestore_merged' | 'verified_catalog_baseline';
}

export interface LiveInventoryOverlayLike {
  projectId: string;
  status: 'verified_live' | 'unavailable';
  totalRegisteredUnits: number | null;
  releasedUnits: number | null;
  availableUnits: number | null;
  soldUnits: number | null;
  reservedUnits: number | null;
  onHoldUnits: number | null;
  remainingUnits: number | null;
  availabilityPct: number | null;
  lastUpdatedAt: string;
  dataSource: string;
  sourceType: string;
}

const VALID_CURRENCIES: Set<AdvisorCurrency> = new Set([
  'AED',
  'INR',
  'USD',
  'GBP',
  'EUR',
  'SAR',
]);

const VALID_ADVISOR_LANGUAGES: Set<AdvisorLanguageMode> = new Set([
  'auto',
  'en',
  'hi',
  'hinglish',
]);

// ============================================================================
// 1. Server-Side Cached Exchange Rates (12-Hour TTL)
// ============================================================================
const FX_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let cachedFx: { snapshot: FxRatesSnapshot; fetchedAtMs: number } | null = null;
let fxInflight: Promise<FxRatesSnapshot> | null = null;

export async function getCachedFxRates(): Promise<FxRatesSnapshot> {
  const now = Date.now();
  if (cachedFx && now - cachedFx.fetchedAtMs < FX_CACHE_TTL_MS) {
    return cachedFx.snapshot;
  }
  if (fxInflight) return fxInflight;

  fxInflight = (async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch('https://open.er-api.com/v6/latest/AED', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (resp.ok) {
        const json = (await resp.json()) as {
          result?: string;
          time_last_update_utc?: string;
          rates?: Record<string, number>;
        };
        const r = json?.rates;
        if (
          json?.result === 'success' &&
          r &&
          Number.isFinite(r.INR) &&
          Number.isFinite(r.USD) &&
          Number.isFinite(r.GBP) &&
          Number.isFinite(r.EUR) &&
          Number.isFinite(r.SAR)
        ) {
          const snapshot: FxRatesSnapshot = {
            base: 'AED',
            ratesFromAed: {
              AED: 1,
              USD: Number(r.USD.toFixed(6)),
              INR: Number(r.INR.toFixed(4)),
              GBP: Number(r.GBP.toFixed(6)),
              EUR: Number(r.EUR.toFixed(6)),
              SAR: Number(r.SAR.toFixed(6)),
            },
            lastUpdatedAt: json.time_last_update_utc
              ? new Date(json.time_last_update_utc).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10),
            source: 'Open Exchange Rates (AED Base · 12h Server Cache)',
            isFallback: false,
          };
          cachedFx = { snapshot, fetchedAtMs: Date.now() };
          return snapshot;
        }
      }
    } catch {
      // Fall back cleanly to verified baseline rates below
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    const fallback: FxRatesSnapshot = {
      base: 'AED',
      ratesFromAed: { ...CURRENCY_RATES_FROM_AED },
      lastUpdatedAt: EXCHANGE_RATE_UPDATED_AT,
      source: 'Verified Indicative FX Table (Server Cached)',
      isFallback: true,
    };
    cachedFx = { snapshot: fallback, fetchedAtMs: Date.now() };
    return fallback;
  })();

  try {
    return await fxInflight;
  } finally {
    fxInflight = null;
  }
}

export function convertCurrencyToAed(
  amount: number,
  currency: AdvisorCurrency,
  ratesFromAed: Record<AdvisorCurrency, number>
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (currency === 'AED') return Math.round(amount);
  const rate = ratesFromAed[currency] || CURRENCY_RATES_FROM_AED[currency];
  if (!rate || rate <= 0) return Math.round(amount);
  return Math.round(amount / rate);
}

export function convertAedToCurrency(
  amountAed: number,
  currency: AdvisorCurrency,
  ratesFromAed: Record<AdvisorCurrency, number>
): number {
  if (!Number.isFinite(amountAed) || amountAed <= 0) return 0;
  if (currency === 'AED') return Math.round(amountAed);
  const rate = ratesFromAed[currency] || CURRENCY_RATES_FROM_AED[currency];
  return Math.round(amountAed * rate);
}

export function formatMoneyForAdvisor(amount: number, currency: AdvisorCurrency): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Not available';
  if (currency === 'INR') {
    if (amount >= 10_000_000) {
      return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
    }
    return `₹${(amount / 100_000).toFixed(1)} L`;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  if (currency === 'AED' || currency === 'SAR') return `${currency} ${formatted}`;
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'GBP') return `£${formatted}`;
  return `€${formatted}`;
}

// ============================================================================
// 2. Live Firebase Firestore Project Querying (5-Minute Server Cache)
// ============================================================================
const PROJECTS_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProjects: {
  projects: Project[];
  fromFirestore: boolean;
  fetchedAtMs: number;
} | null = null;

type FirestoreRestValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

function decodeFirestoreValue(val: FirestoreRestValue | undefined): unknown {
  if (!val || 'nullValue' in val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map((v) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    const out: Record<string, unknown> = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export async function getCatalogProjectsForAdvisor(
  liveInventoryOverlay: Map<string, LiveInventoryOverlayLike>
): Promise<{ projects: Project[]; fromFirestore: boolean }> {
  const now = Date.now();
  let baseProjects: Project[];
  let fromFirestore = false;

  if (cachedProjects && now - cachedProjects.fetchedAtMs < PROJECTS_CACHE_TTL_MS) {
    baseProjects = cachedProjects.projects;
    fromFirestore = cachedProjects.fromFirestore;
  } else {
    const mergedMap = new Map<string, Project>(INITIAL_PROJECTS.map((p) => [p.id, p]));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const fbConfig = getFirebaseRuntimeConfig();
      const apiKey = fbConfig.apiKey;
      const projectId = fbConfig.projectId;
      const dbId = fbConfig.firestoreDatabaseId || '(default)';
      logServerEvent('info', 'firebase_init', {
        context: 'advisor_catalog_query',
        hasProjectId: Boolean(projectId),
        hasApiKey: Boolean(apiKey),
        dbId,
      });
      if (apiKey && projectId && !projectId.includes('remixed')) {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 3500);
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          projectId
        )}/databases/${encodeURIComponent(dbId)}/documents/projects?pageSize=300&key=${encodeURIComponent(
          apiKey
        )}`;
        const resp = await fetch(url, { signal: controller.signal });

        if (resp.ok) {
          const json = (await resp.json()) as {
            documents?: Array<{ fields?: Record<string, FirestoreRestValue> }>;
          };
          const docs = Array.isArray(json.documents) ? json.documents : [];
          if (docs.length > 0) {
            for (const d of docs) {
              if (!d.fields) continue;
              const decoded: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(d.fields)) {
                decoded[k] = decodeFirestoreValue(v);
              }
              if (typeof decoded.id === 'string' && typeof decoded.name === 'string') {
                const baseline = mergedMap.get(decoded.id);
                mergedMap.set(decoded.id, {
                  ...(baseline || {}),
                  ...(decoded as unknown as Project),
                });
              }
            }
            fromFirestore = true;
          }
        } else {
          logServerEvent('warn', 'firebase_catalog_rest_non_ok', {
            status: resp.status,
          });
        }
      }
    } catch (err) {
      logServerError('firebase_catalog_rest_error', err);
      // Keep baseline catalog if Firestore REST endpoint is unreachable
    } finally {
      if (timeout) clearTimeout(timeout);
    }

    baseProjects = Array.from(mergedMap.values());
    cachedProjects = {
      projects: baseProjects,
      fromFirestore,
      fetchedAtMs: Date.now(),
    };
  }

  if (liveInventoryOverlay.size === 0) {
    return { projects: baseProjects, fromFirestore };
  }

  const withOverlay = baseProjects.map((p) => {
    const ov = liveInventoryOverlay.get(p.id);
    if (!ov) return p;
    return {
      ...p,
      inventory: {
        ...p.inventory,
        status: ov.status,
        totalRegisteredUnits: ov.totalRegisteredUnits,
        releasedUnits: ov.releasedUnits,
        availableUnits: ov.availableUnits,
        soldUnits: ov.soldUnits,
        reservedUnits: ov.reservedUnits,
        onHoldUnits: ov.onHoldUnits,
        remainingUnits: ov.remainingUnits,
        availabilityPct: ov.availabilityPct,
        lastUpdatedAt: ov.lastUpdatedAt,
        dataSource: ov.dataSource,
        sourceType: (ov.sourceType as Project['inventory']['sourceType']) || p.inventory.sourceType,
      },
    };
  });

  return { projects: withOverlay, fromFirestore };
}

// ============================================================================
// 3. Deterministic Dubai Location Aliases & Nearby Corridor Graph
// ============================================================================
interface LocationDef {
  canonical: string;
  aliases: string[];
  nearby: string[];
}

const DUBAI_LOCATIONS: LocationDef[] = [
  {
    canonical: 'Dubai Marina',
    aliases: [
      'dubai marina',
      'marina',
      'jbr',
      'jumeirah beach residence',
      'dubai harbour',
      'bluewaters',
      'दुबई मरीना',
      'मरीना',
      'जेबीआर',
    ],
    nearby: ['Jumeirah Lake Towers', 'Al Furjan', 'Downtown Jebel Ali', 'Palm Jumeirah', 'Dubai Maritime City'],
  },
  {
    canonical: 'Downtown Dubai',
    aliases: [
      'downtown dubai',
      'downtown, dubai',
      'downtown',
      'burj khalifa',
      'opera district',
      'डाउनटाउन दुबई',
      'डाउनटाउन',
      'बुर्ज खलीफा',
    ],
    nearby: ['Business Bay', 'Sheikh Zayed Road', 'Meydan', 'Al Jaddaf', 'Dubai Creek Harbour'],
  },
  {
    canonical: 'Business Bay',
    aliases: [
      'business bay',
      'bay square',
      'marasi',
      'बिज़नेस बे',
      'बिजनेस बे',
    ],
    nearby: ['Downtown Dubai', 'Meydan', 'Al Jaddaf', 'Sheikh Zayed Road', 'Dubai Creek Harbour'],
  },
  {
    canonical: 'Jumeirah Village Circle (JVC)',
    aliases: [
      'jumeirah village circle',
      'jvc',
      'जेवीसी',
      'जुमेराह विलेज सर्कल',
      'जुमैरा विलेज सर्कल',
    ],
    nearby: ['Jumeirah Village Triangle', 'Arjan', 'Motor City', 'Sports City', 'Dubailand'],
  },
  {
    canonical: 'Dubai Hills Estate',
    aliases: [
      'dubai hills estate',
      'dubai hills',
      'दुबई हिल्स एस्टेट',
      'दुबई हिल्स',
    ],
    nearby: ['Meydan', 'Dubailand', 'Arabian Ranches', 'DAMAC Hills', 'Mohammed Bin Rashid City'],
  },
  {
    canonical: 'Palm Jumeirah',
    aliases: [
      'palm jumeirah',
      'the palm',
      'palm',
      'पाम जुमेराह',
      'पाम जुमैरा',
    ],
    nearby: ['Dubai Marina', 'Dubai Maritime City', 'Dubai Islands', 'Jumeirah Lake Towers'],
  },
  {
    canonical: 'Dubai Creek Harbour',
    aliases: [
      'dubai creek harbour',
      'creek harbour',
      'creek',
      'दुबई क्रीक हार्बर',
      'क्रीक हार्बर',
    ],
    nearby: ['Al Jaddaf', 'Meydan', 'Business Bay', 'Downtown Dubai', 'Festival City'],
  },
  {
    canonical: 'Arabian Ranches',
    aliases: [
      'arabian ranches',
      'ranches',
      'अरेबियन रैंचेस',
      'अरेबियन रैंचेज़',
    ],
    nearby: ['DAMAC Hills', 'Dubailand', 'Dubai Hills Estate', 'Motor City', 'Town Square'],
  },
  {
    canonical: 'DAMAC Hills',
    aliases: [
      'damac hills',
      'damac hills 2',
      'akoya',
      'डैमैक हिल्स',
      'दमाक हिल्स',
    ],
    nearby: ['Arabian Ranches', 'Motor City', 'Sports City', 'Jumeirah Village Circle (JVC)', 'Dubailand'],
  },
  {
    canonical: 'Dubailand',
    aliases: [
      'dubailand',
      'dlrc',
      'dubai land residence complex',
      'majan',
      'city of arabia',
      'liwan',
      'दुबईलैंड',
    ],
    nearby: ['DAMAC Hills', 'Arabian Ranches', 'Meydan', 'Dubai Silicon Oasis', 'Jumeirah Village Circle (JVC)'],
  },
  {
    canonical: 'Al Jaddaf',
    aliases: ['al jaddaf', 'jaddaf', 'healthcare city', 'अल जद्दाफ'],
    nearby: ['Dubai Creek Harbour', 'Business Bay', 'Downtown Dubai', 'Meydan'],
  },
  {
    canonical: 'Meydan',
    aliases: [
      'meydan',
      'meydan horizon',
      'mbr city',
      'mohammed bin rashid',
      'मैदान',
      'एमबीआर सिटी',
    ],
    nearby: ['Business Bay', 'Downtown Dubai', 'Dubai Hills Estate', 'Dubai Creek Harbour', 'Al Jaddaf'],
  },
  {
    canonical: 'Jumeirah Lake Towers',
    aliases: ['jumeirah lake towers', 'jlt', 'जेएलटी', 'जुमेराह लेक टावर्स'],
    nearby: ['Dubai Marina', 'Al Furjan', 'Jumeirah Village Triangle', 'Discovery Gardens'],
  },
  {
    canonical: 'Jumeirah Village Triangle',
    aliases: ['jumeirah village triangle', 'jvt', 'जेवीटी', 'जुमेराह विलेज ट्रायंगल'],
    nearby: ['Jumeirah Village Circle (JVC)', 'Al Furjan', 'Sports City', 'Motor City'],
  },
  {
    canonical: 'Al Furjan',
    aliases: ['al furjan', 'furjan', 'अल फुरजान', 'फुरजान'],
    nearby: ['Downtown Jebel Ali', 'Jumeirah Lake Towers', 'Dubai Marina', 'Jumeirah Village Triangle'],
  },
  {
    canonical: 'Dubai South',
    aliases: ['dubai south', 'emaar south', 'expo city', 'दुबई साउथ', 'एक्सपो सिटी'],
    nearby: ['Dubai Investment Park', 'Downtown Jebel Ali', 'Al Furjan'],
  },
  {
    canonical: 'Dubai Islands',
    aliases: [
      'dubai islands',
      'deira islands',
      'dubai maritime city',
      'mina rashid',
      'दुबई आइलैंड्स',
    ],
    nearby: ['Al Jaddaf', 'Dubai Creek Harbour', 'Palm Jumeirah'],
  },
  {
    canonical: 'Motor City',
    aliases: [
      'motor city',
      'sports city',
      'studio city',
      'arjan',
      'मोटर सिटी',
      'स्पोर्ट्स सिटी',
      'अर्जन',
    ],
    nearby: ['Jumeirah Village Circle (JVC)', 'DAMAC Hills', 'Arabian Ranches', 'Jumeirah Village Triangle'],
  },
];

function getProjectLocationText(p: Project): string {
  return `${p.community || ''} ${p.neighbourhood || ''} ${p.name || ''} ${p.fullAddress || ''}`.toLowerCase();
}

function findLocationDef(locationInput: string): LocationDef | null {
  const q = locationInput.trim().toLowerCase();
  if (!q || q === 'all' || q === 'all dubai' || q === 'other locations') return null;
  for (const def of DUBAI_LOCATIONS) {
    if (def.canonical.toLowerCase() === q) return def;
    if (def.aliases.some((a) => q.includes(a) || a.includes(q))) return def;
  }
  return null;
}

function doesProjectMatchLocation(p: Project, locationName: string): boolean {
  const q = locationName.trim().toLowerCase();
  if (!q || q === 'all' || q === 'all dubai') return true;
  if (q === 'other locations') {
    const primaryNames = [
      'dubai marina',
      'downtown',
      'business bay',
      'jumeirah village circle',
      'jvc',
      'dubai hills',
      'palm jumeirah',
      'creek harbour',
      'arabian ranches',
      'damac hills',
    ];
    const hay = getProjectLocationText(p);
    return !primaryNames.some((n) => hay.includes(n));
  }

  const hay = getProjectLocationText(p);
  const def = findLocationDef(locationName);
  if (def) {
    return def.aliases.some((alias) => {
      if (alias.length <= 3 && /^[a-z0-9]+$/i.test(alias)) {
        return new RegExp(`\\b${alias}\\b`, 'i').test(hay);
      }
      return hay.includes(alias);
    });
  }
  return hay.includes(q);
}

function doesProjectMatchNearbyLocation(p: Project, locationName: string): string | null {
  const def = findLocationDef(locationName);
  if (!def) return null;
  for (const nearName of def.nearby) {
    if (doesProjectMatchLocation(p, nearName)) {
      return nearName;
    }
  }
  return null;
}

// ============================================================================
// 4. Multilingual Detection & Natural Language Entity Extraction (Zero-Token NLU)
// ============================================================================
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

const HINGLISH_MARKER_REGEX =
  /\b(mujhe|mujhko|chahiye|chaahiye|dikhao|dikhaiye|dikhaye|batao|bataiye|bataye|batayein|kaunsa|kaunse|konsa|konse|konsi|kitna|kitne|kitni|kya|hai|hain|nahi|nahin|haan|hanji|mein|karod|karor|hazar|hazaar|rupaye|rupye|mera|meri|mere|apna|apni|ghar|kiraya|kiraye|nivesh|lena|khareedna|pasand|behtar|accha|achha|sasta|saste|sabse|wala|wale|wali|milega|milegi|milenge|dega|degi|denge|tulna|kist|kisht|kab|hoga|hogi|honge|rehne|jagah|kaun|kahan|samjhao|samjhaiye|karo|karein|karen|inme|iske|uska|aur|bhi|dhoondhein|bhejein)\b/i;

const HINGLISH_PHRASE_REGEX =
  /\b(ke andar|ke andhar|ke liye|ke beech|se kam|se neeche|se zyada|se jyada|ke upar|ke paas|inme se|kaun sa|kam se kam|khud rehne)\b/i;

export function detectAdvisorLanguage(
  message: string,
  explicitLanguage?: AdvisorLanguageMode,
  history?: AdvisorHistoryMessage[]
): AdvisorResolvedLanguage {
  if (
    explicitLanguage === 'en' ||
    explicitLanguage === 'hi' ||
    explicitLanguage === 'hinglish'
  ) {
    return explicitLanguage;
  }

  const trimmed = (message || '').trim();
  if (trimmed) {
    if (DEVANAGARI_REGEX.test(trimmed)) {
      return 'hi';
    }
    if (HINGLISH_MARKER_REGEX.test(trimmed) || HINGLISH_PHRASE_REGEX.test(trimmed)) {
      return 'hinglish';
    }
    // If user typed substantive English/ASCII words, switch/respond in English
    if (/[a-zA-Z]{2,}/.test(trimmed)) {
      return 'en';
    }
  }

  // Fallback to most recent user turn if current input has no clear letters (e.g. numbers/empty)
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const h = history[i];
      if (h?.role === 'user' && typeof h.content === 'string') {
        const prev = h.content.trim();
        if (DEVANAGARI_REGEX.test(prev)) return 'hi';
        if (HINGLISH_MARKER_REGEX.test(prev) || HINGLISH_PHRASE_REGEX.test(prev)) {
          return 'hinglish';
        }
      }
    }
  }

  return 'en';
}

const DEVANAGARI_DIGITS_MAP: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

function normalizeMultilingualNumbers(input: string): string {
  let s = input.replace(/[०-९]/g, (ch) => DEVANAGARI_DIGITS_MAP[ch] ?? ch);

  // Convert common spoken Hindi / Hinglish number words when paired with money or unit keywords
  const wordNumReplacements: Array<[RegExp, string]> = [
    [/डेढ़(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार))/gi, '1.5'],
    [/ढाई(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार))/gi, '2.5'],
    [/सवा(?=\s*(?:करोड़|करोड|लाख|मिलियन))/gi, '1.25'],
    [/एक(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार|बेडरूम|बीएचके|कमरा|कमरे))/gi, '1'],
    [/दो(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार|बेडरूम|बीएचके|कमरे))/gi, '2'],
    [/तीन(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार|बेडरूम|बीएचके|कमरे))/gi, '3'],
    [/चार(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार|बेडरूम|बीएचके|कमरे))/gi, '4'],
    [/(?:पांच|पाँच)(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार))/gi, '5'],
    [/दस(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार))/gi, '10'],
    [/बीस(?=\s*(?:करोड़|करोड|लाख|मिलियन|हज़ार|हजार))/gi, '20'],
    [/पच्चीस(?=\s*(?:करोड़|करोड|लाख|मिलियन))/gi, '25'],
    [/पचास(?=\s*(?:करोड़|करोड|लाख|मिलियन))/gi, '50'],
    [/\bdedh\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?|millions?|mn|m))/gi, '1.5'],
    [/\bdhai\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?|millions?|mn|m))/gi, '2.5'],
    [/\bek\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?|millions?|mn|m|bed|bedroom|br|bhk))/gi, '1'],
    [/\bdo\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?|millions?|mn|m|bed|bedroom|br|bhk))/gi, '2'],
    [/\bteen\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?|millions?|mn|m|bed|bedroom|br|bhk))/gi, '3'],
    [/\bpachas\b(?=\s*(?:crores?|cr|karod|karor|lakhs?|lacs?))/gi, '50'],
  ];

  for (const [pattern, replacement] of wordNumReplacements) {
    s = s.replace(pattern, replacement);
  }
  return s;
}

interface ExtractedQueryIntent {
  minBudget?: number | null;
  maxBudget?: number | null;
  currency?: AdvisorCurrency;
  location?: string;
  propertyType?: string;
  purpose?: AdvisorPurpose;
  followUpAction?: 'compare' | 'payment_plan' | 'handover' | 'yield' | null;
  wantsAffordable?: boolean;
  clearLocation?: boolean;
}

function parseShorthandMoneyToken(rawNum: string, unitRaw?: string): number {
  const num = Number(rawNum.replace(/,/g, ''));
  if (!Number.isFinite(num) || num <= 0) return 0;
  const u = (unitRaw || '').trim().toLowerCase();
  if (
    u === 'cr' ||
    u === 'crore' ||
    u === 'crores' ||
    u === 'karod' ||
    u === 'karor' ||
    u === 'करोड़' ||
    u === 'करोड'
  ) {
    return Math.round(num * 10_000_000);
  }
  if (
    u === 'l' ||
    u === 'lac' ||
    u === 'lacs' ||
    u === 'lakh' ||
    u === 'lakhs' ||
    u === 'लाख'
  ) {
    return Math.round(num * 100_000);
  }
  if (u === 'm' || u === 'mn' || u === 'million' || u === 'मिलियन') {
    return Math.round(num * 1_000_000);
  }
  if (
    u === 'k' ||
    u === 'thousand' ||
    u === 'hazar' ||
    u === 'hazaar' ||
    u === 'हज़ार' ||
    u === 'हजार'
  ) {
    return Math.round(num * 1_000);
  }
  return Math.round(num);
}

const MONEY_UNIT_PATTERN =
  '(?:crores?|cr|karod|karor|करोड़|करोड|lakhs?|lacs?|लाख|millions?|mn|m|thousands?|haza+r|हज़ार|हजार|k)';

export function extractNaturalLanguageIntent(message: string): ExtractedQueryIntent {
  const normalizedText = normalizeMultilingualNumbers((message || '').trim());
  const lower = normalizedText.toLowerCase();
  const out: ExtractedQueryIntent = {};

  // Currency detection (INR, USD, GBP, EUR, SAR, AED across English, Hindi & Hinglish)
  if (
    /₹|\b(?:inr|rs\.?|rupees?|rupaye|rupye)\b|रुपये|रुपए|(?:^|[\s\d])रु(?:\s|\.|$)/i.test(
      normalizedText
    )
  ) {
    out.currency = 'INR';
  } else if (/\$|\busd\b|\bdollars?\b|डॉलर/i.test(normalizedText)) {
    out.currency = 'USD';
  } else if (/£|\bgbp\b|\bpounds?\b|पाउंड/i.test(normalizedText)) {
    out.currency = 'GBP';
  } else if (/€|\beur\b|\beuros?\b|यूरो/i.test(normalizedText)) {
    out.currency = 'EUR';
  } else if (/\bsar\b|\briyals?\b|रियाल/i.test(normalizedText)) {
    out.currency = 'SAR';
  } else if (/\b(?:aed|dhs|dirhams?)\b|दिरहम/i.test(normalizedText)) {
    out.currency = 'AED';
  } else if (
    /\b(?:crores?|cr|karod|karor|lakhs?|lacs?)\b|करोड़|करोड|लाख/i.test(normalizedText)
  ) {
    // Only default crore/lakh to INR when AED/USD/etc. was NOT explicitly specified
    out.currency = 'INR';
  }

  const currSym = '(?:₹|rs\\.?|inr|aed|dhs|dirhams?|usd|\\$|gbp|£|eur|€|sar|दिरहम|रुपये|रुपए)?';

  // Range detection e.g. "between 1M and 2M", "1 करोड़ से 2 करोड़ के बीच", "50 lakh se 1 crore tak"
  const rangeRegex = new RegExp(
    `(?:between|from)?\\s*${currSym}\\s*([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})?\\s*(?:to|and|-|–|से|तक|se|aur)\\s*${currSym}\\s*([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})?`,
    'i'
  );
  const rangeMatch = normalizedText.match(rangeRegex);
  if (rangeMatch) {
    const v1 = parseShorthandMoneyToken(rangeMatch[1], rangeMatch[2] || rangeMatch[4]);
    const v2 = parseShorthandMoneyToken(rangeMatch[3], rangeMatch[4]);
    if (v1 > 10_000 && v2 >= v1) {
      out.minBudget = v1;
      out.maxBudget = v2;
    }
  }

  // Single budget detection if range not matched
  if (out.maxBudget === undefined) {
    const capWords =
      '(?:under|below|max|maximum|upto|up to|within|budget(?:\\s+of)?|have|around|about|ke\\s+andar|ke\\s+andhar|se\\s+kam|se\\s+neeche|tak|अधिकतम|लगभग|करीब|बजट)';
    const singlePatterns: RegExp[] = [
      new RegExp(
        `${capWords}\\s*(?:is|hai|है|:)?\\s*${currSym}\\s*([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})?`,
        'i'
      ),
      new RegExp(
        `([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})\\s*(?:रुपये|रुपए|दिरहम|rupaye|rupye|aed|inr)?\\s*(?:के\\s*अंदर|के\\s*भीतर|से\\s*कम|से\\s*नीचे|तक|ke\\s*andar|ke\\s*andhar|se\\s*kam|se\\s*neeche|tak)`,
        'i'
      ),
      new RegExp(
        `(?:₹|rs\\.?|inr|aed|dhs|usd|\\$|gbp|£|eur|€|sar)\\s*([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})?`,
        'i'
      ),
      new RegExp(`([\\d,.]+)\\s*(${MONEY_UNIT_PATTERN})(?=\\s|[,.!?।]|$)`, 'i'),
    ];
    for (const pat of singlePatterns) {
      const m = normalizedText.match(pat);
      if (m) {
        const val = parseShorthandMoneyToken(m[1], m[2]);
        if (val >= 50_000) {
          out.maxBudget = val;
          if (
            /\b(?:above|over|minimum|min|at least|se\s+zyada|se\s+jyada|ke\s+upar|kam\s+se\s+kam)\b|से\s*ज़्यादा|से\s*ज्यादा|के\s*ऊपर|कम\s*से\s*कम|न्यूनतम/i.test(
              lower
            )
          ) {
            out.minBudget = val;
            out.maxBudget = null;
          }
          break;
        }
      }
    }
  }

  // Location detection (English, Hindi Devanagari, and Hinglish)
  for (const def of DUBAI_LOCATIONS) {
    const matched = def.aliases.some((alias) => {
      if (alias.length <= 3 && /^[a-z0-9]+$/i.test(alias)) {
        return new RegExp(`\\b${alias}\\b`, 'i').test(normalizedText);
      }
      return lower.includes(alias);
    });
    if (matched) {
      out.location = def.canonical;
      break;
    }
  }
  if (
    !out.location &&
    /\ball dubai\b|\banywhere in dubai\b|\bany location\b|\bpure dubai\b|\bkahin bhi\b|पूरे दुबई|पूरा दुबई|कहीं भी/i.test(
      lower
    )
  ) {
    out.clearLocation = true;
  }

  // Property type detection (English, Hindi Devanagari, Hinglish)
  if (/\bstudio\b|स्टूडियो/i.test(lower)) out.propertyType = 'Studio';
  else if (/\bpenthouse\b|पेंटहाउस/i.test(lower)) out.propertyType = 'Penthouse';
  else if (/\btownhouse\b|टाउनहाउस/i.test(lower)) out.propertyType = 'Townhouse';
  else if (/\bvilla\b|विला/i.test(lower)) out.propertyType = 'Villa';
  else if (/1[\s-]*(?:bed(?:room)?s?|br|bhk|बेडरूम|बीएचके|कमरा|कमरे)(?=[\s,.!?।]|$)/i.test(lower)) {
    out.propertyType = '1 Bedroom';
  } else if (/2[\s-]*(?:bed(?:room)?s?|br|bhk|बेडरूम|बीएचके|कमरे)(?=[\s,.!?।]|$)/i.test(lower)) {
    out.propertyType = '2 Bedroom';
  } else if (/3[\s-]*(?:bed(?:room)?s?|br|bhk|बेडरूम|बीएचके|कमरे)(?=[\s,.!?।]|$)/i.test(lower)) {
    out.propertyType = '3 Bedroom';
  } else if (/\b(?:apartment|flat)s?\b|अपार्टमेंट|फ्लैट/i.test(lower)) {
    out.propertyType = 'Apartment';
  }

  // Purpose detection
  if (
    /\b(?:rental|rent|yield|roi|tenant|passive income|lease|kiraya|kiraye)\b|किराया|किराये|किराए|रेंटल|रेंट/i.test(
      lower
    )
  ) {
    out.purpose = 'Rental income';
  } else if (
    /\b(?:capital appreciation|appreciation|growth|flip|resale)\b|पूंजी वृद्धि|ग्रोथ|रीसेल/i.test(
      lower
    )
  ) {
    out.purpose = 'Capital appreciation';
  } else if (
    /\b(?:personal|live|living|family|end[\s-]?use|move[\s-]?in|khud\s*rehne|rehne\s*ke\s*liye|parivar|ghar)\b|खुद रहने|स्वयं रहने|परिवार|रहने के लिए/i.test(
      lower
    )
  ) {
    out.purpose = 'Personal living';
  } else if (
    /\b(?:invest|investment|investor|portfolio|nivesh)\b|निवेश|इनवेस्टमेंट|इन्वेस्ट/i.test(
      lower
    )
  ) {
    out.purpose = 'Investment';
  }

  // Follow-up intent detection
  if (/\b(?:compare|farq)\b|तुलना|कम्पेयर|अंतर|फर्क/i.test(lower)) {
    out.followUpAction = 'compare';
  } else if (
    /\b(?:payment\s*plan|installment|down\s*payment|kist|kisht)\b|पेमेंट प्लान|किस्त|किश्त|डाउन पेमेंट/i.test(
      lower
    )
  ) {
    out.followUpAction = 'payment_plan';
  } else if (
    /\b(?:handover|completion|delivery|kab\s+milega|kab\s+taiyar)\b|हैंडओवर|डिलीवरी|कब्जा|कब्ज़ा/i.test(
      lower
    )
  ) {
    out.followUpAction = 'handover';
  } else if (
    /\b(?:roi|yield|rental return|kamai)\b|रिटर्न|यील्ड|कमाई|मुनाफा/i.test(lower)
  ) {
    out.followUpAction = 'yield';
  }

  if (
    /\b(?:affordable|budget|cheap|lowest|entry|sasta|saste|kifayati|kam\s+budget)\b|सस्ता|सस्ते|किफायती|कम बजट|कम कीमत/i.test(
      lower
    )
  ) {
    out.wantsAffordable = true;
  }

  return out;
}

// ============================================================================
// 5. Property Type Matching & Deterministic Ranking Engine
// ============================================================================
function doesProjectMatchPropertyType(p: Project, requestedType: string): boolean {
  const req = requestedType.trim().toLowerCase();
  if (!req || req === 'all' || req === 'any') return true;

  const types = (p.propertyTypes || []).map((t) => t.toLowerCase());
  const plans = (p.floorPlans || []).map((fp) => `${fp.name} ${fp.bedrooms}`.toLowerCase());
  const hay = [...types, ...plans, (p.name || '').toLowerCase()].join(' ');

  if (req === 'studio') return hay.includes('studio');
  if (req === '1 bedroom') return types.some((t) => t.includes('1 bed')) || /\b1\s*(?:br|bhk|bed)/.test(hay);
  if (req === '2 bedroom') return types.some((t) => t.includes('2 bed')) || /\b2\s*(?:br|bhk|bed)/.test(hay);
  if (req === '3 bedroom') return types.some((t) => t.includes('3 bed')) || /\b3\s*(?:br|bhk|bed)/.test(hay);
  if (req === 'villa') return types.some((t) => t.includes('villa')) || hay.includes('villa');
  if (req === 'townhouse') return types.some((t) => t.includes('townhouse')) || hay.includes('townhouse');
  if (req === 'penthouse') return types.some((t) => t.includes('penthouse')) || hay.includes('penthouse');
  if (req === 'apartment') {
    return (
      types.some((t) => /studio|bedroom|duplex|apartment/.test(t)) ||
      /apartment|studio|bedroom/.test(hay)
    );
  }
  return hay.includes(req);
}

interface RankedCandidate {
  project: Project;
  score: number;
  matchType: 'exact' | 'alternative';
  matchReason: string;
}

function scoreProject(
  p: Project,
  ctx: {
    minBudgetAed: number | null;
    maxBudgetAed: number | null;
    location: string;
    propertyType: string;
    purpose: AdvisorPurpose;
    wantsAffordable: boolean;
  },
  matchType: 'exact' | 'alternative',
  matchReason: string
): RankedCandidate {
  let score = matchType === 'exact' ? 100 : 40;

  if (p.featured) score += 6;
  if (p.verified) score += 4;
  if (p.inventory?.status === 'verified_live' && (p.inventory.availableUnits ?? 0) > 0) {
    score += 8;
  }

  // Budget fit scoring
  const price = p.startingPriceAed;
  if (price > 0 && ctx.maxBudgetAed && ctx.maxBudgetAed > 0) {
    if (price <= ctx.maxBudgetAed) {
      const ratio = price / ctx.maxBudgetAed;
      score += ratio >= 0.55 ? 18 : 10;
    } else {
      const overPct = ((price - ctx.maxBudgetAed) / ctx.maxBudgetAed) * 100;
      score -= Math.min(30, overPct);
    }
  }
  if (ctx.wantsAffordable && price > 0) {
    score += Math.max(0, 15 - price / 200_000);
  }

  // Purpose alignment scoring
  const grossYield = p.investment?.grossYieldPct ?? 0;
  const netYield = p.investment?.netYieldPct ?? 0;
  const appreciation = p.investment?.estimatedAppreciationPct ?? 0;

  if (ctx.purpose === 'Rental income' || ctx.purpose === 'Investment') {
    score += netYield * 4 + grossYield * 2.5;
    if (p.category === 'Ready-to-move') score += 8;
    if (p.paymentPlan && /post|1%|monthly/i.test(p.paymentPlan)) score += 6;
  } else if (ctx.purpose === 'Capital appreciation') {
    score += appreciation * 2.5;
    if (p.category === 'Off-plan' || p.category === 'Upcoming launch') score += 8;
    if (p.waterfront) score += 5;
  } else if (ctx.purpose === 'Personal living') {
    if (p.category === 'Ready-to-move') score += 14;
    else if (p.constructionPct >= 60) score += 8;
    score += Math.min(8, (p.amenities?.length || 0) * 0.6);
  } else {
    score += netYield * 1.5 + appreciation * 0.8;
  }

  return { project: p, score, matchType, matchReason };
}

function buildRecommendationCard(
  item: RankedCandidate,
  selectedCurrency: AdvisorCurrency,
  ratesFromAed: Record<AdvisorCurrency, number>
): AdvisorRecommendationCard {
  const p = item.project;
  const priceAed = p.startingPriceAed > 0 ? p.startingPriceAed : 0;
  const priceSelected =
    priceAed > 0 ? convertAedToCurrency(priceAed, selectedCurrency, ratesFromAed) : 0;
  const bhk = formatPropertyBhk(p);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    developerName: p.developerName || 'Not available',
    heroImage: p.heroImage || '',
    community: p.community || 'Dubai',
    emirate: p.emirate || 'Dubai',
    startingPriceAed: priceAed,
    maxPriceAed: p.maxPriceAed > 0 ? p.maxPriceAed : 0,
    startingPriceSelected: priceSelected,
    formattedStartingPriceAed:
      priceAed > 0 ? formatMoneyForAdvisor(priceAed, 'AED') : 'Not available',
    formattedStartingPriceSelected:
      priceAed > 0
        ? formatMoneyForAdvisor(priceSelected, selectedCurrency)
        : 'Not available',
    currency: selectedCurrency,
    isEstimatedConversion: selectedCurrency !== 'AED' && priceAed > 0,
    propertyTypes: (p.propertyTypes || []).length > 0 ? p.propertyTypes : ['Not available'],
    bedroomOptions: bhk === 'Not Available' ? 'Not available' : bhk,
    paymentPlan: p.paymentPlan && p.paymentPlan.trim() ? p.paymentPlan : 'Not available',
    handoverDate: p.handoverDate && p.handoverDate.trim() ? p.handoverDate : 'Not available',
    verifiedGrossYieldPct:
      typeof p.investment?.grossYieldPct === 'number' ? p.investment.grossYieldPct : null,
    verifiedNetYieldPct:
      typeof p.investment?.netYieldPct === 'number' ? p.investment.netYieldPct : null,
    estimatedAppreciationPct:
      typeof p.investment?.estimatedAppreciationPct === 'number'
        ? p.investment.estimatedAppreciationPct
        : null,
    category: p.category || 'Not available',
    status: p.status || p.category || 'Not available',
    matchType: item.matchType,
    matchReason: item.matchReason,
    availableUnits:
      p.inventory?.status === 'verified_live' && typeof p.inventory.availableUnits === 'number'
        ? p.inventory.availableUnits
        : null,
    inventoryStatus:
      p.inventory?.status === 'verified_live' ? 'verified_live' : 'contact_developer',
  };
}

// ============================================================================
// 6. Token-Optimized Gemini Client + Query Cache (10-Minute TTL)
// ============================================================================
const AI_CACHE_TTL_MS = 10 * 60 * 1000;
const AI_CACHE_MAX_ENTRIES = 200;
const aiResponseCache = new Map<string, { reply: string; cachedAtMs: number }>();

let sharedGenAi: GoogleGenAI | null = null;
let sharedGenAiKeyHash = '';
function getGeminiClient(): { client: GoogleGenAI | null; reason?: string } {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    logServerEvent('warn', 'gemini_init', {
      status: 'missing_api_key',
      hasGeminiApiKey: false,
    });
    return {
      client: null,
      reason: 'GEMINI_API_KEY is not configured in server environment variables.',
    };
  }
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12);
  if (!sharedGenAi || sharedGenAiKeyHash !== keyHash) {
    try {
      sharedGenAi = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      sharedGenAiKeyHash = keyHash;
      logServerEvent('info', 'gemini_init', {
        status: 'initialized',
        hasGeminiApiKey: true,
        model: 'gemini-4-hydrogen',
      });
    } catch (err) {
      logServerError('gemini_init_error', err);
      sharedGenAi = null;
      sharedGenAiKeyHash = '';
      return {
        client: null,
        reason: err instanceof Error ? err.message : 'Failed to initialize Gemini client.',
      };
    }
  }
  return { client: sharedGenAi };
}

const SYSTEM_INSTRUCTION = `You are the Dubai Property Advisor for White Collar Realty, an expert multilingual UAE real estate consultant fluent in English, Hindi (Devanagari), and Hinglish (Roman Hindi + English).

Language Detection & Style Rules:
1. Automatically detect the language and conversational style of the client's latest message, while respecting "responseLanguage" when an explicit preference is set (or "requestedLanguageMode" is not "auto"):
   - English ("en"): Respond in clear, natural, polished, consultative English.
   - Hindi ("hi"): Respond in natural, polite, idiomatic Hindi written cleanly in Devanagari script (use clear property terms like दुबई, बेडरूम, विला, अपार्टमेंट, पेमेंट प्लान, हैंडओवर, किराये की आय). Avoid robotic literal translations.
   - Hinglish ("hinglish"): Respond in natural, conversational Roman Hindi mixed with everyday English real estate terms (e.g., "Business Bay aur JVC mein aapke budget ke mutabik...", "Is project ka payment plan aur expected rental yield kaafi balanced hai"). Do NOT use Devanagari script in Hinglish replies.
2. Support seamless mid-conversation language switches (e.g., English -> Hindi -> Hinglish -> English) on every turn without losing prior context.

Conversation Context & Continuity Rules:
3. Always maintain conversation context across turns using both "Recent conversation" and the structured "preferences" / "shortlistedProjects" JSON. On follow-up questions (such as comparisons, payment plans, handover timelines, or rental yields) where the client does not repeat their budget, location, or unit type, carry forward the active context and refer directly to the shortlisted projects.

Verified Inventory & Advisory Rules:
4. Recommend ONLY from the "shortlistedProjects" JSON provided. Never invent prices, yields, payment plans, handover dates, developer names, or unit availability.
5. Keep responses concise (120-180 words), well-structured, and practical.
6. Whenever the selected currency is not AED, mention both the official AED price and the converted currency price, clearly noting that currency conversions are estimates.
7. Never guarantee rental returns or capital appreciation. If any metric is "Not available", state it honestly in the active response language.
8. If "hasExactMatches" is false and alternatives are provided, clearly present them as nearby corridor or flexible-budget alternatives in the active response language. If essential criteria (such as budget or preferred location) are still missing, ask one brief follow-up question in the same language.`;

function getLocalizedFallbackReply(params: {
  language: AdvisorResolvedLanguage;
  cards: AdvisorRecommendationCard[];
  hasExactMatches: boolean;
  lowestDubaiPriceAed: number;
  selectedCurrency: AdvisorCurrency;
  ratesFromAed: Record<AdvisorCurrency, number>;
  followUpAction: ExtractedQueryIntent['followUpAction'];
  reason?: string;
}): { reply: string; aiNotice: string } {
  const { language, cards, hasExactMatches, lowestDubaiPriceAed, followUpAction, reason } = params;
  const minPriceAedText = formatMoneyForAdvisor(lowestDubaiPriceAed, 'AED');
  const count = cards.length;

  if (language === 'hi') {
    const aiNotice = reason
      ? `AI व्याख्या अस्थायी रूप से उपलब्ध नहीं है (${reason.slice(0, 110)})। नीचे डेटाबेस से सत्यापित प्रोजेक्ट दिखाए जा रहे हैं।`
      : 'AI व्याख्या के लिए सर्वर में GEMINI_API_KEY आवश्यक है; नीचे डेटाबेस से सत्यापित विकल्प दिखाए जा रहे हैं।';

    if (count === 0) {
      return {
        reply: `इन सटीक फ़िल्टरों के अनुसार डेटाबेस में कोई सत्यापित दुबई प्रोजेक्ट नहीं मिला (दुबई के सत्यापित प्रोजेक्ट ${minPriceAedText} से शुरू होते हैं)। कृपया बजट थोड़ा बढ़ाएं या "पूरा दुबई" चुनें।`,
        aiNotice,
      };
    }

    if (followUpAction === 'compare' && count >= 2) {
      const summary = cards
        .slice(0, 3)
        .map(
          (c) =>
            `• ${c.name} (${c.community}): ${c.formattedStartingPriceAed}${
              c.currency !== 'AED' ? ` / अनुमानित ${c.formattedStartingPriceSelected}` : ''
            }, पेमेंट प्लान: ${c.paymentPlan}, हैंडओवर: ${c.handoverDate}`
        )
        .join('\n');
      return {
        reply: `डेटाबेस में उपलब्ध ${Math.min(3, count)} प्रोजेक्ट्स की मुख्य तुलना:\n${summary}`,
        aiNotice,
      };
    }

    if (followUpAction === 'payment_plan') {
      const summary = cards
        .slice(0, 3)
        .map((c) => `• ${c.name}: ${c.paymentPlan} (हैंडओवर: ${c.handoverDate})`)
        .join('\n');
      return {
        reply: `इन प्रोजेक्ट्स के सत्यापित पेमेंट प्लान और हैंडओवर विवरण:\n${summary}`,
        aiNotice,
      };
    }

    return {
      reply: hasExactMatches
        ? `आपकी आवश्यकताओं से मेल खाने वाले ${count} सत्यापित दुबई प्रोजेक्ट मिले हैं। सटीक AED कीमत, पेमेंट प्लान और अनुमानित यील्ड देखने के लिए नीचे दिए गए प्रोजेक्ट कार्ड देखें।`
        : `सभी फ़िल्टर से सटीक मेल नहीं मिला, इसलिए नीचे डेटाबेस से ${count} नज़दीकी क्षेत्र या लचीले बजट वाले सत्यापित विकल्प दिखाए जा रहे हैं।`,
      aiNotice,
    };
  }

  if (language === 'hinglish') {
    const aiNotice = reason
      ? `AI summary abhi temporarily unavailable hai (${reason.slice(0, 110)}). Neeche verified database matches dikhaye ja rahe hain.`
      : 'AI summary ke liye server mein GEMINI_API_KEY zaroori hai; neeche verified database matches dikhaye ja rahe hain.';

    if (count === 0) {
      return {
        reply: `In exact filters ke hisaab se database mein koi verified Dubai project nahi mila (verified Dubai projects ${minPriceAedText} se shuru hote hain). Kripya budget thoda badhayein ya All Dubai select karein.`,
        aiNotice,
      };
    }

    if (followUpAction === 'compare' && count >= 2) {
      const summary = cards
        .slice(0, 3)
        .map(
          (c) =>
            `• ${c.name} (${c.community}): ${c.formattedStartingPriceAed}${
              c.currency !== 'AED' ? ` / Est. ${c.formattedStartingPriceSelected}` : ''
            }, Payment Plan: ${c.paymentPlan}, Handover: ${c.handoverDate}`
        )
        .join('\n');
      return {
        reply: `Shortlisted ${Math.min(3, count)} verified projects ka comparison:\n${summary}`,
        aiNotice,
      };
    }

    if (followUpAction === 'payment_plan') {
      const summary = cards
        .slice(0, 3)
        .map((c) => `• ${c.name}: ${c.paymentPlan} (Handover: ${c.handoverDate})`)
        .join('\n');
      return {
        reply: `In projects ke verified payment plans aur handover details:\n${summary}`,
        aiNotice,
      };
    }

    return {
      reply: hasExactMatches
        ? `Aapki requirement ke mutabik database mein ${count} verified Dubai project${
            count > 1 ? 's' : ''
          } mile hain. Verified AED pricing, payment plans aur yield details ke liye neeche cards dekhein.`
        : `Exact filters ke saath match nahi mila, isliye paas ke areas ya flexible budget ke ${count} verified alternatives neeche dikha rahe hain.`,
      aiNotice,
    };
  }

  // English fallback
  const aiNotice = reason
    ? `AI explanation temporarily unavailable (${reason.slice(0, 140)}). Verified database matches are shown below.`
    : 'AI narrative requires GEMINI_API_KEY in server environment secrets; showing deterministic verified database matches.';

  if (count === 0) {
    return {
      reply: `No verified Dubai projects matched those exact filters in our database (verified Dubai projects start from ${minPriceAedText}). Try increasing your budget or selecting All Dubai.`,
      aiNotice,
    };
  }

  if (followUpAction === 'compare' && count >= 2) {
    const summary = cards
      .slice(0, 3)
      .map(
        (c) =>
          `• ${c.name} (${c.community}): ${c.formattedStartingPriceAed}${
            c.currency !== 'AED' ? ` / Est. ${c.formattedStartingPriceSelected}` : ''
          } · Payment Plan: ${c.paymentPlan} · Handover: ${c.handoverDate}`
      )
      .join('\n');
    return {
      reply: `Here is a verified comparison of the top ${Math.min(3, count)} shortlisted projects:\n${summary}`,
      aiNotice,
    };
  }

  if (followUpAction === 'payment_plan') {
    const summary = cards
      .slice(0, 3)
      .map((c) => `• ${c.name}: ${c.paymentPlan} (Handover: ${c.handoverDate})`)
      .join('\n');
    return {
      reply: `Verified developer payment plans and handover dates for these projects:\n${summary}`,
      aiNotice,
    };
  }

  return {
    reply: hasExactMatches
      ? `Found ${count} verified Dubai project${
          count > 1 ? 's' : ''
        } matching your criteria in our database. Review the project cards below for verified AED pricing, payment plans, and yields.`
      : `No exact matches fit all filters, so here ${
          count === 1
            ? 'is 1 verified nearby or flexible-budget alternative'
            : `are ${count} verified nearby or flexible-budget alternatives`
        } from our database.`,
    aiNotice,
  };
}

function localizeFollowUpSuggestions(params: {
  language: AdvisorResolvedLanguage;
  cards: AdvisorRecommendationCard[];
  purpose: AdvisorPurpose;
  location: string;
}): string[] {
  const { language, cards, purpose, location } = params;
  const out: string[] = [];

  if (language === 'hi') {
    if (cards.length >= 2) {
      out.push('इन प्रोजेक्ट्स की तुलना करें');
      out.push('पेमेंट प्लान और हैंडओवर क्या है?');
    }
    if (purpose !== 'Rental income') {
      out.push('किराये से सबसे अच्छा रिटर्न किसमें मिलेगा?');
    }
    if (!location) {
      out.push('बिज़नेस बे या जेवीसी में विकल्प दिखाएं');
    }
    return out.slice(0, 3);
  }

  if (language === 'hinglish') {
    if (cards.length >= 2) {
      out.push('In projects ko compare karo');
      out.push('Payment plan aur handover kya hai?');
    }
    if (purpose !== 'Rental income') {
      out.push('Sabse accha rental yield kaunsa dega?');
    }
    if (!location) {
      out.push('Business Bay ya JVC mein options dikhao');
    }
    return out.slice(0, 3);
  }

  if (cards.length >= 2) {
    out.push('Compare these projects');
    out.push('What is the payment plan?');
  }
  if (purpose !== 'Rental income') {
    out.push('Which offers the best rental yield?');
  }
  if (!location) {
    out.push('Show options in Business Bay or JVC');
  }
  return out.slice(0, 3);
}

function localizeMatchReason(
  language: AdvisorResolvedLanguage,
  kind:
    | 'shortlist'
    | 'exact'
    | 'budget_over'
    | 'budget_alt'
    | 'nearby_budget'
    | 'nearby_flex'
    | 'diff_config',
  details: {
    community?: string;
    nearby?: string;
    overPct?: number;
    hasLocation?: boolean;
    hasMaxBudget?: boolean;
    propertyType?: string;
    netYieldPct?: number | null;
  }
): string {
  const { community = 'Dubai', nearby = '', overPct = 0 } = details;

  if (language === 'hi') {
    if (kind === 'shortlist') return 'आपकी वर्तमान तुलना सूची से';
    if (kind === 'budget_over') {
      return overPct > 0
        ? `लचीला बजट विकल्प (${community} में लक्ष्य से +${overPct}% अधिक)`
        : `${community} में बजट विकल्प`;
    }
    if (kind === 'budget_alt') return `${community} में बजट विकल्प`;
    if (kind === 'nearby_budget') return `नज़दीकी क्षेत्र (${nearby}) · आपके बजट के अंदर`;
    if (kind === 'nearby_flex') return `नज़दीकी क्षेत्र (${nearby}) · लचीला बजट विकल्प`;
    if (kind === 'diff_config') return `${community} में बजट के अंदर (अन्य यूनिट विकल्प)`;

    const reasons: string[] = [];
    if (details.hasLocation) reasons.push(`${community} में स्थित`);
    if (details.hasMaxBudget) reasons.push('आपके बजट के अंदर');
    if (details.propertyType) reasons.push(`${details.propertyType} उपलब्ध`);
    if (details.netYieldPct) reasons.push(`अनुमानित ${details.netYieldPct}% नेट यील्ड`);
    return reasons.slice(0, 2).join(' · ') || 'आपकी दुबई खोज प्राथमिकताओं से मेल खाता है';
  }

  if (language === 'hinglish') {
    if (kind === 'shortlist') return 'Aapke current shortlisted comparison se';
    if (kind === 'budget_over') {
      return overPct > 0
        ? `Flexible budget option (${community} mein target se +${overPct}% zyada)`
        : `${community} mein budget alternative`;
    }
    if (kind === 'budget_alt') return `${community} mein budget alternative`;
    if (kind === 'nearby_budget') return `Paas ka area (${nearby}) · aapke budget ke andar`;
    if (kind === 'nearby_flex') return `Paas ka area (${nearby}) · flexible budget match`;
    if (kind === 'diff_config') return `${community} mein budget ke andar (alag unit type)`;

    const reasons: string[] = [];
    if (details.hasLocation) reasons.push(`${community} mein location`);
    if (details.hasMaxBudget) reasons.push('Budget ke andar');
    if (details.propertyType) reasons.push(`${details.propertyType} available`);
    if (details.netYieldPct) reasons.push(`${details.netYieldPct}% est. net yield`);
    return reasons.slice(0, 2).join(' · ') || 'Aapki Dubai search criteria ke mutabik';
  }

  if (kind === 'shortlist') return 'From your current shortlisted comparison';
  if (kind === 'budget_over') {
    return overPct > 0
      ? `Budget alternative (+${overPct}% above target in ${community})`
      : `Budget alternative in ${community}`;
  }
  if (kind === 'budget_alt') return `Budget alternative in ${community}`;
  if (kind === 'nearby_budget') return `Nearby corridor (${nearby}) within your budget`;
  if (kind === 'nearby_flex') return `Nearby corridor (${nearby}) · flexible budget match`;
  if (kind === 'diff_config') return `In ${community} within budget (different unit configuration)`;

  const reasons: string[] = [];
  if (details.hasLocation) reasons.push(`Located in ${community}`);
  if (details.hasMaxBudget) reasons.push('Within your budget');
  if (details.propertyType) reasons.push(`Offers ${details.propertyType}`);
  if (details.netYieldPct) reasons.push(`${details.netYieldPct}% est. net yield`);
  return reasons.slice(0, 2).join(' · ') || 'Matches your Dubai search criteria';
}

async function generateAdvisorExplanation(params: {
  userMessage: string;
  history: AdvisorHistoryMessage[];
  cards: AdvisorRecommendationCard[];
  resolvedContext: AdvisorResponsePayload['resolvedContext'];
  fxInfo: AdvisorResponsePayload['fxInfo'];
  hasExactMatches: boolean;
  followUpAction: ExtractedQueryIntent['followUpAction'];
  lowestDubaiPriceAed: number;
  resolvedLanguage: AdvisorResolvedLanguage;
  ratesFromAed: Record<AdvisorCurrency, number>;
}): Promise<{ reply: string; aiStatus: 'ok' | 'cached' | 'unavailable'; aiNotice?: string }> {
  const compactCards = params.cards.map((c) => ({
    name: c.name,
    developer: c.developerName,
    location: c.community,
    priceAed: c.formattedStartingPriceAed,
    priceSelected:
      c.currency !== 'AED' ? `${c.formattedStartingPriceSelected} (est.)` : undefined,
    types: c.propertyTypes.slice(0, 4),
    paymentPlan: c.paymentPlan,
    handover: c.handoverDate,
    netYieldPct: c.verifiedNetYieldPct,
    grossYieldPct: c.verifiedGrossYieldPct,
    status: c.category,
    matchType: c.matchType,
    matchReason: c.matchReason,
  }));

  const cachePayload = JSON.stringify({
    lang: params.resolvedLanguage,
    q: params.userMessage.trim().toLowerCase(),
    ctx: {
      minBudget: params.resolvedContext.minBudget,
      maxBudget: params.resolvedContext.maxBudget,
      minBudgetAed: params.resolvedContext.minBudgetAed,
      maxBudgetAed: params.resolvedContext.maxBudgetAed,
      currency: params.resolvedContext.currency,
      location: params.resolvedContext.location,
      propertyType: params.resolvedContext.propertyType,
      purpose: params.resolvedContext.purpose,
    },
    ids: params.cards.map((c) => c.id),
    act: params.followUpAction,
  });
  const cacheKey = crypto.createHash('sha256').update(cachePayload).digest('hex');

  const hit = aiResponseCache.get(cacheKey);
  if (hit && Date.now() - hit.cachedAtMs < AI_CACHE_TTL_MS) {
    return { reply: hit.reply, aiStatus: 'cached' };
  }

  const { client: ai, reason: initReason } = getGeminiClient();
  if (!ai) {
    const fb = getLocalizedFallbackReply({
      language: params.resolvedLanguage,
      cards: params.cards,
      hasExactMatches: params.hasExactMatches,
      lowestDubaiPriceAed: params.lowestDubaiPriceAed,
      selectedCurrency: params.fxInfo.selectedCurrency,
      ratesFromAed: params.ratesFromAed,
      followUpAction: params.followUpAction,
      reason: initReason,
    });
    return {
      reply: fb.reply,
      aiStatus: 'unavailable',
      aiNotice: fb.aiNotice,
    };
  }

  const recentHistory = params.history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Client' : 'Advisor'}: ${m.content.slice(0, 260)}`)
    .join('\n');

  const languageStyleNote =
    params.resolvedLanguage === 'hi'
      ? 'Respond ONLY in natural, polite Hindi (Devanagari script).'
      : params.resolvedLanguage === 'hinglish'
      ? 'Respond ONLY in natural conversational Hinglish (Roman Hindi + English words, no Devanagari script).'
      : 'Respond ONLY in professional English.';

  const promptPayload = {
    requestedLanguageMode: params.resolvedContext.language,
    responseLanguage: params.resolvedLanguage,
    languageStyleInstruction: languageStyleNote,
    clientMessage: params.userMessage.slice(0, 500),
    preferences: {
      currency: params.fxInfo.selectedCurrency,
      minBudgetAed: params.resolvedContext.minBudgetAed,
      maxBudgetAed: params.resolvedContext.maxBudgetAed,
      location: params.resolvedContext.location || 'Any Dubai',
      propertyType: params.resolvedContext.propertyType || 'Any',
      purpose: params.resolvedContext.purpose || 'Not specified',
    },
    followUpAction: params.followUpAction || 'recommend',
    hasExactMatches: params.hasExactMatches,
    lowestVerifiedDubaiPriceAed: params.lowestDubaiPriceAed,
    shortlistedProjects: compactCards,
  };

  const userPrompt = `${
    recentHistory ? `Recent conversation:\n${recentHistory}\n\n` : ''
  }Verified shortlist & preferences (JSON):\n${JSON.stringify(promptPayload)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 650,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = response?.text?.trim();
    if (!text) {
      throw new Error('Empty response received from Gemini model');
    }

    if (aiResponseCache.size >= AI_CACHE_MAX_ENTRIES) {
      const oldestKey = aiResponseCache.keys().next().value;
      if (oldestKey) aiResponseCache.delete(oldestKey);
    }
    aiResponseCache.set(cacheKey, { reply: text, cachedAtMs: Date.now() });

    return { reply: text, aiStatus: 'ok' };
  } catch (err) {
    logServerError('gemini_generate_error', err, {
      cardCount: params.cards.length,
      currency: params.fxInfo.selectedCurrency,
      resolvedLanguage: params.resolvedLanguage,
    });
    let errMsg = err instanceof Error ? err.message : 'Gemini service unavailable';
    try {
      const parsedErr = JSON.parse(errMsg) as { error?: { message?: string; status?: string } };
      if (parsedErr?.error?.message) {
        errMsg = parsedErr.error.message;
      }
    } catch {
      // Keep original errMsg if not JSON
    }
    const fb = getLocalizedFallbackReply({
      language: params.resolvedLanguage,
      cards: params.cards,
      hasExactMatches: params.hasExactMatches,
      lowestDubaiPriceAed: params.lowestDubaiPriceAed,
      selectedCurrency: params.fxInfo.selectedCurrency,
      ratesFromAed: params.ratesFromAed,
      followUpAction: params.followUpAction,
      reason: errMsg,
    });
    return {
      reply: fb.reply,
      aiStatus: 'unavailable',
      aiNotice: fb.aiNotice,
    };
  }
}

// ============================================================================
// 7. Main Recommendation Pipeline Entry Point
// ============================================================================
export async function runDubaiAdvisorRecommendation(
  body: AdvisorRequestBody,
  liveInventoryOverlay: Map<string, LiveInventoryOverlayLike>
): Promise<AdvisorResponsePayload> {
  const startedAt = Date.now();
  const userMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 600) : '';
  const requestedLanguage: AdvisorLanguageMode =
    body.language && VALID_ADVISOR_LANGUAGES.has(body.language) ? body.language : 'auto';
  const prefs =
    body.preferences && typeof body.preferences === 'object' ? body.preferences : {};
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (m) =>
            m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim().length > 0
        )
        .slice(-4)
    : [];
  const previousProjectIds = Array.isArray(body.previousProjectIds)
    ? body.previousProjectIds.filter((id) => typeof id === 'string').slice(0, 6)
    : [];

  const resolvedLanguage = detectAdvisorLanguage(userMessage, requestedLanguage, history);

  const fx = await getCachedFxRates();
  const intent = extractNaturalLanguageIntent(userMessage);

  const selectedCurrency: AdvisorCurrency =
    intent.currency && VALID_CURRENCIES.has(intent.currency)
      ? intent.currency
      : prefs.currency && VALID_CURRENCIES.has(prefs.currency)
      ? prefs.currency
      : 'AED';

  const minBudgetSelected =
    intent.minBudget !== undefined
      ? intent.minBudget
      : typeof prefs.minBudget === 'number' && Number.isFinite(prefs.minBudget) && prefs.minBudget > 0
      ? prefs.minBudget
      : null;

  const maxBudgetSelected =
    intent.maxBudget !== undefined
      ? intent.maxBudget
      : typeof prefs.maxBudget === 'number' && Number.isFinite(prefs.maxBudget) && prefs.maxBudget > 0
      ? prefs.maxBudget
      : null;

  const minBudgetAed =
    minBudgetSelected !== null
      ? convertCurrencyToAed(minBudgetSelected, selectedCurrency, fx.ratesFromAed)
      : null;
  const maxBudgetAed =
    maxBudgetSelected !== null
      ? convertCurrencyToAed(maxBudgetSelected, selectedCurrency, fx.ratesFromAed)
      : null;

  const location = intent.clearLocation
    ? ''
    : intent.location || (typeof prefs.location === 'string' ? prefs.location.trim().slice(0, 80) : '');

  const propertyType =
    intent.propertyType ||
    (typeof prefs.propertyType === 'string' ? prefs.propertyType.trim().slice(0, 40) : '');

  const purpose: AdvisorPurpose =
    intent.purpose || (prefs.purpose as AdvisorPurpose) || '';

  const { projects: allProjects, fromFirestore } =
    await getCatalogProjectsForAdvisor(liveInventoryOverlay);

  const dubaiProjects = allProjects.filter((p) => p.emirate === 'Dubai');
  const pricedDubai = dubaiProjects.filter((p) => p.startingPriceAed > 0);
  const lowestDubaiPriceAed =
    pricedDubai.length > 0
      ? Math.min(...pricedDubai.map((p) => p.startingPriceAed))
      : 450000;

  let shortlist: RankedCandidate[] = [];
  let hasExactMatches = false;

  // Follow-up on previously shown projects ("Compare these three", "Payment plan kya hai?", "इन प्रोजेक्ट्स की तुलना करें")
  const isFollowUpOnCurrent =
    Boolean(intent.followUpAction) &&
    previousProjectIds.length > 0 &&
    !intent.location &&
    intent.maxBudget === undefined &&
    !intent.propertyType;

  if (isFollowUpOnCurrent) {
    const prevSet = new Set(previousProjectIds);
    const limit = /\b(?:three|teen)\b|तीन/i.test(userMessage) ? 3 : 5;
    const prevMatches = dubaiProjects.filter((p) => prevSet.has(p.id)).slice(0, limit);
    if (prevMatches.length > 0) {
      hasExactMatches = true;
      const shortlistReason = localizeMatchReason(resolvedLanguage, 'shortlist', {});
      shortlist = prevMatches.map((p) =>
        scoreProject(
          p,
          {
            minBudgetAed,
            maxBudgetAed,
            location,
            propertyType,
            purpose,
            wantsAffordable: Boolean(intent.wantsAffordable),
          },
          'exact',
          shortlistReason
        )
      );
    }
  }

  // Standard deterministic DB filtering & ranking pass
  if (shortlist.length === 0) {
    const exactMatches: RankedCandidate[] = [];
    for (const p of dubaiProjects) {
      if (maxBudgetAed !== null && (p.startingPriceAed <= 0 || p.startingPriceAed > maxBudgetAed)) {
        continue;
      }
      if (minBudgetAed !== null && (p.startingPriceAed <= 0 || p.startingPriceAed < minBudgetAed)) {
        continue;
      }
      if (location && !doesProjectMatchLocation(p, location)) {
        continue;
      }
      if (propertyType && !doesProjectMatchPropertyType(p, propertyType)) {
        continue;
      }

      const matchReason = localizeMatchReason(resolvedLanguage, 'exact', {
        community: p.community,
        hasLocation: Boolean(location),
        hasMaxBudget: maxBudgetAed !== null,
        propertyType,
        netYieldPct: purpose === 'Rental income' ? p.investment?.netYieldPct : null,
      });

      exactMatches.push(
        scoreProject(
          p,
          {
            minBudgetAed,
            maxBudgetAed,
            location,
            propertyType,
            purpose,
            wantsAffordable: Boolean(intent.wantsAffordable),
          },
          'exact',
          matchReason
        )
      );
    }

    exactMatches.sort((a, b) => b.score - a.score);
    hasExactMatches = exactMatches.length > 0;
    shortlist = exactMatches.slice(0, 5);

    // Fallback to nearby corridors or slight budget flexibility if < 3 exact matches
    if (shortlist.length < 3) {
      const seenIds = new Set(shortlist.map((s) => s.project.id));
      const alternatives: RankedCandidate[] = [];
      const flexMaxAed = maxBudgetAed !== null ? Math.round(maxBudgetAed * 1.35) : null;
      const flexMinAed = minBudgetAed !== null ? Math.round(minBudgetAed * 0.8) : null;

      for (const p of dubaiProjects) {
        if (seenIds.has(p.id) || p.startingPriceAed <= 0) continue;

        const nearbyCorridor = location ? doesProjectMatchNearbyLocation(p, location) : null;
        const exactLocationOk = !location || doesProjectMatchLocation(p, location);
        const typeOk = !propertyType || doesProjectMatchPropertyType(p, propertyType);
        const budgetExactOk =
          (maxBudgetAed === null || p.startingPriceAed <= maxBudgetAed) &&
          (minBudgetAed === null || p.startingPriceAed >= minBudgetAed);
        const budgetFlexOk =
          (flexMaxAed === null || p.startingPriceAed <= flexMaxAed) &&
          (flexMinAed === null || p.startingPriceAed >= flexMinAed);

        if (exactLocationOk && budgetFlexOk && typeOk && !budgetExactOk) {
          const overPct = maxBudgetAed
            ? Math.round(((p.startingPriceAed - maxBudgetAed) / maxBudgetAed) * 100)
            : 0;
          alternatives.push(
            scoreProject(
              p,
              {
                minBudgetAed,
                maxBudgetAed,
                location,
                propertyType,
                purpose,
                wantsAffordable: Boolean(intent.wantsAffordable),
              },
              'alternative',
              localizeMatchReason(
                resolvedLanguage,
                overPct > 0 ? 'budget_over' : 'budget_alt',
                { community: p.community, overPct }
              )
            )
          );
        } else if (nearbyCorridor && budgetExactOk && typeOk) {
          alternatives.push(
            scoreProject(
              p,
              {
                minBudgetAed,
                maxBudgetAed,
                location,
                propertyType,
                purpose,
                wantsAffordable: Boolean(intent.wantsAffordable),
              },
              'alternative',
              localizeMatchReason(resolvedLanguage, 'nearby_budget', {
                nearby: nearbyCorridor,
              })
            )
          );
        } else if (nearbyCorridor && budgetFlexOk && !location.includes('Other')) {
          alternatives.push(
            scoreProject(
              p,
              {
                minBudgetAed,
                maxBudgetAed,
                location,
                propertyType,
                purpose,
                wantsAffordable: Boolean(intent.wantsAffordable),
              },
              'alternative',
              localizeMatchReason(resolvedLanguage, 'nearby_flex', {
                nearby: nearbyCorridor,
              })
            )
          );
        } else if (location && exactLocationOk && budgetExactOk && !typeOk) {
          alternatives.push(
            scoreProject(
              p,
              {
                minBudgetAed,
                maxBudgetAed,
                location,
                propertyType,
                purpose,
                wantsAffordable: Boolean(intent.wantsAffordable),
              },
              'alternative',
              localizeMatchReason(resolvedLanguage, 'diff_config', {
                community: p.community,
              })
            )
          );
        }
      }

      alternatives.sort((a, b) => b.score - a.score);
      for (const alt of alternatives) {
        if (shortlist.length >= 5) break;
        shortlist.push(alt);
      }
    }
  }

  const cards = shortlist.map((item) =>
    buildRecommendationCard(item, selectedCurrency, fx.ratesFromAed)
  );

  const resolvedContext = {
    minBudget: minBudgetSelected,
    maxBudget: maxBudgetSelected,
    minBudgetAed,
    maxBudgetAed,
    currency: selectedCurrency,
    location,
    propertyType,
    purpose,
    language: requestedLanguage,
    detectedLanguage: resolvedLanguage,
  };

  const fxInfo = {
    selectedCurrency,
    rateFromAed: fx.ratesFromAed[selectedCurrency] || 1,
    lastUpdatedAt: fx.lastUpdatedAt,
    source: fx.source,
    isEstimatedConversion: selectedCurrency !== 'AED',
  };

  const aiResult = await generateAdvisorExplanation({
    userMessage:
      userMessage ||
      `Recommend Dubai properties${location ? ` in ${location}` : ''}${
        maxBudgetAed ? ` under AED ${maxBudgetAed.toLocaleString()}` : ''
      }.`,
    history,
    cards,
    resolvedContext,
    fxInfo,
    hasExactMatches,
    followUpAction: intent.followUpAction || null,
    lowestDubaiPriceAed,
    resolvedLanguage,
    ratesFromAed: fx.ratesFromAed,
  });

  const followUpSuggestions = localizeFollowUpSuggestions({
    language: resolvedLanguage,
    cards,
    purpose,
    location,
  });

  const dataSource = fromFirestore
    ? 'firebase_firestore_merged'
    : 'verified_catalog_baseline';

  logServerEvent('info', 'recommendation_generated', {
    durationMs: Date.now() - startedAt,
    recommendationCount: cards.length,
    hasExactMatches,
    aiStatus: aiResult.aiStatus,
    currency: selectedCurrency,
    requestedLanguage,
    resolvedLanguage,
    location: location || 'Any Dubai',
    propertyType: propertyType || 'Any',
    purpose: purpose || 'Unspecified',
    dataSource,
  });

  return {
    ok: true,
    reply: aiResult.reply,
    aiStatus: aiResult.aiStatus,
    aiNotice: aiResult.aiNotice,
    recommendations: cards,
    hasExactMatches,
    detectedLanguage: resolvedLanguage,
    fxInfo,
    resolvedContext,
    followUpSuggestions,
    dataSource,
  };
}
