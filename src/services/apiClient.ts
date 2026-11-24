import { auth } from '../lib/firebase.ts';
import { ExcelImportReport, Project } from '../types/realEstate.ts';

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
    if (!res.ok) return { mapsApiKey: '' };
    return await res.json();
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Sync execution failed');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Webhook push failed');
  }
  return data;
}

export async function parseBulkCsvOnServer(csvText: string, existingSlugs: string[]) {
  const headers = await getOptionalAuthHeaders();
  const res = await fetch('/api/import/parse-csv', {
    method: 'POST',
    headers,
    body: JSON.stringify({ csvText, existingSlugs }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'CSV parsing failed');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Excel import parsing failed');
  }
  return data as ExcelUploadResponse;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to retrieve project metadata from URL');
  }
  return data as ProjectUrlRetrievalResponse;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Investment calculation failed');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to scan project tours');
  }
  return data;
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to check tour link');
  }
  return data;
}

export async function fetchCompanyInfoServer(): Promise<any> {
  const res = await fetch('/api/company-info');
  if (!res.ok) throw new Error('Failed to fetch company info');
  return res.json();
}

