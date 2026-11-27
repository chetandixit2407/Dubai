import { auth } from '../lib/firebase.ts';
import {
  AdvisorLanguagePreference,
  AdvisorResolvedLanguage,
  ExcelImportReport,
  Project,
} from '../types/realEstate.ts';

export class ApiClientError extends Error {
  status: number;
  contentType: string;

  constructor(message: string, status: number, contentType: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.contentType = contentType;
  }
}

export async function parseApiResponse<T>(
  res: Response,
  fallbackErrorMessage = 'API request failed'
): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  let rawText = '';

  try {
    rawText = await res.text();
  } catch {
    throw new ApiClientError(
      `${fallbackErrorMessage}: unable to read server response (HTTP ${res.status}).`,
      res.status,
      contentType
    );
  }

  const trimmed = rawText.trim();
  const isJsonContentType =
    contentType.includes('application/json') || contentType.includes('+json');
  const looksLikeHtml =
    contentType.includes('text/html') ||
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed);
  const looksLikeVercelNotFound =
    /the page could not be found/i.test(trimmed) ||
    /vercel.*not[_\s-]?found/i.test(trimmed);

  if (looksLikeHtml || looksLikeVercelNotFound) {
    if (res.status === 404 || looksLikeVercelNotFound) {
      throw new ApiClientError(
        `${fallbackErrorMessage}: API endpoint not found (HTTP 404). Please verify the backend API routing.`,
        res.status || 404,
        contentType
      );
    }
    throw new ApiClientError(
      `${fallbackErrorMessage}: server returned an HTML page instead of JSON (HTTP ${res.status}).`,
      res.status,
      contentType
    );
  }

  if (!trimmed) {
    throw new ApiClientError(
      res.ok
        ? `${fallbackErrorMessage}: server returned an empty response.`
        : `${fallbackErrorMessage} (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}).`,
      res.status,
      contentType
    );
  }

  if (!isJsonContentType) {
    try {
      const parsed = JSON.parse(trimmed) as T & { error?: unknown; message?: unknown };
      if (!res.ok) {
        const serverMsg =
          typeof parsed?.error === 'string' && parsed.error.trim()
            ? parsed.error
            : typeof parsed?.message === 'string' && parsed.message.trim()
            ? parsed.message
            : `${fallbackErrorMessage} (HTTP ${res.status})`;
        throw new ApiClientError(serverMsg, res.status, contentType);
      }
      return parsed;
    } catch (err) {
      if (err instanceof ApiClientError) throw err;
      const preview = trimmed.replace(/\s+/g, ' ').slice(0, 140);
      if (res.status >= 500 || /FUNCTION_INVOCATION_FAILED|A server error has occurred/i.test(trimmed)) {
        throw new ApiClientError(
          `${fallbackErrorMessage}: server error (HTTP ${res.status || 500}${preview ? ` — ${preview}` : ''}).`,
          res.status || 500,
          contentType
        );
      }
      throw new ApiClientError(
        `${fallbackErrorMessage}: expected JSON response but received "${contentType || 'unknown'}" (HTTP ${res.status}${preview ? ` — ${preview}` : ''}).`,
        res.status,
        contentType
      );
    }
  }

  let parsed: T & { error?: unknown; message?: unknown };
  try {
    parsed = JSON.parse(trimmed) as T & { error?: unknown; message?: unknown };
  } catch {
    throw new ApiClientError(
      `${fallbackErrorMessage}: received invalid JSON from server (HTTP ${res.status}).`,
      res.status,
      contentType
    );
  }

  if (!res.ok) {
    const serverMsg =
      typeof parsed?.error === 'string' && parsed.error.trim()
        ? parsed.error
        : typeof parsed?.message === 'string' && parsed.message.trim()
        ? parsed.message
        : `${fallbackErrorMessage} (HTTP ${res.status})`;
    throw new ApiClientError(serverMsg, res.status, contentType);
  }

  return parsed;
}

async function getOptionalAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchClientConfig(): Promise<{ mapsApiKey: string }> {
  const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey) {
    return { mapsApiKey: envKey };
  }
  try {
    const res = await fetch('/api/client-config');
    return await parseApiResponse<{ mapsApiKey: string }>(
      res,
      'Failed to load client configuration'
    );
  } catch {
    return { mapsApiKey: '' };
  }
}

export async function broadcastRealtimeEvent(
  eventType: 'inventory:updated' | 'sync:completed' | 'enquiry:created' | 'project:updated',
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const headers = await getOptionalAuthHeaders();
    if (!headers['Authorization']) return;
    await fetch('/api/events/broadcast', {
      method: 'POST',
      headers,
      body: JSON.stringify({ eventType, payload }),
    });
  } catch {
    // Non-blocking broadcast failure
  }
}

export async function notifyPublicEnquiryCreated(
  enquiryType: string,
  projectName?: string
): Promise<void> {
  try {
    await fetch('/api/enquiries/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enquiryType, projectName }),
    });
  } catch {
    // Non-blocking notification
  }
}

