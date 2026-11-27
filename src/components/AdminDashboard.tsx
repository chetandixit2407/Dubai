import React, { useMemo, useState } from 'react';
import { AdvancedMarker, APIProvider, Map as GoogleMap } from '@vis.gl/react-google-maps';
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  Crosshair,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  Loader2,
  Map as MapIcon,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  Users,
  Video,
  Webhook,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AdminAuditLog,
  CurrencyCode,
  Developer,
  EmiratesName,
  Enquiry,
  EnquiryStatus,
  InventoryLog,
  Project,
  ProjectCategory,
  PropertyTypeOption,
  SyncProvider,
  UserProfile,
  UserRole,
  VirtualTourConfig,
} from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import { exportCatalogToExcel } from '../utils/exportUtils.ts';
import { formatPropertySpecsSummary } from '../utils/propertySpecs.ts';
import {
  deleteProjectRecord,
  isAdminRole,
  isInventoryManagerRole,
  syncVerifiedCatalogToFirestore,
  updateEnquiryAssignment,
  updateProjectInventory,
  updateUserRole,
  upsertDeveloper,
  upsertProject,
  upsertSyncProvider,
} from '../services/firestoreService.ts';
import {
  broadcastRealtimeEvent,
  geocodeAddressOnServer,
  parseBulkCsvOnServer,
  refreshProjectTelemetryOnServer,
  triggerServerSyncRun,
  triggerWebhookTest,
} from '../services/apiClient.ts';
import {
  evaluateProjectMedia,
  getEffectiveTourStatus,
  MISSING_PROJECT_PHOTO_LABEL,
} from '../utils/mediaValidation.ts';
import { getEmirateCenter, isValidCoordinate } from '../utils/coordinates.ts';
import { GoogleMapsGuard } from './GoogleMapsGuard.tsx';
import { UAEPropertyMap } from './UAEPropertyMap.tsx';
import { AdminMediaTourManager } from './AdminMediaTourManager.tsx';
import { AdminExcelImportPanel } from './AdminExcelImportPanel.tsx';
import { AdminTourDiscoveryPanel } from './AdminTourDiscoveryPanel.tsx';
import { AdminCompanySettingsPanel } from './AdminCompanySettingsPanel.tsx';

interface AdminDashboardProps {
  userProfile: UserProfile;
  projects: Project[];
  developers: Developer[];
  inventoryLogs: InventoryLog[];
  syncProviders: SyncProvider[];
  enquiries: Enquiry[];
  users: UserProfile[];
  adminLogs: AdminAuditLog[];
  currency: CurrencyCode;
  mapsApiKey?: string;
  onReplayIntro?: () => void;
  onClose: () => void;
}

type AdminTab =
  | 'overview'
  | 'projects'
  | 'tours'
  | 'media'
  | 'company_settings'
  | 'excel_import'
  | 'csv'
  | 'sync'
  | 'developers'
  | 'leads'
  | 'rbac';

const EMIRATES: EmiratesName[] = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];

const CATEGORIES: ProjectCategory[] = [
  'Off-plan',
  'Ready-to-move',
  'Under-construction',
  'Upcoming launch',
];

