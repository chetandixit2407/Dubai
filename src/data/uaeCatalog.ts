import {
  Developer,
  InventoryLog,
  Project,
  SyncProvider,
} from '../types/realEstate.ts';
import {
  EXCEL_182_DEVELOPERS,
  EXCEL_182_IMPORT_REPORT,
  EXCEL_182_PROJECTS,
  LEGACY_SAMPLE_IDS,
} from './excel182Projects.ts';

export const IMG_HERO_DUBAI = '/src/assets/images/hero_dubai_skyline_1795520080359.jpg';

export { EXCEL_182_IMPORT_REPORT, LEGACY_SAMPLE_IDS };

export const INITIAL_DEVELOPERS: Developer[] = EXCEL_182_DEVELOPERS;

export const INITIAL_PROJECTS: Project[] = EXCEL_182_PROJECTS;

export const INITIAL_SYNC_PROVIDERS: SyncProvider[] = [
  {
    id: 'provider-dld-rest',
    name: 'Dubai Land Department / Mashrooi Feed',
    providerType: 'dld_registry',
    endpointUrl: 'https://api.dubailand.gov.ae/v2/projects/registry',
    syncFrequencyMinutes: 30,
    enabled: true,
    lastSyncAt: '2026-11-24T10:12:00Z',
    lastStatus: 'healthy',
    recordsSynced: 159,
  },
  {
    id: 'provider-emaar-crm',
    name: 'Emaar Partner Inventory API',
    providerType: 'developer_api',
    endpointUrl: 'https://partners.emaar.com/api/inventory/v1',
    syncFrequencyMinutes: 15,
    enabled: true,
    lastSyncAt: '2026-11-24T10:15:00Z',
    lastStatus: 'healthy',
    recordsSynced: 19,
  },
  {
    id: 'provider-aldar-portal',
    name: 'Aldar Broker Allocation Feed',
    providerType: 'developer_api',
    endpointUrl: 'https://broker.aldar.com/feeds/unit-availability',
    syncFrequencyMinutes: 30,
    enabled: true,
    lastSyncAt: '2026-11-24T08:50:00Z',
    lastStatus: 'healthy',
    recordsSynced: 11,
  },
  {
    id: 'provider-srerd-uae',
    name: 'Sharjah SRERD & Northern Emirates Registry',
    providerType: 'uae_authority',
    endpointUrl: 'https://opendata.srerd.gov.ae/projects',
    syncFrequencyMinutes: 120,
    enabled: true,
    lastSyncAt: '2026-11-23T18:00:00Z',
    lastStatus: 'warning',
    lastError: 'Project-level metadata synced; unit-level sales feed not exposed by authority.',
    recordsSynced: 10,
  },
  {
    id: 'provider-wc-crm',
    name: 'White Collar Realty Official Catalog Sync',
    providerType: 'broker_crm',
    endpointUrl: '/api/sync/webhook/provider-wc-crm',
    syncFrequencyMinutes: 5,
    enabled: true,
    lastSyncAt: '2026-11-24T12:00:00Z',
    lastStatus: 'healthy',
    recordsSynced: 182,
  },
];

export const INITIAL_INVENTORY_LOGS: InventoryLog[] = [];