export async function triggerServerSyncRun(params: {
  providerId: string;
  providerName: string;
  endpointUrl: string;
  targetProjectId?: string;
  currentInventory?: unknown;
}) {
  const headers = await getOptionalAuthHeaders();
  const res = await fetch('/api/sync/run', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseApiResponse<any>(res, 'Sync execution failed');
}

export async function triggerWebhookTest(params: {
  providerId: string;
  projectId: string;
  availableUnits: number;
  soldUnits: number;
  reservedUnits: number;
  totalRegisteredUnits: number;
  source: string;
}) {
  const res = await fetch(`/api/sync/webhook/${encodeURIComponent(params.providerId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseApiResponse<any>(res, 'Webhook push failed');
}

export async function parseBulkCsvOnServer(csvText: string, existingSlugs: string[]) {
  const headers = await getOptionalAuthHeaders();
  const res = await fetch('/api/import/parse-csv', {
    method: 'POST',
    headers,
    body: JSON.stringify({ csvText, existingSlugs }),
  });
  return parseApiResponse<any>(res, 'CSV parsing failed');
}

export interface ExcelUploadResponse {
  ok: boolean;
  batchId: string;
  projects: Project[];
  report: ExcelImportReport;
}

export async function uploadExcelWorkbookOnServer(params: {
  fileBase64: string;
  fileName: string;
  existingProjects: Array<Record<string, unknown>>;
}): Promise<ExcelUploadResponse> {
  const headers = await getOptionalAuthHeaders();
  const res = await fetch('/api/import/excel', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseApiResponse<ExcelUploadResponse>(res, 'Excel import parsing failed');
}

export interface ProjectUrlRetrievalResponse {
  ok: boolean;
  projectId: string;
  projectName: string;
  sourceHost: string;
  description: string;
  brochureUrl: string;
  tourEmbedUrl: string;
  startingPriceAed: number | null;
  verifiedImages: Array<{
    url: string;
    imageHash: string;
    classification: 'actual_photograph' | 'developer_render';
    sourceName: string;
  }>;
  skippedDuplicates: number;
}

export async function retrieveProjectFromUrlOnServer(params: {
  projectId: string;
  projectName: string;
  projectUrl: string;
  existingHashes: string[];
}): Promise<ProjectUrlRetrievalResponse> {
  const headers = await getOptionalAuthHeaders();
  const res = await fetch('/api/projects/retrieve-from-url', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return parseApiResponse<ProjectUrlRetrievalResponse>(
    res,
    'Failed to retrieve project metadata from URL'
  );
}

export interface InvestmentAnalysisResponse {
  outputs: {
    downPaymentAed: number;
    financedPrincipalAed: number;
    monthlyInstallmentAed: number;
    dldFeeAed: number;
    agencyFeeAed: number;
    trusteeAndAdminAed: number;
    totalAcquisitionCostAed: number;
    estimatedAnnualRentalIncomeAed: number;
    netAnnualRentalIncomeAed: number;
    grossYieldPct: number;
    netYieldPct: number;
    estimated5YrTotalRoiPct: number;
  };
  fiveYearProjection: Array<{
    year: string;
    propertyValueAed: number;
    cumulativeNetRentAed: number;
    estimatedRoiPct: number;
  }>;
  assumptions: string[];
}

export async function analyzeInvestmentOnServer(
  input: Record<string, unknown>
): Promise<InvestmentAnalysisResponse> {
  const res = await fetch('/api/investment/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseApiResponse<InvestmentAnalysisResponse>(res, 'Investment calculation failed');
}

export interface TourScanItem {
  projectId: string;
  projectName: string;
  developerName: string;
  tourUrl: string;
  tourProvider: string;
  verificationStatus: 'verified' | 'awaiting_verification' | 'broken' | 'unavailable';
  lastCheckedDate: string;
  embedAvailable: boolean;
  errorStatus: string;
  category: string;
  emirate: string;
}

export interface TourScanResponse {
  totalScanned: number;
  verifiedCount: number;
  awaitingCount: number;
  unavailableCount: number;
  brokenCount: number;
  embeddableCount: number;
  scannedAt: string;
  results: TourScanItem[];
}

export async function scanAllProjectTours(probeNetwork = false): Promise<TourScanResponse> {
  const res = await fetch('/api/tours/scan-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ probeNetwork }),
  });
  return parseApiResponse<TourScanResponse>(res, 'Failed to scan project tours');
}

export interface TourLinkCheckResult {
  url: string;
  status: number;
  reachable: boolean;
  embedAvailable: boolean;
  xfo: string;
  csp: string;
  reason?: string;
  error?: string;
}

export async function checkTourLink(url: string): Promise<TourLinkCheckResult> {
  const res = await fetch('/api/tours/check-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return parseApiResponse<TourLinkCheckResult>(res, 'Failed to check tour link');
}

export async function fetchCompanyInfoServer(): Promise<any> {
  const res = await fetch('/api/company-info');
  return parseApiResponse<any>(res, 'Failed to fetch company info');
}

export async function refreshProjectTelemetryOnServer(projectId?: string): Promise<{
  ok: boolean;
  projectId?: string;
  projectName?: string;
  totalRefreshed?: number;
  lastVerifiedAt?: string;
  source?: string;
  status: string;
  message?: string;
  inventory?: LiveInventoryOverlayRecord | null;
}> {
  const res = await fetch('/api/projects/refresh-telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
  return parseApiResponse<{
    ok: boolean;
    projectId?: string;
    projectName?: string;
    totalRefreshed?: number;
    lastVerifiedAt?: string;
    source?: string;
    status: string;
    message?: string;
    inventory?: LiveInventoryOverlayRecord | null;
  }>(res, 'Failed to refresh telemetry');
}

export async function fetchCompletenessReportServer(): Promise<{
  totalProperties: number;
  fullyVerifiedProfiles: number;
  propertiesWithVerifiedPhotos: number;
  propertiesWith3dVirtualTours: number;
  propertiesAwaiting3dTourRelease: number;
  propertiesWithFloorPlans: number;
  propertiesWithNearbyLandmarks: number;
  propertiesWithSalesOfficeContacts: number;
  emiratesBreakdown: Record<string, number>;
  generatedAt: string;
  standards: string;
}> {
  const res = await fetch('/api/projects/completeness-report');
  return parseApiResponse(res, 'Failed to fetch completeness report');
}

export interface GeocodeResultItem {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  granularity?: string;
}

export async function geocodeAddressOnServer(
  address: string,
  region: 'ae' | 'in' | 'any' = 'ae'
): Promise<{
  ok: boolean;
  query: string;
  results: GeocodeResultItem[];
  primary: GeocodeResultItem;
}> {
  const params = new URLSearchParams({
    address: address.trim(),
    region,
  });
  const res = await fetch(`/api/geocode?${params.toString()}`);
  return parseApiResponse(res, 'Unable to locate address via Google Geocoding');
}

export interface LiveInventoryOverlayRecord {
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

export async function fetchLiveInventoryUpdates(): Promise<{
  updates: Record<string, LiveInventoryOverlayRecord>;
  telemetryCheckedAt: Record<string, string>;
}> {
  try {
    const res = await fetch('/api/inventory/live-updates');
    return await parseApiResponse<{
      updates: Record<string, LiveInventoryOverlayRecord>;
      telemetryCheckedAt: Record<string, string>;
    }>(res, 'Failed to fetch live inventory updates');
  } catch {
    return { updates: {}, telemetryCheckedAt: {} };
  }
}

export async function fetchProjectInventoryStatus(projectId: string): Promise<{
  ok: boolean;
  projectId: string;
  projectName: string;
  inventory: LiveInventoryOverlayRecord;
  lastVerifiedAt: string;
  contactRequired: boolean;
  contactMessage: string;
}> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/inventory`);
  return parseApiResponse(res, 'Failed to fetch project inventory');
}

export interface ServerFxRatesResponse {
  ok: boolean;
  base: 'AED';
  ratesFromAed: Record<string, number>;
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
  currency: 'AED' | 'USD' | 'INR' | 'GBP' | 'EUR' | 'SAR';
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

export interface DubaiAdvisorResponse {
  ok: boolean;
  reply: string;
  aiStatus: 'ok' | 'cached' | 'unavailable';
  aiNotice?: string;
  recommendations: AdvisorRecommendationCard[];
  hasExactMatches: boolean;
  detectedLanguage?: AdvisorResolvedLanguage;
  fxInfo: {
    selectedCurrency: 'AED' | 'USD' | 'INR' | 'GBP' | 'EUR' | 'SAR';
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
    currency: 'AED' | 'USD' | 'INR' | 'GBP' | 'EUR' | 'SAR';
    location: string;
    propertyType: string;
    purpose: string;
    language?: AdvisorLanguagePreference;
    detectedLanguage?: AdvisorResolvedLanguage;
  };
  followUpSuggestions: string[];
  dataSource: 'firebase_firestore_merged' | 'verified_catalog_baseline';
}

export async function fetchServerFxRates(): Promise<ServerFxRatesResponse> {
  const res = await fetch('/api/fx-rates');
  return parseApiResponse<ServerFxRatesResponse>(res, 'Failed to fetch FX rates');
}

export async function fetchDubaiAdvisorRecommendations(params: {
  message: string;
  preferences: {
    minBudget?: number | null;
    maxBudget?: number | null;
    currency: 'AED' | 'USD' | 'INR' | 'GBP' | 'EUR' | 'SAR';
    location: string;
    propertyType: string;
    purpose: string;
  };
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  previousProjectIds: string[];
  language?: AdvisorLanguagePreference;
}): Promise<DubaiAdvisorResponse> {
  const res = await fetch('/api/ai/property-recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return parseApiResponse<DubaiAdvisorResponse>(
    res,
    'Failed to get property recommendations'
  );
}