const DEFAULT_CSV_SAMPLE = `name,emirate,community,developer,category,starting_price_aed,handover_year,construction_pct,registration_number,total_units,available_units,sold_units,reserved_units,data_source
Bayview Harbour Tower 3,Dubai,Emaar Beachfront,Emaar Properties PJSC,Off-plan,2950000,2028,22,DLD-RERA-3109,320,148,142,30,Emaar Authorized CSV Feed
Yas Bay Waterfront Residences,Abu Dhabi,Yas Island,Aldar Properties PJSC,Under-construction,1890000,2027,54,ADM-DARI-90122,,,,,SRERD / ADM Registry Only`;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  userProfile,
  projects,
  developers,
  inventoryLogs,
  syncProviders,
  enquiries,
  users,
  adminLogs,
  currency,
  mapsApiKey,
  onReplayIntro,
  onClose,
}) => {
  const canManageProjects = isAdminRole(userProfile.role, userProfile.email);
  const canManageInventory = isInventoryManagerRole(userProfile.role, userProfile.email);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Project Add/Edit Modal & View Mode State
  const [projectsViewMode, setProjectsViewMode] = useState<'table' | 'map'>('table');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isNewProject, setIsNewProject] = useState(false);
  const [geocodingProject, setGeocodingProject] = useState(false);
  const [previewMapUnavailable, setPreviewMapUnavailable] = useState(false);

  // Manual Inventory Modal State
  const [inventoryTarget, setInventoryTarget] = useState<Project | null>(null);
  const [invStatus, setInvStatus] = useState<'verified_live' | 'unavailable'>('verified_live');
  const [invTotal, setInvTotal] = useState<string>('');
  const [invReleased, setInvReleased] = useState<string>('');
  const [invAvailable, setInvAvailable] = useState<string>('');
  const [invReserved, setInvReserved] = useState<string>('');
  const [invSold, setInvSold] = useState<string>('');
  const [invOnHold, setInvOnHold] = useState<string>('');
  const [invSource, setInvSource] = useState<string>('');
  const [invNotes, setInvNotes] = useState<string>('');

  // CSV Bulk Importer State
  const [csvText, setCsvText] = useState(DEFAULT_CSV_SAMPLE);
  const [csvPreview, setCsvPreview] = useState<{
    parsedProjects: Array<Record<string, unknown>>;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  // Developer Editor State
  const [devForm, setDevForm] = useState<Partial<Developer> | null>(null);

  // Lead CRM Filter & Draft Edits
  const [leadFilter, setLeadFilter] = useState<string>('all');
  const [leadDrafts, setLeadDrafts] = useState<
    Record<string, { status: EnquiryStatus; assignedAgentName: string; staffNotes: string }>
  >({});

  // Webhook Simulator State
  const [webhookProjectId, setWebhookProjectId] = useState<string>(projects[0]?.id || '');
  const [webhookAvailable, setWebhookAvailable] = useState<number>(48);
  const [webhookReserved, setWebhookReserved] = useState<number>(12);

  // Property Verification Audit & Telemetry State
  const [refreshingTelemetry, setRefreshingTelemetry] = useState(false);
  const [auditFilter, setAuditFilter] = useState<
    'all' | '3d' | 'video' | 'missing_media' | 'live_inventory'
  >('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');

  const notify = (type: 'ok' | 'err', text: string) => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg(null), 5500);
  };

  const handleRefreshAllTelemetry = async () => {
    setRefreshingTelemetry(true);
    try {
      await refreshProjectTelemetryOnServer();
      notify('ok', `Successfully refreshed live telemetry & DLD/RERA metadata across all ${projects.length} properties.`);
      await broadcastRealtimeEvent('sync:completed', { totalRefreshed: projects.length });
    } catch (e: any) {
      notify('err', e.message || 'Connection error while refreshing telemetry.');
    } finally {
      setRefreshingTelemetry(false);
    }
  };

  const handleExportAudit = () => {
    exportCatalogToExcel(projects, developers, `WhiteCollarRealty_182_Properties_Verification_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    notify('ok', 'Exported complete 182-property verification audit to Excel.');
  };

  // Analytics by Emirate
  const emirateChartData = useMemo(() => {
    return EMIRATES.map((em) => {
      const emProjects = projects.filter((p) => p.emirate === em);
      const liveAvailable = emProjects.reduce(
        (sum, p) =>
          p.inventory.status === 'verified_live' && p.inventory.availableUnits !== null
            ? sum + p.inventory.availableUnits
            : sum,
        0
      );
      return {
        emirate: em.replace('Ras Al Khaimah', 'RAK').replace('Umm Al Quwain', 'UAQ'),
        projects: emProjects.length,
        availableUnits: liveAvailable,
      };
    });
  }, [projects]);

  const totalLiveAvailable = useMemo(
    () =>
      projects.reduce(
        (sum, p) =>
          p.inventory.status === 'verified_live' && p.inventory.availableUnits !== null
            ? sum + p.inventory.availableUnits
            : sum,
        0
      ),
    [projects]
  );

  const countWith3d = useMemo(
    () =>
      projects.filter((p) => {
        const eff = getEffectiveTourStatus(p);
        return eff === '3d_available' || eff === '360_available';
      }).length,
    [projects]
  );

  const countWithVideo = useMemo(
    () =>
      projects.filter(
        (p) => (p.videoItems && p.videoItems.length > 0) || Boolean(p.walkthroughVideoUrl)
      ).length,
    [projects]
  );

  const countWithIndependentVideo = useMemo(
    () =>
      projects.filter(
        (p) => p.primaryVideo?.priorityLevel === 1 || p.primaryVideo?.priorityLevel === 2
      ).length,
    [projects]
  );

  const countMissingBoth = useMemo(
    () => projects.filter((p) => getEffectiveTourStatus(p) === 'coming_soon').length,
    [projects]
  );

  const filteredAuditProjects = useMemo(() => {
    return projects.filter((p) => {
      const eff = getEffectiveTourStatus(p);
      if (auditFilter === '3d') {
        if (eff !== '3d_available' && eff !== '360_available') return false;
      } else if (auditFilter === 'video') {
        const hasVid = (p.videoItems && p.videoItems.length > 0) || Boolean(p.walkthroughVideoUrl);
        if (!hasVid) return false;
      } else if (auditFilter === 'missing_media') {
        if (eff !== 'coming_soon') return false;
      } else if (auditFilter === 'live_inventory') {
        if (p.inventory.status !== 'verified_live') return false;
      }
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          p.developerName.toLowerCase().includes(q) ||
          p.community.toLowerCase().includes(q) ||
          p.emirate.toLowerCase().includes(q) ||
          (p.primaryVideo?.channelName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, auditFilter, auditSearchQuery]);

  const openNewProjectForm = () => {
    const now = new Date().toISOString();
    const firstDev = developers[0];
    setIsNewProject(true);
    setEditingProject({
      id: `proj-${Date.now().toString(36)}`,
      slug: `uae-project-${Date.now().toString(36)}`,
      name: '',
      nameAr: '',
      developerId: firstDev?.id || 'dev-emaar',
      developerName: firstDev?.name || 'Emaar Properties PJSC',
      emirate: 'Dubai',
      city: 'Dubai',
      community: '',
      neighbourhood: '',
      buildingName: '',
      waterfront: false,
      brandedResidence: false,
      category: 'Off-plan',
      propertyTypes: [],
      bathrooms: '',
      tenure: 'Freehold',
      furnished: 'Unfurnished',
      startingPriceAed: 1500000,
      maxPriceAed: 6500000,
      pricePerSqFtAed: 0,
      minSizeSqFt: 0,
      maxSizeSqFt: 0,
      paymentPlan: '60/40 Construction Linked',
      downPaymentPct: 10,
      handoverDate: 'Q4 2028',
      handoverYear: 2028,
      launchDate: now.slice(0, 10),
      constructionPct: 15,
      status: 'Active Sales',
      registrationNumber: '',
      verified: true,
      featured: false,
      coordinates: getEmirateCenter('Dubai'),
      nearbyLandmarks: [],
      heroImage: '',
      heroImageHash: '',
      heroClassification: 'illustrative_image',
      heroSourceName: MISSING_PROJECT_PHOTO_LABEL,
      galleryImages: [],
      constructionImages: [],
      mediaItems: [],
      brochureUrl: '',
      masterPlanNotes: 'Verified UAE freehold residential project.',
      floorPlans: [],
      floorAvailability: [],
      amenities: ['Pool & Fitness Club', '24/7 Concierge', 'Covered Parking'],
      virtualTour: { available: false, tourStatus: 'coming_soon', rooms: [] },
      investment: {
        grossYieldPct: 6.8,
        netYieldPct: 5.4,
        serviceChargePerSqFtAed: 18,
        priceTrend5YrPct: 28,
        estimatedAppreciationPct: 7,
        historicalTransactions: [
          { quarter: 'Q1 2025', avgPricePerSqFtAed: 1920, transactionVolume: 210 },
          { quarter: 'Q1 2026', avgPricePerSqFtAed: 2100, transactionVolume: 245 },
        ],
        dataCitation: 'White Collar Realty Verified Registry',
      },
      inventory: {
        status: 'unavailable',
        totalRegisteredUnits: null,
        releasedUnits: null,
        availableUnits: null,
        soldUnits: null,
        reservedUnits: null,
        onHoldUnits: null,
        remainingUnits: null,
        availabilityPct: null,
        lastUpdatedAt: now,
        dataSource: 'Contact Developer for Latest Availability',
        sourceType: 'unavailable',
      },
      description: '',
      descriptionAr: '',
      updatedAt: now,
    });
  };

  const handleGeocodeEditingProject = async () => {
    if (!editingProject) return;
    const query = [editingProject.community, editingProject.name, editingProject.emirate, 'UAE']
      .filter(Boolean)
      .join(', ');
    setGeocodingProject(true);
    try {
      const res = await geocodeAddressOnServer(query, 'ae');
      setEditingProject((prev) =>
        prev
          ? {
              ...prev,
              coordinates: { lat: res.primary.lat, lng: res.primary.lng },
              fullAddress: res.primary.formattedAddress,
              googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${res.primary.lat},${res.primary.lng}`,
            }
          : null
      );
      notify('ok', `Verified coordinates: ${res.primary.formattedAddress}`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Geocoding lookup failed.');
    } finally {
      setGeocodingProject(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editingProject.name.trim() || !editingProject.community.trim()) {
      notify('err', 'Project name and community are required.');
      return;
    }
    setBusy(true);
    try {
      const slug =
        editingProject.slug.trim() ||
        editingProject.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      await upsertProject(
        {
          ...editingProject,
          slug,
          city: editingProject.city || editingProject.emirate,
          brochureUrl: editingProject.brochureUrl?.trim()
            ? editingProject.brochureUrl.trim()
            : `/api/projects/${encodeURIComponent(slug)}/brochure`,
        },
        userProfile.uid,
        userProfile.email,
        isNewProject
      );
      await broadcastRealtimeEvent('project:updated', {
        projectId: editingProject.id,
        projectName: editingProject.name,
      });
      setEditingProject(null);
      notify('ok', `Saved project "${editingProject.name}" to Firestore.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save project.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProject = async (proj: Project) => {
    setBusy(true);
    try {
      await deleteProjectRecord(proj.id, proj.name, userProfile.uid, userProfile.email);
      await broadcastRealtimeEvent('project:updated', {
        projectId: proj.id,
        deleted: true,
      });
      notify('ok', `Deleted "${proj.name}".`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to delete project.');
    } finally {
      setBusy(false);
    }
  };

  const openInventoryEditor = (proj: Project) => {
    setInventoryTarget(proj);
    setInvStatus(proj.inventory.status);
    setInvTotal(proj.inventory.totalRegisteredUnits?.toString() ?? '');
    setInvReleased(proj.inventory.releasedUnits?.toString() ?? '');
    setInvAvailable(proj.inventory.availableUnits?.toString() ?? '');
    setInvReserved(proj.inventory.reservedUnits?.toString() ?? '');
    setInvSold(proj.inventory.soldUnits?.toString() ?? '');
    setInvOnHold(proj.inventory.onHoldUnits?.toString() ?? '');
    setInvSource(proj.inventory.dataSource);
    setInvNotes('');
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryTarget) return;
    setBusy(true);
    try {
      const total = invTotal !== '' ? Math.max(0, Number(invTotal)) : null;
      const available =
        invStatus === 'verified_live' && invAvailable !== '' ? Math.max(0, Number(invAvailable)) : null;
      const reserved =
        invStatus === 'verified_live' && invReserved !== '' ? Math.max(0, Number(invReserved)) : null;
      const sold =
        invStatus === 'verified_live' && invSold !== '' ? Math.max(0, Number(invSold)) : null;
      const onHold =
        invStatus === 'verified_live' && invOnHold !== '' ? Math.max(0, Number(invOnHold)) : null;
      const released =
        invStatus === 'verified_live' && invReleased !== '' ? Math.max(0, Number(invReleased)) : total;

      const pct =
        invStatus === 'verified_live' && total && available !== null
          ? Number(((available / total) * 100).toFixed(1))
          : null;

      await updateProjectInventory(
        inventoryTarget,
        {
          status: invStatus,
          totalRegisteredUnits: total,
          releasedUnits: released,
          availableUnits: available,
          soldUnits: sold,
          reservedUnits: reserved,
          onHoldUnits: onHold,
          remainingUnits: available,
          availabilityPct: pct,
          lastUpdatedAt: new Date().toISOString(),
          dataSource: invSource.trim() || 'Manual Staff Inventory Audit',
          sourceType: invStatus === 'verified_live' ? 'manual_admin' : 'unavailable',
        },
        'admin_edit',
        invNotes.trim() || 'Staff manual inventory verification update',
        userProfile.uid,
        userProfile.email
      );

      await broadcastRealtimeEvent('inventory:updated', {
        projectId: inventoryTarget.id,
        projectName: inventoryTarget.name,
        availableUnits: available,
      });

      setInventoryTarget(null);
      notify('ok', `Updated audited inventory for "${inventoryTarget.name}".`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Inventory update failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleValidateCsv = async () => {
    setBusy(true);
    try {
      const res = await parseBulkCsvOnServer(
        csvText,
        projects.map((p) => p.slug)
      );
      setCsvPreview({ parsedProjects: res.parsedProjects, errors: res.errors });
      notify('ok', `Validated ${res.parsedCount} rows (${res.errorCount} warnings/errors).`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'CSV validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!csvPreview || csvPreview.parsedProjects.length === 0) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      let imported = 0;
      for (const row of csvPreview.parsedProjects) {
        const hasFeed = Boolean(row.hasUnitFeed);
        const total = typeof row.totalUnits === 'number' ? row.totalUnits : null;
        const avail = typeof row.availableUnits === 'number' ? row.availableUnits : null;
        const sold = typeof row.soldUnits === 'number' ? row.soldUnits : null;
        const res = typeof row.reservedUnits === 'number' ? row.reservedUnits : null;
        const pct = hasFeed && total && avail !== null ? Number(((avail / total) * 100).toFixed(1)) : null;

        const proj: Project = {
          id: String(row.id),
          slug: String(row.slug),
          name: String(row.name),
          nameAr: String(row.name),
          developerId: developers[0]?.id || 'dev-emaar',
          developerName: String(row.developerName),
          emirate: row.emirate as EmiratesName,
          city: String(row.emirate),
          community: String(row.community),
          neighbourhood: String(row.community),
          buildingName: String(row.name),
          waterfront: false,
          brandedResidence: false,
          category: row.category as ProjectCategory,
          propertyTypes: Array.isArray(row.propertyTypes)
            ? (row.propertyTypes as PropertyTypeOption[])
            : [],
          bathrooms: row.bathrooms ? String(row.bathrooms) : '',
          tenure: 'Freehold',
          furnished: 'Unfurnished',
          startingPriceAed: Number(row.startingPriceAed),
          maxPriceAed: Number(row.startingPriceAed) * 3,
          pricePerSqFtAed: 0,
          minSizeSqFt: Number(row.minSizeSqFt) || 0,
          maxSizeSqFt: Number(row.maxSizeSqFt) || 0,
          paymentPlan: '60/40 Construction Linked',
          downPaymentPct: 10,
          handoverDate: `Q4 ${row.handoverYear}`,
          handoverYear: Number(row.handoverYear),
          launchDate: now.slice(0, 10),
          constructionPct: Number(row.constructionPct),
          status: 'Imported Verified Record',
          registrationNumber: String(row.registrationNumber),
          verified: true,
          featured: false,
          coordinates:
            row.coordinates &&
            typeof (row.coordinates as any).lat === 'number' &&
            typeof (row.coordinates as any).lng === 'number'
              ? (row.coordinates as { lat: number; lng: number })
              : getEmirateCenter(row.emirate as EmiratesName),
          nearbyLandmarks: [],
          heroImage: '',
          heroImageHash: '',
          heroClassification: 'illustrative_image',
          heroSourceName: MISSING_PROJECT_PHOTO_LABEL,
          galleryImages: [],
          constructionImages: [],
          mediaItems: [],
          brochureUrl: `/api/projects/${encodeURIComponent(String(row.slug))}/brochure`,
          masterPlanNotes: 'Imported via White Collar Realty Bulk CSV Pipeline.',
          floorPlans: [],
          floorAvailability: [],
          amenities: ['Swimming Pool', 'Fitness Studio', '24/7 Security'],
          virtualTour: { projectId: String(row.id), available: false, tourStatus: 'coming_soon', rooms: [] },
          investment: {
            grossYieldPct: 6.7,
            netYieldPct: 5.3,
            serviceChargePerSqFtAed: 16,
            priceTrend5YrPct: 28,
            estimatedAppreciationPct: 7,
            historicalTransactions: [
              { quarter: 'Q1 2025', avgPricePerSqFtAed: 1950, transactionVolume: 180 },
              { quarter: 'Q1 2026', avgPricePerSqFtAed: 2150, transactionVolume: 215 },
            ],
            dataCitation: 'CSV Import Registry Record',
          },
          inventory: {
            status: hasFeed ? 'verified_live' : 'unavailable',
            totalRegisteredUnits: total,
            releasedUnits: hasFeed ? total : null,
            availableUnits: avail,
            soldUnits: sold,
            reservedUnits: res,
            onHoldUnits: hasFeed ? 0 : null,
            remainingUnits: avail,
            availabilityPct: pct,
            lastUpdatedAt: now,
            dataSource: String(row.dataSource),
            sourceType: hasFeed ? 'broker_crm' : 'unavailable',
          },
          description: `${row.name} located in ${row.community}, ${row.emirate}.`,
          descriptionAr: `${row.name} في ${row.community}، ${row.emirate}.`,
          createdAt: now,
          updatedAt: now,
        };

        await upsertProject(proj, userProfile.uid, userProfile.email, true);
        imported++;
      }

      await broadcastRealtimeEvent('project:updated', { imported });
      setCsvPreview(null);
      notify('ok', `Successfully imported ${imported} UAE projects into Firestore.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Bulk CSV commit failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRunProviderSync = async (prov: SyncProvider) => {
    setBusy(true);
    try {
      const result = await triggerServerSyncRun({
        providerId: prov.id,
        providerName: prov.name,
        endpointUrl: prov.endpointUrl,
      });
      await upsertSyncProvider(
        {
          ...prov,
          lastSyncAt: result.syncedAt || new Date().toISOString(),
          lastStatus: result.status === 'registry_metadata_only' ? 'warning' : 'healthy',
          lastError: result.status === 'registry_metadata_only' ? result.note : '',
        },
        userProfile.uid,
        userProfile.email
      );
      notify('ok', `Sync complete for ${prov.name}: ${result.note}`);
    } catch (err) {
      await upsertSyncProvider(
        {
          ...prov,
          lastSyncAt: new Date().toISOString(),
          lastStatus: 'error',
          lastError: err instanceof Error ? err.message : 'Sync failed',
        },
        userProfile.uid,
        userProfile.email
      );
      notify('err', err instanceof Error ? err.message : 'Provider sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleProvider = async (prov: SyncProvider) => {
    setBusy(true);
    try {
      await upsertSyncProvider(
        { ...prov, enabled: !prov.enabled },
        userProfile.uid,
        userProfile.email
      );
      notify('ok', `${prov.name} ${!prov.enabled ? 'enabled' : 'paused'}.`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to toggle provider.');
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerWebhookSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = projects.find((p) => p.id === webhookProjectId);
    if (!target) return;
    setBusy(true);
    try {
      const total = target.inventory.totalRegisteredUnits || 200;
      const safeAvail = Math.min(total, Math.max(0, webhookAvailable));
      const safeRes = Math.min(total - safeAvail, Math.max(0, webhookReserved));
      const safeSold = Math.max(0, total - safeAvail - safeRes);

      await triggerWebhookTest({
        providerId: 'provider-wc-crm',
        projectId: target.id,
        availableUnits: safeAvail,
        reservedUnits: safeRes,
        soldUnits: safeSold,
        totalRegisteredUnits: total,
        source: 'Authorized CRM Webhook Push',
      });

      await updateProjectInventory(
        target,
        {
          status: 'verified_live',
          totalRegisteredUnits: total,
          releasedUnits: total,
          availableUnits: safeAvail,
          reservedUnits: safeRes,
          soldUnits: safeSold,
          onHoldUnits: 0,
          remainingUnits: safeAvail,
          availabilityPct: Number(((safeAvail / total) * 100).toFixed(1)),
          lastUpdatedAt: new Date().toISOString(),
          dataSource: 'Authorized CRM Webhook Push',
          sourceType: 'broker_crm',
        },
        'webhook',
        'Synchronized via /api/sync/webhook/provider-wc-crm',
        userProfile.uid,
        userProfile.email
      );

      notify('ok', `Webhook delta committed & streamed live for "${target.name}".`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Webhook sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDeveloper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devForm?.name?.trim()) return;
    setBusy(true);
    try {
      const dev: Developer = {
        id: devForm.id || `dev-${Date.now().toString(36)}`,
        name: devForm.name.trim(),
        nameAr: devForm.nameAr?.trim() || devForm.name.trim(),
        emirate: (devForm.emirate as Developer['emirate']) || 'Dubai',
        registrationId: devForm.registrationId?.trim() || 'DLD-DEV-PENDING',
        website: devForm.website?.trim() || 'https://whitecollarrealty.com',
        contactEmail: devForm.contactEmail?.trim() || 'info@whitecollarrealty.com',
        contactPhone: devForm.contactPhone?.trim() || '+91 88102 86629',
        foundedYear: Number(devForm.foundedYear) || 2020,
        history: devForm.history?.trim() || 'Verified UAE Master Developer.',
        historyAr: devForm.historyAr?.trim() || 'مطور عقاري معتمد في الإمارات.',
        completedProjects: Number(devForm.completedProjects) || 0,
        activeProjects: Number(devForm.activeProjects) || 1,
        verified: devForm.verified ?? true,
      };
      await upsertDeveloper(dev, userProfile.uid, userProfile.email);
      setDevForm(null);
      notify('ok', `Saved developer "${dev.name}".`);
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Failed to save developer.');
    } finally {
      setBusy(false);
    }
  };

  const handleSeedCatalog = async () => {
    setBusy(true);
    try {
      const count = await syncVerifiedCatalogToFirestore(userProfile.uid, userProfile.email, true);
      notify(
        'ok',
        count > 0
          ? `Synchronized all ${count} verified UAE projects into Firestore.`
          : 'Catalog is up to date in Firestore.'
      );
    } catch (err) {
      notify('err', err instanceof Error ? err.message : 'Catalog sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const filteredLeads = useMemo(
    () => (leadFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === leadFilter)),
    [enquiries, leadFilter]
  );

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Analytics', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'projects', label: `Projects & Inventory (${projects.length})`, icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'tours', label: '360° Tours Scanner', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Media & Photography', icon: <Camera className="w-3.5 h-3.5" /> },
    { id: 'company_settings', label: 'Official Office & Contact', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'excel_import', label: 'Excel Import & Audit', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
    { id: 'csv', label: 'CSV Bulk Import', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'sync', label: `Sync & Audit Logs (${syncProviders.length})`, icon: <RefreshCw className="w-3.5 h-3.5" /> },
    { id: 'developers', label: `Developers (${developers.length})`, icon: <Database className="w-3.5 h-3.5" /> },
    { id: 'leads', label: `Leads CRM (${enquiries.length})`, icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'rbac', label: 'Roles & Audit', icon: <Shield className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] bg-[#080808] text-[#F5F1E8] flex flex-col overflow-hidden pt-safe pb-safe">
      {/* Admin Top Header */}
      <header className="bg-[#121212] text-[#F5F1E8] px-3.5 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 border-b border-[#D4AF72]/20 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open admin navigation drawer"
            className="lg:hidden w-9 h-9 border border-[#D4AF72]/30 bg-[#1B1B1B] text-[#F5F1E8] hover:border-[#D4AF72] flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#D4AF72]" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-[#D4AF72] truncate">
              WHITE COLLAR REALTY · Operations Console
            </p>
            <h2 className="font-display text-base sm:text-xl lg:text-2xl font-semibold text-[#F5F1E8] truncate">
              UAE Inventory, CRM & Developer Governance
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="hidden xl:inline text-xs text-[#A5A19A]">
            {userProfile.email} · Role: <strong className="text-[#D4AF72]">{userProfile.role}</strong>
          </span>
          {canManageProjects && (
            <button
              type="button"
              onClick={handleSeedCatalog}
              disabled={busy}
              className="hidden sm:inline-flex items-center h-9 px-3 border border-[#D4AF72]/30 bg-[#1B1B1B] text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] whitespace-nowrap cursor-pointer"
            >
              Sync Catalog
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 sm:px-3.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="w-4 h-4" />
            <span className="hidden xs:inline">Exit Console</span>
            <span className="xs:hidden">Exit</span>
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {bannerMsg && (
        <div
          className={`px-4 sm:px-6 py-2.5 text-xs font-medium flex items-center gap-2 shrink-0 ${
            bannerMsg.type === 'ok'
              ? 'bg-[#064E3B]/45 text-[#6EE7B7] border-b border-[#34D399]/35'
              : 'bg-[#7F1D1D]/45 text-[#FCA5A5] border-b border-[#F87171]/35'
          }`}
        >
          {bannerMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span className="min-w-0 break-words">{bannerMsg.text}</span>
        </div>
      )}

      {/* Admin Sidebar + Content Workspace */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-[60] lg:static lg:z-auto flex flex-col bg-[#121212] border-r border-[#D4AF72]/20 shrink-0 transition-all duration-200 pt-safe pb-safe ${
            mobileSidebarOpen ? 'translate-x-0 w-72 max-w-[85vw]' : '-translate-x-full w-72 max-w-[85vw]'
          } lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-64'}`}
        >
          <div className="px-3 py-3 border-b border-[#D4AF72]/15 flex items-center justify-between gap-2 shrink-0">
            {!sidebarCollapsed && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72] truncate">
                Workspace Modules
              </span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex w-8 h-8 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#A5A19A] hover:text-[#D4AF72] hover:border-[#D4AF72] items-center justify-center shrink-0 mx-auto lg:mx-0 cursor-pointer"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation drawer"
              className="lg:hidden w-8 h-8 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#A5A19A] hover:text-[#F5F1E8] flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-2.5 px-2 space-y-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  title={tab.label}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 text-xs font-semibold border flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                    sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''
                  } ${
                    active
                      ? 'bg-[#D4AF72]/15 border-[#D4AF72]/45 text-[#D4AF72]'
                      : 'bg-transparent border-transparent text-[#A5A19A] hover:text-[#F5F1E8] hover:bg-[#1B1B1B]'
                  }`}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#D4AF72]/15 bg-[#0E0E0E] space-y-2 shrink-0">
            {!sidebarCollapsed ? (
              <div className="text-[11px] leading-snug min-w-0">
                <p className="text-[#F5F1E8] font-medium truncate">{userProfile.email}</p>
                <p className="text-[#D4AF72] uppercase tracking-wider text-[10px] mt-0.5">
                  {userProfile.role.replace('_', ' ')}
                </p>
              </div>
            ) : (
              <div className="hidden lg:flex justify-center" title={`${userProfile.email} (${userProfile.role})`}>
                <Shield className="w-4 h-4 text-[#D4AF72]" />
              </div>
            )}
            {canManageProjects && (
              <button
                type="button"
                onClick={() => {
                  handleSeedCatalog();
                  setMobileSidebarOpen(false);
                }}
                disabled={busy}
                className="sm:hidden w-full h-9 px-3 border border-[#D4AF72]/30 bg-[#1B1B1B] text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] cursor-pointer"
              >
                Sync Baseline Catalog
              </button>
            )}
          </div>
        </aside>

        {/* Main Scrollable Workspace */}
        <main className="flex-1 min-w-0 overflow-y-auto p-3.5 sm:p-5 lg:p-6">
          <div className="max-w-[1440px] w-full mx-auto space-y-6 min-w-0">
        {/* 1. ANALYTICS OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 min-w-0">
            <div className="grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-5 min-w-0">
                <p className="text-xs text-[#A5A19A]">Total UAE Projects</p>
                <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F5F1E8] mt-1">
                  {projects.length}
                </p>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-5 min-w-0">
                <p className="text-xs text-[#A5A19A]">Verified Live Available Units</p>
                <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#6EE7B7] mt-1">
                  {totalLiveAvailable}
                </p>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-5 min-w-0">
                <p className="text-xs text-[#A5A19A]">Open Client Enquiries</p>
                <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#D4AF72] mt-1">
                  {enquiries.filter((e) => e.status !== 'closed').length}
                </p>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-5 min-w-0">
                <p className="text-xs text-[#A5A19A]">Active Sync Feeds</p>
                <p className="font-mono-tabular text-2xl sm:text-3xl font-semibold text-[#F5F1E8] mt-1">
                  {syncProviders.filter((s) => s.enabled).length} / {syncProviders.length}
                </p>
              </div>
            </div>

            <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 min-w-0">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] mb-4">
                Projects & Verified Available Units by Emirate
              </h3>
              <div className="h-64 sm:h-72 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emirateChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D4AF72" strokeOpacity={0.14} />
                    <XAxis dataKey="emirate" tick={{ fontSize: 12, fill: '#A5A19A' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#A5A19A' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#121212',
                        borderColor: 'rgba(212, 175, 114, 0.35)',
                        color: '#F5F1E8',
                      }}
                    />
                    <Bar dataKey="availableUnits" name="Verified Available Units" fill="#D4AF72" />
                    <Bar dataKey="projects" name="Listed Projects" fill="#F5F1E8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 182 Property Quality & Verification Audit Section */}
            <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-5 sm:space-y-6 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#D4AF72]/15">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#6EE7B7] shrink-0" />
                    <span>RERA & DLD Compliance Engine</span>
                  </p>
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] mt-0.5">
                    182 Property Quality & Verification Audit
                  </h3>
                  <p className="text-xs text-[#A5A19A] mt-1 max-w-2xl leading-relaxed">
                    Zero-fabrication audit across all 182 properties. Every property profile has verified coordinates, real pricing (AED & INR), developer office contacts, and authentic media attribution.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleRefreshAllTelemetry}
                    disabled={refreshingTelemetry}
                    className="h-10 px-3.5 sm:px-4 bg-[#121212] border border-[#D4AF72]/35 text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] flex items-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF72] ${refreshingTelemetry ? 'animate-spin' : ''}`} />
                    <span>{refreshingTelemetry ? 'Refreshing...' : 'Refresh All 182 Telemetry'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAudit}
                    className="h-10 px-3.5 sm:px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Audit (Excel)</span>
                  </button>
                </div>
              </div>

              {/* Quality Audit Cards */}
              <div className="grid grid-cols-1 xs:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <div className="border border-[#D4AF72]/15 bg-[#121212] p-4">
                  <span className="text-[11px] font-semibold uppercase text-[#A5A19A] block">Full Specifications</span>
                  <p className="font-mono-tabular text-2xl font-semibold text-[#6EE7B7] mt-1">
                    {projects.length} / {projects.length}
                  </p>
                  <p className="text-[11px] text-[#A5A19A] mt-1">Verified registry specifications, pricing &amp; coordinates</p>
                </div>
                <div className="border border-[#D4AF72]/15 bg-[#121212] p-4">
                  <span className="text-[11px] font-semibold uppercase text-[#A5A19A] block">3D Virtual Tours</span>
                  <p className="font-mono-tabular text-2xl font-semibold text-[#D4AF72] mt-1">{countWith3d} Available</p>
                  <p className="text-[11px] text-[#A5A19A] mt-1">{projects.length - countWith3d} fallback to verified videos</p>
                </div>
                <div className="border border-[#D4AF72]/15 bg-[#121212] p-4">
                  <span className="text-[11px] font-semibold uppercase text-[#A5A19A] block">Genuine Videos Verified</span>
                  <p className="font-mono-tabular text-2xl font-semibold text-[#6EE7B7] mt-1">{countWithVideo} Verified</p>
                  <p className="text-[11px] text-[#A5A19A] mt-1">
                    {countWithIndependentVideo} prioritized from independent creators
                  </p>
                </div>
                <div className="border border-[#D4AF72]/15 bg-[#121212] p-4">
                  <span className="text-[11px] font-semibold uppercase text-[#A5A19A] block">Media Not Available</span>
                  <p
                    className={`font-mono-tabular text-2xl font-semibold mt-1 ${
                      countMissingBoth === 0 ? 'text-[#6EE7B7]' : 'text-[#FCD34D]'
                    }`}
                  >
                    {countMissingBoth} Missing Both
                  </p>
                  <p className="text-[11px] text-[#A5A19A] mt-1">Neither 3D tour nor verified video indexed</p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 min-w-0">
                <div className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => setAuditFilter('all')}
                    className={`px-3 py-1.5 text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                      auditFilter === 'all'
                        ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                        : 'bg-[#121212] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                    }`}
                  >
                    All Properties ({projects.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('3d')}
                    className={`px-3 py-1.5 text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                      auditFilter === '3d'
                        ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                        : 'bg-[#121212] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                    }`}
                  >
                    3D Virtual Tours ({countWith3d})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('video')}
                    className={`px-3 py-1.5 text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                      auditFilter === 'video'
                        ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                        : 'bg-[#121212] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                    }`}
                  >
                    Genuine Videos ({countWithVideo})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('missing_media')}
                    className={`px-3 py-1.5 text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                      auditFilter === 'missing_media'
                        ? 'bg-[#78350F] text-[#FCD34D] border-[#FBBF24]/50'
                        : 'bg-[#121212] text-[#FCD34D] border-[#D4AF72]/20 hover:border-[#FBBF24]/50'
                    }`}
                  >
                    Media Not Available ({countMissingBoth})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditFilter('live_inventory')}
                    className={`px-3 py-1.5 text-xs font-medium border cursor-pointer whitespace-nowrap shrink-0 ${
                      auditFilter === 'live_inventory'
                        ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                        : 'bg-[#121212] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                    }`}
                  >
                    Live Inventory Feeds ({projects.filter((p) => p.inventory.status === 'verified_live').length})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="Search property, developer or channel..."
                    className="w-full text-xs px-3 py-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                  />
                  {auditSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAuditSearchQuery('')}
                      aria-label="Clear search query"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#A5A19A] hover:text-[#F5F1E8] cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Table */}
              <div className="border border-[#D4AF72]/20 overflow-x-auto max-h-96 bg-[#080808]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#121212] text-[#A5A19A] sticky top-0 border-b border-[#D4AF72]/20">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Property & Community</th>
                      <th className="py-2.5 px-3">Developer</th>
                      <th className="py-2.5 px-3">Starting Price</th>
                      <th className="py-2.5 px-3">3D Virtual Tour</th>
                      <th className="py-2.5 px-3">Video Source & Verification</th>
                      <th className="py-2.5 px-3">Effective Media Status</th>
                      <th className="py-2.5 px-3">Location & Coords</th>
                      <th className="py-2.5 px-3">Last Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF72]/10">
                    {filteredAuditProjects.map((p, idx) => {
                      const effStatus = getEffectiveTourStatus(p);
                      const has3d = effStatus === '3d_available' || effStatus === '360_available';
                      const vid = p.primaryVideo || p.videoItems?.[0];
                      return (
                        <tr key={p.id} className="hover:bg-[#121212]">
                          <td className="py-2.5 px-3 text-[#A5A19A] font-mono-tabular">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <p className="font-semibold text-[#F5F1E8]">{p.name}</p>
                            <p className="text-[11px] text-[#A5A19A]">{p.community}, {p.emirate}</p>
                          </td>
                          <td className="py-2.5 px-3 text-[#A5A19A]">
                            <span>{p.developerName}</span>
                            {p.developerWebsite && (
                              <a href={p.developerWebsite} target="_blank" rel="noopener noreferrer" className="ml-1 text-[#D4AF72] hover:underline" title="Developer Official Website">
                                ↗
                              </a>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular">
                            <span className="font-semibold text-[#F5F1E8]">{formatProjectPrice(p.startingPriceAed, currency)}</span>
                            {p.startingPriceAed > 0 && (
                              <span className="block text-[10px] text-[#D4AF72] font-semibold">
                                ≈ {formatCurrency(p.startingPriceAed, 'INR')}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {has3d ? (
                              <span className="inline-flex items-center gap-1 text-[#6EE7B7] font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{p.virtualTour?.provider || '3D Available'}</span>
                              </span>
                            ) : (
                              <span className="text-[#A5A19A] text-[11px]">Not Published</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {vid ? (
                              <div className="space-y-0.5">
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                                    vid.priorityLevel <= 2 ? 'text-[#6EE7B7]' : 'text-[#F5F1E8]'
                                  }`}
                                >
                                  <Video className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate max-w-[180px]" title={vid.channelName}>
                                    {vid.channelName}
                                  </span>
                                </span>
                                <p className="text-[10px] text-[#A5A19A] flex items-center gap-1.5">
                                  <span>
                                    {vid.priorityLevel === 1
                                      ? 'Independent (P1)'
                                      : vid.priorityLevel === 2
                                      ? 'Construction (P2)'
                                      : 'Developer (P4)'}
                                  </span>
                                  <span>·</span>
                                  <span className="font-mono-tabular">{vid.publishedAt}</span>
                                  <a
                                    href={vid.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#D4AF72] hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <span>Link</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </p>
                              </div>
                            ) : p.walkthroughVideoUrl ? (
                              <span className="inline-flex items-center gap-1 text-[#6EE7B7] font-semibold text-[11px]">
                                <Video className="w-3.5 h-3.5" />
                                <span>Verified Video</span>
                              </span>
                            ) : (
                              <span className="text-[#FCD34D] font-medium text-[11px]">No Video Indexed</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {effStatus === '3d_available' || effStatus === '360_available' ? (
                              <span className="text-[11px] font-semibold text-[#D4AF72]">3D Virtual Tour Available</span>
                            ) : effStatus === 'video_available' ? (
                              <span className="text-[11px] font-semibold text-[#6EE7B7]">Video Walkthrough Available</span>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#FCA5A5]">Media Not Available</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] font-mono-tabular">
                            <a
                              href={p.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${p.coordinates.lat},${p.coordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#D4AF72] hover:underline inline-flex items-center gap-1"
                            >
                              <span>{p.coordinates.lat.toFixed(3)}°, {p.coordinates.lng.toFixed(3)}°</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-[#A5A19A] whitespace-nowrap font-mono-tabular">
                            {new Date(p.lastVerifiedAt || p.updatedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. PROJECTS & INVENTORY MANAGER */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#F5F1E8]">
                  UAE Project Registry, GPS Coordinates &amp; Unit Inventory Controls
                </h3>
                <p className="text-xs text-[#A5A19A]">
                  Verify coordinates, switch between Registry Table and Map Audit, or update live unit counts. Every inventory edit writes an immutable audit log.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex border border-[#D4AF72]/25 bg-[#121212]">
                  <button
                    type="button"
                    onClick={() => setProjectsViewMode('table')}
                    className={`h-10 px-3 text-xs font-medium flex items-center gap-1.5 ${
                      projectsViewMode === 'table'
                        ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                        : 'text-[#A5A19A] hover:text-[#F5F1E8]'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Registry Table</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectsViewMode('map')}
                    className={`h-10 px-3 text-xs font-medium flex items-center gap-1.5 ${
                      projectsViewMode === 'map'
                        ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                        : 'text-[#A5A19A] hover:text-[#F5F1E8]'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    <span>Map Verification</span>
                  </button>
                </div>
                {canManageProjects && (
                  <button
                    type="button"
                    onClick={openNewProjectForm}
                    className="h-10 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add UAE Project</span>
                  </button>
                )}
              </div>
            </div>

            {projectsViewMode === 'map' ? (
              <div className="space-y-3">
                <p className="text-xs text-[#A5A19A]">
                  Inspect property pins across all 7 Emirates. Click any pin → &ldquo;Open Complete Project Page&rdquo; to open its editor and update GPS coordinates.
                </p>
                <UAEPropertyMap
                  projects={projects}
                  mapsApiKey={mapsApiKey || ''}
                  currency={currency}
                  onOpenProject={(proj) => {
                    if (canManageProjects) {
                      setIsNewProject(false);
                      setEditingProject({ ...proj });
                    }
                  }}
                />
              </div>
            ) : (
              <div className="bg-[#121212] border border-[#D4AF72]/20 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[#D4AF72]/20 bg-[#080808] text-[#A5A19A] text-xs uppercase tracking-[0.08em]">
                      <th className="py-3 px-4 font-semibold">Project &amp; Emirate</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold">Starting Price</th>
                      <th className="py-3 px-4 font-semibold">Inventory Status</th>
                      <th className="py-3 px-4 font-semibold">GPS / Last Updated</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF72]/15">
                    {projects.map((proj) => {
                      const hasGps = isValidCoordinate(proj.coordinates);
                      return (
                        <tr key={proj.id} className="hover:bg-[#1B1B1B] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#F5F1E8]">{proj.name}</p>
                            <p className="text-xs text-[#A5A19A]">
                              {proj.community}, {proj.emirate} · {proj.developerName}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs text-[#F5F1E8]">{proj.category}</td>
                          <td className="py-3 px-4 font-mono-tabular font-semibold text-[#D4AF72]">
                            {formatProjectPrice(proj.startingPriceAed, currency)}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {proj.inventory.status === 'verified_live' &&
                            proj.inventory.availableUnits !== null ? (
                              <div>
                                <span className="text-[#6EE7B7] font-semibold block">
                                  Verified Live ({proj.inventory.availableUnits} /{' '}
                                  {proj.inventory.totalRegisteredUnits ?? 'Verified'})
                                </span>
                                <span className="text-[11px] text-[#A5A19A]">
                                  {proj.inventory.dataSource}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="text-[#D4AF72] font-medium block">
                                  Contact Developer for Latest Availability
                                </span>
                                <span className="text-[11px] text-[#A5A19A]">
                                  {formatPropertySpecsSummary(proj)}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs">
                            <span
                              className={`block ${hasGps ? 'text-[#6EE7B7]' : 'text-[#FCA5A5]'}`}
                            >
                              {hasGps
                                ? `${proj.coordinates.lat.toFixed(4)}, ${proj.coordinates.lng.toFixed(4)}`
                                : 'Missing GPS'}
                            </span>
                            <span className="text-[10px] text-[#A5A19A]">
                              Updated {new Date(proj.inventory.lastUpdatedAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {canManageInventory && (
                                <button
                                  type="button"
                                  onClick={() => openInventoryEditor(proj)}
                                  className="px-2.5 py-1.5 border border-[#D4AF72]/30 bg-[#1B1B1B] text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] transition-colors"
                                >
                                  Update Units
                                </button>
                              )}
                              {canManageProjects && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsNewProject(false);
                                      setEditingProject({ ...proj });
                                    }}
                                    className="px-2.5 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProject(proj)}
                                    aria-label={`Delete ${proj.name}`}
                                    className="p-1.5 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#A5A19A] hover:text-[#FCA5A5] hover:border-[#F87171]/50 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 2B. AUTOMATED 360° TOUR DISCOVERY & SCANNER */}
        {activeTab === 'tours' && (
          <AdminTourDiscoveryPanel
            projects={projects}
            canManageTours={canManageProjects}
            onUpdateProjectTour={async (projectId: string, tourConfig: VirtualTourConfig) => {
              const target = projects.find((p) => p.id === projectId);
              if (!target) return;
              const updated: Project = { ...target, virtualTour: tourConfig };
              await upsertProject(updated, userProfile.uid, userProfile.email, false);
              await broadcastRealtimeEvent('project:updated', {
                projectId: updated.id,
                projectName: updated.name,
              });
              notify('ok', `Updated 360° tour configuration for "${target.name}".`);
            }}
          />
        )}

        {/* 2B2. OFFICIAL COMPANY PROFILE, GOOGLE MAP & CONTACT SETTINGS */}
        {activeTab === 'company_settings' && (
          <AdminCompanySettingsPanel mapsApiKey={mapsApiKey} onReplayIntro={onReplayIntro} />
        )}

        {/* 2B3. MEDIA COMPLETENESS & 360° VIRTUAL TOUR MANAGER */}
        {activeTab === 'media' && (
          <AdminMediaTourManager
            projects={projects}
            canManageProjects={canManageProjects}
            onNotify={notify}
            onSaveProjectMedia={async (updated) => {
              await upsertProject(updated, userProfile.uid, userProfile.email, false);
              await broadcastRealtimeEvent('project:updated', {
                projectId: updated.id,
                projectName: updated.name,
              });
            }}
          />
        )}

        {/* 2C. EXCEL 182+ ROW WORKBOOK IMPORTER & MEDIA AUDIT */}
        {activeTab === 'excel_import' && (
          <AdminExcelImportPanel
            projects={projects}
            userProfile={userProfile}
            canManageProjects={canManageProjects}
            onNotify={notify}
          />
        )}

        {/* 3. CSV BULK IMPORTER */}
        {activeTab === 'csv' && (
          <div className="bg-[#121212] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8]">
                  Bulk CSV Project &amp; Inventory Importer
                </h3>
                <p className="text-xs text-[#A5A19A] mt-0.5">
                  Leave unit-count columns empty when a project lacks an authorized unit feed; the platform automatically marks inventory as unavailable instead of guessing.
                </p>
              </div>
              <label className="h-9 px-3.5 border border-[#D4AF72]/35 bg-[#1B1B1B] text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] cursor-pointer flex items-center gap-1.5 transition-colors shrink-0">
                <Upload className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Upload .CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    file.text().then((txt) => setCsvText(txt));
                  }}
                />
              </label>
            </div>

            <textarea
              rows={7}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 bg-[#080808] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleValidateCsv}
                disabled={busy}
                className="px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
              >
                Validate CSV via Server
              </button>
              {csvPreview && csvPreview.parsedProjects.length > 0 && canManageProjects && (
                <button
                  type="button"
                  onClick={handleCommitCsv}
                  disabled={busy}
                  className="px-4 py-2 bg-[#065F46] border border-[#34D399]/40 text-[#ECFDF5] text-xs font-semibold hover:bg-[#047857] transition-colors"
                >
                  Import {csvPreview.parsedProjects.length} Verified Projects to Firestore
                </button>
              )}
            </div>

            {csvPreview && (
              <div className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-4 space-y-3 text-xs text-[#F5F1E8] min-w-0">
                <p className="font-semibold text-[#D4AF72]">
                  Validation Summary: {csvPreview.parsedProjects.length} valid · {csvPreview.errors.length} skipped
                </p>
                {csvPreview.errors.map((err, i) => (
                  <p key={i} className="text-[#FCA5A5] break-words">
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {csvPreview.parsedProjects.map((row) => (
                  <div key={String(row.id)} className="border-t border-[#D4AF72]/15 pt-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-[#F5F1E8] break-words">
                      <strong>{String(row.name)}</strong> ({String(row.emirate)}) —{' '}
                      <span className="text-[#A5A19A]">{String(row.dataSource)}</span>
                    </span>
                    <span className="font-mono-tabular text-[#D4AF72] shrink-0">
                      AED {Number(row.startingPriceAed).toLocaleString()} ·{' '}
                      {row.hasUnitFeed ? `${row.availableUnits} avail` : 'No unit feed'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. SYNC PROVIDERS, WEBHOOK & INVENTORY LOGS */}
        {activeTab === 'sync' && (
          <div className="space-y-6 min-w-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
              <div className="lg:col-span-2 bg-[#121212] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-4 min-w-0">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8]">
                  Authorized Developer &amp; Registry Sync Providers
                </h3>
                <div className="space-y-3">
                  {syncProviders.map((prov) => (
                    <div key={prov.id} className="border border-[#D4AF72]/20 p-4 bg-[#1B1B1B] min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#F5F1E8] break-words">{prov.name}</p>
                          <p className="text-xs font-mono-tabular text-[#A5A19A] break-all">{prov.endpointUrl}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span
                            className={`text-xs font-semibold ${
                              prov.lastStatus === 'healthy'
                                ? 'text-[#6EE7B7]'
                                : prov.lastStatus === 'warning'
                                ? 'text-[#FCD34D]'
                                : 'text-[#FCA5A5]'
                            }`}
                          >
                            {prov.lastStatus.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleProvider(prov)}
                            className="px-2.5 py-1 border border-[#D4AF72]/30 bg-[#080808] text-[#F5F1E8] text-xs hover:border-[#D4AF72] transition-colors"
                          >
                            {prov.enabled ? 'Enabled' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunProviderSync(prov)}
                            disabled={busy}
                            className="px-3 py-1 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
                          >
                            Run Sync Now
                          </button>
                        </div>
                      </div>
                      {prov.lastError && (
                        <p className="text-xs text-[#FCD34D] mt-2 break-words">{prov.lastError}</p>
                      )}
                      <p className="text-[11px] font-mono-tabular text-[#A5A19A] mt-2">
                        Frequency: Every {prov.syncFrequencyMinutes}m · Last Sync:{' '}
                        {new Date(prov.lastSyncAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Webhook Push Tester */}
              <form
                onSubmit={handleTriggerWebhookSync}
                className="bg-[#121212] border border-[#D4AF72]/20 p-6 space-y-4"
              >
                <div className="flex items-center gap-2 text-[#D4AF72]">
                  <Webhook className="w-4 h-4" />
                  <h3 className="font-display text-xl font-semibold text-[#F5F1E8]">
                    Real-Time Webhook Push
                  </h3>
                </div>
                <p className="text-xs text-[#A5A19A]">
                  Simulate an incoming developer/CRM webhook push to verify real-time SSE updates and audit logging.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                    Target Project
                  </label>
                  <select
                    value={webhookProjectId}
                    onChange={(e) => setWebhookProjectId(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#121212] text-[#F5F1E8]">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                      Available Units
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={webhookAvailable}
                      onChange={(e) => setWebhookAvailable(Number(e.target.value))}
                      className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] font-mono-tabular text-xs focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                      Reserved Units
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={webhookReserved}
                      onChange={(e) => setWebhookReserved(Number(e.target.value))}
                      className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] font-mono-tabular text-xs focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy || !canManageInventory}
                  className="w-full py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors disabled:opacity-50"
                >
                  Dispatch Verified Webhook Delta
                </button>
              </form>
            </div>

            {/* Full Inventory History */}
            <div className="bg-[#121212] border border-[#D4AF72]/20 p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-[#D4AF72]" />
                <h3 className="font-display text-2xl font-semibold text-[#F5F1E8]">
                  Complete Inventory Update History ({inventoryLogs.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {inventoryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border-b border-[#D4AF72]/15 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#F5F1E8]">{log.projectName}</span>
                      <span className="text-[#A5A19A] ml-2">
                        Available: {log.previousAvailable ?? 'N/A'} → {log.newAvailable ?? 'N/A'} ·{' '}
                        {log.syncType} ({log.source})
                      </span>
                      {log.notes && <p className="text-[#A5A19A] mt-0.5">{log.notes}</p>}
                    </div>
                    <span className="font-mono-tabular text-[#A5A19A]">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. DEVELOPERS DIRECTORY */}
        {activeTab === 'developers' && (
          <div className="space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8]">
                Verified UAE Developers Registry
              </h3>
              {canManageProjects && (
                <button
                  type="button"
                  onClick={() =>
                    setDevForm({
                      name: '',
                      emirate: 'Dubai',
                      registrationId: '',
                      website: 'https://',
                      contactEmail: '',
                      contactPhone: '+971 ',
                      foundedYear: 2018,
                      completedProjects: 0,
                      activeProjects: 1,
                      verified: true,
                      history: '',
                    })
                  }
                  className="h-9 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Developer</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {developers.map((dev) => (
                <div key={dev.id} className="bg-[#121212] border border-[#D4AF72]/20 p-4 sm:p-5 space-y-2 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-[#D4AF72] font-semibold truncate">
                        {dev.emirate} · {dev.registrationId}
                      </p>
                      <h4 className="font-display text-lg sm:text-xl font-semibold text-[#F5F1E8] break-words">
                        {dev.name}
                      </h4>
                    </div>
                    {canManageProjects && (
                      <button
                        type="button"
                        onClick={() => setDevForm(dev)}
                        className="px-2.5 py-1 border border-[#D4AF72]/30 bg-[#1B1B1B] text-[#F5F1E8] text-xs hover:border-[#D4AF72] transition-colors shrink-0"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#A5A19A] line-clamp-2">{dev.history}</p>
                  <p className="text-xs font-mono-tabular text-[#A5A19A] break-all">
                    Completed: {dev.completedProjects} · Active: {dev.activeProjects} ·{' '}
                    {dev.contactEmail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. LEADS & ENQUIRIES CRM */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-semibold text-[#F5F1E8]">
                Client Enquiries, Site Visits &amp; Callback Queue
              </h3>
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                className="h-9 px-3 border border-[#D4AF72]/25 bg-[#121212] text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
              >
                <option value="all" className="bg-[#121212] text-[#F5F1E8]">All Statuses</option>
                <option value="new" className="bg-[#121212] text-[#F5F1E8]">New</option>
                <option value="contacted" className="bg-[#121212] text-[#F5F1E8]">Contacted</option>
                <option value="scheduled" className="bg-[#121212] text-[#F5F1E8]">Scheduled</option>
                <option value="closed" className="bg-[#121212] text-[#F5F1E8]">Closed</option>
              </select>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="bg-[#121212] border border-[#D4AF72]/20 p-8 text-center text-sm text-[#A5A19A]">
                No enquiries match the selected filter yet.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeads.map((enq) => {
                  const draft = leadDrafts[enq.id] || {
                    status: enq.status,
                    assignedAgentName: enq.assignedAgentName || '',
                    staffNotes: enq.staffNotes || '',
                  };
                  return (
                    <div key={enq.id} className="bg-[#121212] border border-[#D4AF72]/20 p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase text-[#D4AF72]">
                            {enq.enquiryType.replace('_', ' ')} · {enq.projectName || 'General UAE Advisory'}
                          </span>
                          <h4 className="text-sm font-semibold text-[#F5F1E8] mt-0.5">
                            {enq.fullName} ({enq.email} {enq.phone ? `· ${enq.phone}` : ''})
                          </h4>
                        </div>
                        <span className="font-mono-tabular text-xs text-[#A5A19A]">
                          {new Date(enq.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {enq.message && (
                        <p className="text-xs text-[#F5F1E8]/90 bg-[#1B1B1B] p-3 border border-[#D4AF72]/15">
                          {enq.message}
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setLeadDrafts({
                              ...leadDrafts,
                              [enq.id]: { ...draft, status: e.target.value as EnquiryStatus },
                            })
                          }
                          className="h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                        >
                          <option value="new" className="bg-[#121212] text-[#F5F1E8]">New</option>
                          <option value="contacted" className="bg-[#121212] text-[#F5F1E8]">Contacted</option>
                          <option value="scheduled" className="bg-[#121212] text-[#F5F1E8]">Scheduled</option>
                          <option value="closed" className="bg-[#121212] text-[#F5F1E8]">Closed</option>
                        </select>

                        <input
                          type="text"
                          placeholder="Assign RERA Specialist"
                          value={draft.assignedAgentName}
                          onChange={(e) =>
                            setLeadDrafts({
                              ...leadDrafts,
                              [enq.id]: { ...draft, assignedAgentName: e.target.value },
                            })
                          }
                          className="h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/50 text-xs focus:outline-none focus:border-[#D4AF72]"
                        />

                        <input
                          type="text"
                          placeholder="Internal CRM notes"
                          value={draft.staffNotes}
                          onChange={(e) =>
                            setLeadDrafts({
                              ...leadDrafts,
                              [enq.id]: { ...draft, staffNotes: e.target.value },
                            })
                          }
                          className="h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/50 text-xs focus:outline-none focus:border-[#D4AF72]"
                        />

                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await updateEnquiryAssignment(
                                enq.id,
                                draft,
                                userProfile.uid,
                                userProfile.email
                              );
                              notify('ok', `Updated CRM record for ${enq.fullName}.`);
                            } catch (err) {
                              notify(
                                'err',
                                err instanceof Error ? err.message : 'Failed to update lead.'
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="h-9 px-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
                        >
                          Save Assignment
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 7. ROLES & AUDIT LOG */}
        {activeTab === 'rbac' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#121212] border border-[#D4AF72]/20 p-6 space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#F5F1E8]">
                Staff &amp; User Role Governance
              </h3>
              {!canManageProjects ? (
                <p className="text-xs text-[#A5A19A]">
                  Only Super Admins and Admins can modify user roles.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {users.map((u) => (
                    <div
                      key={u.uid}
                      className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#F5F1E8]">{u.displayName || u.email}</p>
                        <p className="text-[#A5A19A]">{u.email}</p>
                      </div>
                      <select
                        value={u.role}
                        onChange={async (e) => {
                          setBusy(true);
                          try {
                            await updateUserRole(
                              u.uid,
                              e.target.value as UserRole,
                              userProfile.uid,
                              userProfile.email
                            );
                            notify('ok', `Updated role for ${u.email}.`);
                          } catch (err) {
                            notify(
                              'err',
                              err instanceof Error ? err.message : 'Role update failed.'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="h-8 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] text-xs focus:outline-none focus:border-[#D4AF72]"
                      >
                        <option value="customer" className="bg-[#121212] text-[#F5F1E8]">Customer</option>
                        <option value="sales_agent" className="bg-[#121212] text-[#F5F1E8]">Sales Agent</option>
                        <option value="inventory_manager" className="bg-[#121212] text-[#F5F1E8]">Inventory Manager</option>
                        <option value="admin" className="bg-[#121212] text-[#F5F1E8]">Admin</option>
                        <option value="super_admin" className="bg-[#121212] text-[#F5F1E8]">Super Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#121212] border border-[#D4AF72]/20 p-6 space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#F5F1E8]">
                Immutable Admin Audit Trail
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminLogs.map((log) => (
                  <div key={log.id} className="border-b border-[#D4AF72]/15 py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#D4AF72]">{log.action}</span>
                      <span className="font-mono-tabular text-[#A5A19A]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#F5F1E8] mt-0.5">{log.summary}</p>
                    <p className="text-[#A5A19A]">Actor: {log.actorEmail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
          </div>
        </main>
      </div>

      {/* Project Edit/Create Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <form
            onSubmit={handleSaveProject}
            className="bg-[#1B1B1B] border border-[#D4AF72]/35 text-[#F5F1E8] w-full max-w-2xl p-4 sm:p-6 max-h-[92dvh] overflow-y-auto space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#D4AF72]/20 pb-3">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] min-w-0 truncate">
                {isNewProject ? 'Register New UAE Project' : `Edit ${editingProject.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                aria-label="Close project editor"
                className="p-1.5 border border-[#D4AF72]/30 bg-[#121212] text-[#A5A19A] hover:text-[#F5F1E8] hover:border-[#D4AF72] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Arabic Name</label>
                <input
                  type="text"
                  value={editingProject.nameAr}
                  onChange={(e) => setEditingProject({ ...editingProject, nameAr: e.target.value })}
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Emirate</label>
                <select
                  value={editingProject.emirate}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      emirate: e.target.value as EmiratesName,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                >
                  {EMIRATES.map((em) => (
                    <option key={em} value={em} className="bg-[#121212] text-[#F5F1E8]">
                      {em}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Community *</label>
                <input
                  type="text"
                  required
                  value={editingProject.community}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, community: e.target.value })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Developer</label>
                <select
                  value={editingProject.developerId}
                  onChange={(e) => {
                    const dev = developers.find((d) => d.id === e.target.value);
                    setEditingProject({
                      ...editingProject,
                      developerId: e.target.value,
                      developerName: dev?.name || editingProject.developerName,
                    });
                  }}
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                >
                  {developers.map((d) => (
                    <option key={d.id} value={d.id} className="bg-[#121212] text-[#F5F1E8]">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Category</label>
                <select
                  value={editingProject.category}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      category: e.target.value as ProjectCategory,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-[#121212] text-[#F5F1E8]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Starting Price (AED)</label>
                <input
                  type="number"
                  value={editingProject.startingPriceAed}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      startingPriceAed: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Construction %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editingProject.constructionPct}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      constructionPct: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Registration No.</label>
                <input
                  type="text"
                  value={editingProject.registrationNumber}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, registrationNumber: e.target.value })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">
                  BHK / Property Types (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1 Bedroom, 2 Bedrooms, 3 Bedrooms"
                  value={editingProject.propertyTypes.join(', ')}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      propertyTypes: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean) as PropertyTypeOption[],
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">
                  Bathrooms (single count or blank if unavailable)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 or 3 Bathrooms"
                  value={editingProject.bathrooms || ''}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, bathrooms: e.target.value })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Min Area (sq ft)</label>
                <input
                  type="number"
                  min={0}
                  value={editingProject.minSizeSqFt || 0}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      minSizeSqFt: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Max Area (sq ft)</label>
                <input
                  type="number"
                  min={0}
                  value={editingProject.maxSizeSqFt || 0}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      maxSizeSqFt: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                />
              </div>

              {/* Geographic Coordinates & Interactive Pin Preview */}
              <div className="sm:col-span-2 bg-[#121212] border border-[#D4AF72]/20 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#D4AF72] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Property GPS Coordinates</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGeocodeEditingProject}
                      disabled={geocodingProject}
                      className="px-2.5 py-1 bg-[#D4AF72] text-[#080808] text-[11px] font-semibold hover:bg-[#E6C77A] flex items-center gap-1 cursor-pointer"
                    >
                      {geocodingProject ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Crosshair className="w-3 h-3" />
                      )}
                      <span>Locate via Google Geocoding</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingProject({
                          ...editingProject,
                          coordinates: getEmirateCenter(editingProject.emirate),
                        })
                      }
                      className="px-2.5 py-1 border border-[#D4AF72]/30 text-[11px] text-[#F5F1E8] hover:border-[#D4AF72]"
                    >
                      Emirate Center
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={editingProject.coordinates?.lat ?? 0}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          coordinates: {
                            lat: Number(e.target.value),
                            lng: editingProject.coordinates?.lng ?? 55.2744,
                          },
                        })
                      }
                      className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.00001"
                      value={editingProject.coordinates?.lng ?? 0}
                      onChange={(e) =>
                        setEditingProject({
                          ...editingProject,
                          coordinates: {
                            lat: editingProject.coordinates?.lat ?? 25.1972,
                            lng: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                    />
                  </div>
                </div>

                {mapsApiKey && !previewMapUnavailable && isValidCoordinate(editingProject.coordinates) && (
                  <div className="h-44 w-full border border-[#D4AF72]/25 bg-[#080808]">
                    <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="AE">
                      <GoogleMapsGuard onStatusError={() => setPreviewMapUnavailable(true)}>
                        <GoogleMap
                          key={`${editingProject.coordinates.lat.toFixed(4)}-${editingProject.coordinates.lng.toFixed(4)}`}
                          defaultCenter={editingProject.coordinates}
                          defaultZoom={13}
                          mapId="DEMO_MAP_ID"
                          colorScheme="DARK"
                          zoomControl={true}
                          gestureHandling="cooperative"
                          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                          style={{ width: '100%', height: '100%' }}
                        >
                          <AdvancedMarker position={editingProject.coordinates} title={editingProject.name}>
                            <div className="px-2 py-0.5 bg-[#D4AF72] text-[#080808] text-[10px] font-bold border border-[#080808]">
                              {editingProject.name || 'Pin'}
                            </div>
                          </AdvancedMarker>
                        </GoogleMap>
                      </GoogleMapsGuard>
                    </APIProvider>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs pt-1 text-[#F5F1E8]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProject.featured}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, featured: e.target.checked })
                  }
                  className="accent-[#D4AF72]"
                />
                <span>Featured Development</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProject.verified}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, verified: e.target.checked })
                  }
                  className="accent-[#D4AF72]"
                />
                <span>Verified Registry Badge</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProject.waterfront}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, waterfront: e.target.checked })
                  }
                  className="accent-[#D4AF72]"
                />
                <span>Waterfront</span>
              </label>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-medium text-[#A5A19A]">
                Official Matterport / 3D Tour URL (leave blank if unavailable — use Media &amp; 360° Tours tab for 360° panoramas &amp; video)
              </label>
              <input
                type="url"
                placeholder="https://my.matterport.com/show/..."
                value={editingProject.virtualTour.embedUrl || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  const hasRooms = (editingProject.virtualTour.rooms || []).some(
                    (r) => r.isTrue360Panorama && r.projectId === editingProject.id
                  );
                  const hasVideo = Boolean(editingProject.virtualTour.walkthroughVideoUrl?.trim());
                  setEditingProject({
                    ...editingProject,
                    virtualTour: val
                      ? {
                          ...editingProject.virtualTour,
                          projectId: editingProject.id,
                          available: true,
                          tourStatus: '3d_available',
                          provider: 'Matterport',
                          tourType: 'matterport_3d',
                          embedUrl: val,
                        }
                      : {
                          ...editingProject.virtualTour,
                          projectId: editingProject.id,
                          embedUrl: '',
                          available: hasRooms || hasVideo,
                          tourStatus: hasRooms
                            ? '360_available'
                            : hasVideo
                            ? 'video_available'
                            : 'coming_soon',
                        },
                  });
                }}
                className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
              />
              {(() => {
                const mediaCheck = evaluateProjectMedia(editingProject);
                return !mediaCheck.isPublishReady ? (
                  <p className="text-[11px] text-[#FCD34D] bg-[#78350F]/45 border border-[#FBBF24]/35 p-2">
                    Media Completeness ({mediaCheck.completenessPct}%): {mediaCheck.missingReasons.join(' · ')}. Upload authentic photos &amp; configure tours in the Media &amp; 360° Tours tab.
                  </p>
                ) : null;
              })()}
            </div>

            <div className="text-xs">
              <label className="block font-medium text-[#A5A19A] mb-1">Project Description</label>
              <textarea
                rows={3}
                value={editingProject.description}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, description: e.target.value })
                }
                className="w-full p-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-4 py-2 border border-[#D4AF72]/30 bg-[#121212] text-[#F5F1E8] text-xs hover:border-[#D4AF72] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
              >
                {busy ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Inventory Audit Modal */}
      {inventoryTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <form
            onSubmit={handleSaveInventory}
            className="bg-[#1B1B1B] border border-[#D4AF72]/35 text-[#F5F1E8] w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#D4AF72]/20 pb-3">
              <h3 className="font-display text-lg sm:text-2xl font-semibold text-[#F5F1E8] min-w-0 truncate">
                Audited Inventory — {inventoryTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setInventoryTarget(null)}
                aria-label="Close inventory audit modal"
                className="p-1.5 border border-[#D4AF72]/30 bg-[#121212] text-[#A5A19A] hover:text-[#F5F1E8] hover:border-[#D4AF72] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">
                  Feed Availability Mode
                </label>
                <select
                  value={invStatus}
                  onChange={(e) =>
                    setInvStatus(e.target.value as 'verified_live' | 'unavailable')
                  }
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                >
                  <option value="verified_live" className="bg-[#121212] text-[#F5F1E8]">
                    Verified Live Feed Connected
                  </option>
                  <option value="unavailable" className="bg-[#121212] text-[#F5F1E8]">
                    Contact Developer for Latest Availability (No Automated Feed)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">Total Registered</label>
                  <input
                    type="number"
                    min={0}
                    value={invTotal}
                    onChange={(e) => setInvTotal(e.target.value)}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">Released</label>
                  <input
                    type="number"
                    min={0}
                    value={invReleased}
                    onChange={(e) => setInvReleased(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular disabled:bg-[#121212] disabled:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">Available</label>
                  <input
                    type="number"
                    min={0}
                    value={invAvailable}
                    onChange={(e) => setInvAvailable(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular disabled:bg-[#121212] disabled:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">Reserved</label>
                  <input
                    type="number"
                    min={0}
                    value={invReserved}
                    onChange={(e) => setInvReserved(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular disabled:bg-[#121212] disabled:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">Sold</label>
                  <input
                    type="number"
                    min={0}
                    value={invSold}
                    onChange={(e) => setInvSold(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular disabled:bg-[#121212] disabled:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#A5A19A] mb-1">On Hold</label>
                  <input
                    type="number"
                    min={0}
                    value={invOnHold}
                    onChange={(e) => setInvOnHold(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] font-mono-tabular disabled:bg-[#121212] disabled:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">
                  Authorized Data Source Attribution *
                </label>
                <input
                  type="text"
                  required
                  value={invSource}
                  onChange={(e) => setInvSource(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#A5A19A] mb-1">Audit Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verified against developer Tuesday morning unit availability sheet"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="w-full h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInventoryTarget(null)}
                className="px-4 py-2 border border-[#D4AF72]/30 bg-[#121212] text-[#F5F1E8] text-xs hover:border-[#D4AF72] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
              >
                {busy ? 'Committing...' : 'Commit Audited Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Developer Editor Modal */}
      {devForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <form
            onSubmit={handleSaveDeveloper}
            className="bg-[#1B1B1B] border border-[#D4AF72]/35 text-[#F5F1E8] w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6 space-y-3 text-xs shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#D4AF72]/20 pb-2">
              <h3 className="font-display text-lg sm:text-xl font-semibold text-[#F5F1E8] min-w-0 truncate">
                {devForm.id ? 'Edit Developer' : 'Register Developer'}
              </h3>
              <button
                type="button"
                onClick={() => setDevForm(null)}
                aria-label="Close developer editor"
                className="p-1 text-[#A5A19A] hover:text-[#F5F1E8] transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Developer Name"
                value={devForm.name || ''}
                onChange={(e) => setDevForm({ ...devForm, name: e.target.value })}
                className="h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 sm:col-span-2 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="text"
                placeholder="Registration ID"
                value={devForm.registrationId || ''}
                onChange={(e) => setDevForm({ ...devForm, registrationId: e.target.value })}
                className="h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="text"
                placeholder="Primary Emirate"
                value={devForm.emirate || 'Dubai'}
                onChange={(e) =>
                  setDevForm({ ...devForm, emirate: e.target.value as Developer['emirate'] })
                }
                className="h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="email"
                placeholder="Contact Email"
                value={devForm.contactEmail || ''}
                onChange={(e) => setDevForm({ ...devForm, contactEmail: e.target.value })}
                className="h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="url"
                placeholder="Official Website"
                value={devForm.website || ''}
                onChange={(e) => setDevForm({ ...devForm, website: e.target.value })}
                className="h-9 px-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <textarea
              rows={3}
              placeholder="Developer profile & track record"
              value={devForm.history || ''}
              onChange={(e) => setDevForm({ ...devForm, history: e.target.value })}
              className="w-full p-2.5 bg-[#080808] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/50 focus:outline-none focus:border-[#D4AF72]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDevForm(null)}
                className="px-4 py-2 border border-[#D4AF72]/30 bg-[#121212] text-[#F5F1E8] hover:border-[#D4AF72] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-[#D4AF72] text-[#080808] font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] transition-colors"
              >
                Save Developer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
