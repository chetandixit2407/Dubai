import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'crypto';
import firebaseConfig from '../firebase-applet-config.json';
import { INITIAL_PROJECTS } from '../src/data/uaeCatalog.ts';
import { CurrencyCode, Project } from '../src/types/realEstate.ts';
import { CURRENCY_RATES_FROM_AED, EXCHANGE_RATE_UPDATED_AT } from '../src/utils/currency.ts';
import { formatPropertyBhk } from '../src/utils/propertySpecs.ts';

export type AdvisorCurrency = CurrencyCode;

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
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const resp = await fetch('https://open.er-api.com/v6/latest/AED', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeout);

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
    try {
      const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;
      const projectId = firebaseConfig.projectId;
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      if (apiKey && projectId && !projectId.includes('remixed')) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
          projectId
        )}/databases/${encodeURIComponent(dbId)}/documents/projects?pageSize=300&key=${encodeURIComponent(
          apiKey
        )}`;
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

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
        }
      }
    } catch {
      // Keep baseline catalog if Firestore REST endpoint is unreachable
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
    aliases: ['dubai marina', 'marina', 'jbr', 'jumeirah beach residence', 'dubai harbour', 'bluewaters'],
    nearby: ['Jumeirah Lake Towers', 'Al Furjan', 'Downtown Jebel Ali', 'Palm Jumeirah', 'Dubai Maritime City'],
  },
  {
    canonical: 'Downtown Dubai',
    aliases: ['downtown dubai', 'downtown, dubai', 'downtown', 'burj khalifa', 'opera district'],
    nearby: ['Business Bay', 'Sheikh Zayed Road', 'Meydan', 'Al Jaddaf', 'Dubai Creek Harbour'],
  },
  {
    canonical: 'Business Bay',
    aliases: ['business bay', 'bay square', 'marasi'],
    nearby: ['Downtown Dubai', 'Meydan', 'Al Jaddaf', 'Sheikh Zayed Road', 'Dubai Creek Harbour'],
  },
  {
    canonical: 'Jumeirah Village Circle (JVC)',
    aliases: ['jumeirah village circle', 'jvc'],
    nearby: ['Jumeirah Village Triangle', 'Arjan', 'Motor City', 'Sports City', 'Dubailand'],
  },
  {
    canonical: 'Dubai Hills Estate',
    aliases: ['dubai hills estate', 'dubai hills'],
    nearby: ['Meydan', 'Dubailand', 'Arabian Ranches', 'DAMAC Hills', 'Mohammed Bin Rashid City'],
  },
  {
    canonical: 'Palm Jumeirah',
    aliases: ['palm jumeirah', 'the palm', 'palm'],
    nearby: ['Dubai Marina', 'Dubai Maritime City', 'Dubai Islands', 'Jumeirah Lake Towers'],
  },
  {
    canonical: 'Dubai Creek Harbour',
    aliases: ['dubai creek harbour', 'creek harbour', 'creek'],
    nearby: ['Al Jaddaf', 'Meydan', 'Business Bay', 'Downtown Dubai', 'Festival City'],
  },
  {
    canonical: 'Arabian Ranches',
    aliases: ['arabian ranches', 'ranches'],
    nearby: ['DAMAC Hills', 'Dubailand', 'Dubai Hills Estate', 'Motor City', 'Town Square'],
  },
  {
    canonical: 'DAMAC Hills',
    aliases: ['damac hills', 'damac hills 2', 'akoya'],
    nearby: ['Arabian Ranches', 'Motor City', 'Sports City', 'Jumeirah Village Circle (JVC)', 'Dubailand'],
  },
  {
    canonical: 'Dubailand',
    aliases: ['dubailand', 'dlrc', 'dubai land residence complex', 'majan', 'city of arabia', 'liwan'],
    nearby: ['DAMAC Hills', 'Arabian Ranches', 'Meydan', 'Dubai Silicon Oasis', 'Jumeirah Village Circle (JVC)'],
  },
  {
    canonical: 'Al Jaddaf',
    aliases: ['al jaddaf', 'jaddaf', 'healthcare city'],
    nearby: ['Dubai Creek Harbour', 'Business Bay', 'Downtown Dubai', 'Meydan'],
  },
  {
    canonical: 'Meydan',
    aliases: ['meydan', 'meydan horizon', 'mbr city', 'mohammed bin rashid'],
    nearby: ['Business Bay', 'Downtown Dubai', 'Dubai Hills Estate', 'Dubai Creek Harbour', 'Al Jaddaf'],
  },
  {
    canonical: 'Jumeirah Lake Towers',
    aliases: ['jumeirah lake towers', 'jlt'],
    nearby: ['Dubai Marina', 'Al Furjan', 'Jumeirah Village Triangle', 'Discovery Gardens'],
  },
  {
    canonical: 'Jumeirah Village Triangle',
    aliases: ['jumeirah village triangle', 'jvt'],
    nearby: ['Jumeirah Village Circle (JVC)', 'Al Furjan', 'Sports City', 'Motor City'],
  },
  {
    canonical: 'Al Furjan',
    aliases: ['al furjan', 'furjan'],
    nearby: ['Downtown Jebel Ali', 'Jumeirah Lake Towers', 'Dubai Marina', 'Jumeirah Village Triangle'],
  },
  {
    canonical: 'Dubai South',
    aliases: ['dubai south', 'emaar south', 'expo city'],
    nearby: ['Dubai Investment Park', 'Downtown Jebel Ali', 'Al Furjan'],
  },
  {
    canonical: 'Dubai Islands',
    aliases: ['dubai islands', 'deira islands', 'dubai maritime city', 'mina rashid'],
    nearby: ['Al Jaddaf', 'Dubai Creek Harbour', 'Palm Jumeirah'],
  },
  {
    canonical: 'Motor City',
    aliases: ['motor city', 'sports city', 'studio city', 'arjan'],
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
      if (alias.length <= 3) {
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
// 4. Natural Language Entity Extraction (Zero-Token Deterministic NLU)
// ============================================================================
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
  if (u === 'cr' || u === 'crore' || u === 'crores') return Math.round(num * 10_000_000);
  if (u === 'l' || u === 'lac' || u === 'lacs' || u === 'lakh' || u === 'lakhs') {
    return Math.round(num * 100_000);
  }
  if (u === 'm' || u === 'mn' || u === 'million') return Math.round(num * 1_000_000);
  if (u === 'k' || u === 'thousand') return Math.round(num * 1_000);
  return Math.round(num);
}

export function extractNaturalLanguageIntent(message: string): ExtractedQueryIntent {
  const text = (message || '').trim();
  const lower = text.toLowerCase();
  const out: ExtractedQueryIntent = {};

  // Currency detection
  if (
    /₹|\b(?:inr|rs\.?|rupees?|crore|crores|cr|lakh|lakhs|lac|lacs)\b/i.test(text)
  ) {
    out.currency = 'INR';
  } else if (/\$|\busd\b|\bdollars?\b/i.test(text)) {
    out.currency = 'USD';
  } else if (/£|\bgbp\b|\bpounds?\b/i.test(text)) {
    out.currency = 'GBP';
  } else if (/€|\beur\b|\beuros?\b/i.test(text)) {
    out.currency = 'EUR';
  } else if (/\bsar\b|\briyals?\b/i.test(text)) {
    out.currency = 'SAR';
  } else if (/\b(?:aed|dhs|dirhams?)\b/i.test(text)) {
    out.currency = 'AED';
  }

  // Range detection e.g. "between 1M and 2M" or "1M to 2M"
  const rangeMatch = text.match(
    /(?:between|from)?\s*(?:₹|rs\.?|inr|aed|dhs|usd|\$|gbp|£|eur|€|sar)?\s*([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|m|mn|million|k)?\s*(?:to|and|-|–)\s*(?:₹|rs\.?|inr|aed|dhs|usd|\$|gbp|£|eur|€|sar)?\s*([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|m|mn|million|k)?/i
  );
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
    const singlePatterns = [
      /(?:under|below|max|maximum|upto|up to|within|budget(?:\s+of)?|have|around|about)\s*(?:₹|rs\.?|inr|aed|dhs|usd|\$|gbp|£|eur|€|sar)?\s*([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|m|mn|million|k)?/i,
      /(?:₹|rs\.?|inr|aed|dhs|usd|\$|gbp|£|eur|€|sar)\s*([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|m|mn|million|k)?/i,
      /([\d,.]+)\s*(crores?|cr|lakhs?|lacs?|m|mn|million|k)\b/i,
    ];
    for (const pat of singlePatterns) {
      const m = text.match(pat);
      if (m) {
        const val = parseShorthandMoneyToken(m[1], m[2]);
        if (val >= 50_000) {
          out.maxBudget = val;
          if (/above|over|minimum|min\b|at least/i.test(lower)) {
            out.minBudget = val;
            out.maxBudget = null;
          }
          break;
        }
      }
    }
  }

  // Location detection
  for (const def of DUBAI_LOCATIONS) {
    const matched = def.aliases.some((alias) => {
      if (alias.length <= 3) {
        return new RegExp(`\\b${alias}\\b`, 'i').test(text);
      }
      return lower.includes(alias);
    });
    if (matched) {
      out.location = def.canonical;
      break;
    }
  }
  if (!out.location && /\ball dubai\b|\banywhere in dubai\b|\bany location\b/i.test(lower)) {
    out.clearLocation = true;
  }

  // Property type detection
  if (/\bstudio\b/i.test(lower)) out.propertyType = 'Studio';
  else if (/\bpenthouse\b/i.test(lower)) out.propertyType = 'Penthouse';
  else if (/\btownhouse\b/i.test(lower)) out.propertyType = 'Townhouse';
  else if (/\bvilla\b/i.test(lower)) out.propertyType = 'Villa';
  else if (/\b1[\s-]*(?:bed|bedroom|br|bhk)\b/i.test(lower)) out.propertyType = '1 Bedroom';
  else if (/\b2[\s-]*(?:bed|bedroom|br|bhk)\b/i.test(lower)) out.propertyType = '2 Bedroom';
  else if (/\b3[\s-]*(?:bed|bedroom|br|bhk)\b/i.test(lower)) out.propertyType = '3 Bedroom';

  // Purpose detection
  if (/\b(?:rental|rent|yield|roi|tenant|passive income|lease)\b/i.test(lower)) {
    out.purpose = 'Rental income';
  } else if (/\b(?:capital appreciation|appreciation|growth|flip|resale)\b/i.test(lower)) {
    out.purpose = 'Capital appreciation';
  } else if (/\b(?:personal|live|living|family|end[\s-]?use|move[\s-]?in)\b/i.test(lower)) {
    out.purpose = 'Personal living';
  } else if (/\b(?:invest|investment|investor|portfolio)\b/i.test(lower)) {
    out.purpose = 'Investment';
  }

  // Follow-up intent detection
  if (/\bcompare\b/i.test(lower)) out.followUpAction = 'compare';
  else if (/\bpayment\s*plan|installment|down\s*payment\b/i.test(lower)) {
    out.followUpAction = 'payment_plan';
  } else if (/\bhandover|completion|delivery\b/i.test(lower)) {
    out.followUpAction = 'handover';
  } else if (/\b(?:roi|yield|rental return)\b/i.test(lower)) {
    out.followUpAction = 'yield';
  }

  if (/\baffordable|budget|cheap|lowest|entry\b/i.test(lower)) {
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
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!sharedGenAi) {
    sharedGenAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedGenAi;
}

const SYSTEM_INSTRUCTION = `You are the Dubai Property Advisor for White Collar Realty, an expert UAE real estate consultant.
Rules:
1. Recommend ONLY from the shortlisted JSON projects provided. Never invent prices, yields, payment plans, handover dates, or unit availability.
2. Keep responses concise (120-180 words), helpful, and structured.
3. Mention AED price alongside converted currency when currency is not AED, noting conversions are estimates.
4. Never guarantee investment returns or appreciation. If data is "Not available", state it honestly.
5. If alternatives are shown, clearly label them as nearby/budget alternatives. If essential info (like budget or location) is missing, ask one brief follow-up question.`;

async function generateAdvisorExplanation(params: {
  userMessage: string;
  history: AdvisorHistoryMessage[];
  cards: AdvisorRecommendationCard[];
  resolvedContext: AdvisorResponsePayload['resolvedContext'];
  fxInfo: AdvisorResponsePayload['fxInfo'];
  hasExactMatches: boolean;
  followUpAction: ExtractedQueryIntent['followUpAction'];
  lowestDubaiPriceAed: number;
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
    q: params.userMessage.trim().toLowerCase(),
    ctx: params.resolvedContext,
    ids: params.cards.map((c) => c.id),
    act: params.followUpAction,
  });
  const cacheKey = crypto.createHash('sha256').update(cachePayload).digest('hex');

  const hit = aiResponseCache.get(cacheKey);
  if (hit && Date.now() - hit.cachedAtMs < AI_CACHE_TTL_MS) {
    return { reply: hit.reply, aiStatus: 'cached' };
  }

  const ai = getGeminiClient();
  if (!ai) {
    return {
      reply:
        params.cards.length > 0
          ? params.hasExactMatches
            ? `Found ${params.cards.length} verified Dubai project${
                params.cards.length > 1 ? 's' : ''
              } matching your criteria in our database. Review the project cards below for verified AED pricing, payment plans, and yields.`
            : `No exact matches fit all filters, so here ${
                params.cards.length === 1 ? 'is 1 verified nearby or flexible-budget alternative' : `are ${params.cards.length} verified nearby or flexible-budget alternatives`
              } from our database.`
          : `No verified Dubai projects matched those exact filters in our database (verified Dubai projects start from ${formatMoneyForAdvisor(
              params.lowestDubaiPriceAed,
              'AED'
            )}). Try increasing your budget or selecting All Dubai.`,
      aiStatus: 'unavailable',
      aiNotice:
        'AI narrative requires GEMINI_API_KEY in server environment secrets; showing deterministic verified database matches.',
    };
  }

  const recentHistory = params.history
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Client' : 'Advisor'}: ${m.content.slice(0, 260)}`)
    .join('\n');

  const promptPayload = {
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

    const text = response.text?.trim();
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
    const errMsg = err instanceof Error ? err.message : 'Gemini service unavailable';
    return {
      reply:
        params.cards.length > 0
          ? `Showing ${params.cards.length} verified Dubai project${
              params.cards.length > 1 ? 's' : ''
            } ranked from our database for your criteria.`
          : 'No matching Dubai projects found in the database for these exact filters.',
      aiStatus: 'unavailable',
      aiNotice: `AI explanation temporarily unavailable (${errMsg.slice(
        0,
        120
      )}). Verified database matches are shown below.`,
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
  const userMessage = typeof body.message === 'string' ? body.message.trim().slice(0, 600) : '';
  const prefs = body.preferences || {};
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

  // Follow-up on previously shown projects ("Compare these three", "What is the payment plan?")
  const isFollowUpOnCurrent =
    Boolean(intent.followUpAction) &&
    previousProjectIds.length > 0 &&
    !intent.location &&
    intent.maxBudget === undefined &&
    !intent.propertyType;

  if (isFollowUpOnCurrent) {
    const prevSet = new Set(previousProjectIds);
    const limit = /\bthree\b/i.test(userMessage) ? 3 : 5;
    const prevMatches = dubaiProjects.filter((p) => prevSet.has(p.id)).slice(0, limit);
    if (prevMatches.length > 0) {
      hasExactMatches = true;
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
          'From your current shortlisted comparison'
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

      const reasons: string[] = [];
      if (location) reasons.push(`Located in ${p.community}`);
      if (maxBudgetAed !== null) reasons.push('Within your budget');
      if (propertyType) reasons.push(`Offers ${propertyType}`);
      if (purpose === 'Rental income' && p.investment?.netYieldPct) {
        reasons.push(`${p.investment.netYieldPct}% est. net yield`);
      }

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
          reasons.slice(0, 2).join(' · ') || 'Matches your Dubai search criteria'
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
              overPct > 0
                ? `Budget alternative (+${overPct}% above target in ${p.community})`
                : `Budget alternative in ${p.community}`
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
              `Nearby corridor (${nearbyCorridor}) within your budget`
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
              `Nearby corridor (${nearbyCorridor}) · flexible budget match`
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
              `In ${p.community} within budget (different unit configuration)`
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
  });

  const followUpSuggestions: string[] = [];
  if (cards.length >= 2) {
    followUpSuggestions.push('Compare these projects');
    followUpSuggestions.push('What is the payment plan?');
  }
  if (purpose !== 'Rental income') {
    followUpSuggestions.push('Which offers the best rental yield?');
  }
  if (!location) {
    followUpSuggestions.push('Show options in Business Bay or JVC');
  }

  return {
    ok: true,
    reply: aiResult.reply,
    aiStatus: aiResult.aiStatus,
    aiNotice: aiResult.aiNotice,
    recommendations: cards,
    hasExactMatches,
    fxInfo,
    resolvedContext,
    followUpSuggestions: followUpSuggestions.slice(0, 3),
    dataSource: fromFirestore ? 'firebase_firestore_merged' : 'verified_catalog_baseline',
  };
}
