import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Camera,
  CheckCircle2,
  Compass,
  Database,
  FileSpreadsheet,
  History,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  Users,
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
import { formatProjectPrice } from '../utils/currency.ts';
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
  parseBulkCsvOnServer,
  triggerServerSyncRun,
  triggerWebhookTest,
} from '../services/apiClient.ts';
import { evaluateProjectMedia, MISSING_PROJECT_PHOTO_LABEL } from '../utils/mediaValidation.ts';
import { AdminMediaTourManager } from './AdminMediaTourManager.tsx';
import { AdminExcelImportPanel } from './AdminExcelImportPanel.tsx';
import { AdminTourDiscoveryPanel } from './AdminTourDiscoveryPanel.tsx';
import { AdminCompanySettingsPanel } from './AdminCompanySettingsPanel.tsx';
import { MapPin } from 'lucide-react';

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
  onClose,
}) => {
  const canManageProjects = isAdminRole(userProfile.role, userProfile.email);
  const canManageInventory = isInventoryManagerRole(userProfile.role, userProfile.email);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Project Add/Edit Modal State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isNewProject, setIsNewProject] = useState(false);

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

  const notify = (type: 'ok' | 'err', text: string) => {
    setBannerMsg({ type, text });
    setTimeout(() => setBannerMsg(null), 5500);
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
      propertyTypes: ['1 Bedroom', '2 Bedrooms'],
      tenure: 'Freehold',
      furnished: 'Unfurnished',
      startingPriceAed: 1500000,
      maxPriceAed: 6500000,
      pricePerSqFtAed: 2100,
      minSizeSqFt: 720,
      maxSizeSqFt: 2800,
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
      coordinates: { lat: 25.1972, lng: 55.2744 },
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
        dataSource: 'Pending live developer feed connection',
        sourceType: 'unavailable',
      },
      description: '',
      descriptionAr: '',
      updatedAt: now,
    });
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
          brochureUrl: `/api/projects/${encodeURIComponent(slug)}/brochure`,
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
          propertyTypes: ['1 Bedroom', '2 Bedrooms', '3 Bedrooms'],
          tenure: 'Freehold',
          furnished: 'Unfurnished',
          startingPriceAed: Number(row.startingPriceAed),
          maxPriceAed: Number(row.startingPriceAed) * 3,
          pricePerSqFtAed: 2150,
          minSizeSqFt: 760,
          maxSizeSqFt: 2800,
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
          coordinates: { lat: 25.1972, lng: 55.2744 },
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
    <div className="fixed inset-0 z-50 bg-[#FAF9F6] flex flex-col overflow-hidden">
      {/* Admin Top Header */}
      <header className="bg-[#111827] text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#E6C77A]">
            WHITE COLLAR REALTY · Operations Console
          </p>
          <h2 className="font-display text-2xl font-semibold">
            UAE Inventory, CRM & Developer Governance
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-white/80">
            {userProfile.email} · Role: <strong className="text-[#E6C77A]">{userProfile.role}</strong>
          </span>
          {canManageProjects && (
            <button
              type="button"
              onClick={handleSeedCatalog}
              disabled={busy}
              className="h-9 px-3 border border-white/25 text-xs font-medium hover:border-[#E6C77A] whitespace-nowrap"
            >
              Sync Baseline Catalog
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 bg-[#9A7B3C] text-white text-xs font-medium hover:bg-[#7D622D] flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>Exit Console</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-[#E5E2DC] px-6 flex items-center gap-4 overflow-x-auto shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-3.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-[#9A7B3C] text-[#111827]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Feedback Banner */}
      {bannerMsg && (
        <div
          className={`px-6 py-2.5 text-xs font-medium flex items-center gap-2 shrink-0 ${
            bannerMsg.type === 'ok'
              ? 'bg-[#ECFDF5] text-[#047857] border-b border-[#A7F3D0]'
              : 'bg-[#FEF2F2] text-[#B91C1C] border-b border-[#FECACA]'
          }`}
        >
          {bannerMsg.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{bannerMsg.text}</span>
        </div>
      )}

      {/* Main Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* 1. ANALYTICS OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E5E2DC] p-5">
                <p className="text-xs text-[#6B7280]">Total UAE Projects</p>
                <p className="font-mono-tabular text-3xl font-semibold text-[#111827] mt-1">
                  {projects.length}
                </p>
              </div>
              <div className="bg-white border border-[#E5E2DC] p-5">
                <p className="text-xs text-[#6B7280]">Verified Live Available Units</p>
                <p className="font-mono-tabular text-3xl font-semibold text-[#047857] mt-1">
                  {totalLiveAvailable}
                </p>
              </div>
              <div className="bg-white border border-[#E5E2DC] p-5">
                <p className="text-xs text-[#6B7280]">Open Client Enquiries</p>
                <p className="font-mono-tabular text-3xl font-semibold text-[#9A7B3C] mt-1">
                  {enquiries.filter((e) => e.status !== 'closed').length}
                </p>
              </div>
              <div className="bg-white border border-[#E5E2DC] p-5">
                <p className="text-xs text-[#6B7280]">Active Sync Feeds</p>
                <p className="font-mono-tabular text-3xl font-semibold text-[#111827] mt-1">
                  {syncProviders.filter((s) => s.enabled).length} / {syncProviders.length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E5E2DC] p-6">
              <h3 className="font-display text-2xl font-semibold text-[#111827] mb-4">
                Projects & Verified Available Units by Emirate
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emirateChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                    <XAxis dataKey="emirate" tick={{ fontSize: 12, fill: '#4B5563' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#4B5563' }} />
                    <Tooltip />
                    <Bar dataKey="availableUnits" name="Verified Available Units" fill="#9A7B3C" />
                    <Bar dataKey="projects" name="Listed Projects" fill="#111827" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* 2. PROJECTS & INVENTORY MANAGER */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#111827]">
                  UAE Project Registry & Unit Inventory Controls
                </h3>
                <p className="text-xs text-[#4B5563]">
                  Update verified unit counts or switch unavailable feeds transparently. Every inventory edit writes an immutable audit log.
                </p>
              </div>
              {canManageProjects && (
                <button
                  type="button"
                  onClick={openNewProjectForm}
                  className="h-10 px-4 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add UAE Project</span>
                </button>
              )}
            </div>

            <div className="bg-white border border-[#E5E2DC] overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#E5E2DC] bg-[#FAF9F6] text-[#6B7280] text-xs">
                    <th className="py-3 px-4">Project & Emirate</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Starting Price</th>
                    <th className="py-3 px-4">Inventory Status</th>
                    <th className="py-3 px-4">Available / Total</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {projects.map((proj) => (
                    <tr key={proj.id} className="hover:bg-[#FAF9F6]">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#111827]">{proj.name}</p>
                        <p className="text-xs text-[#6B7280]">
                          {proj.community}, {proj.emirate} · {proj.developerName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">{proj.category}</td>
                      <td className="py-3 px-4 font-mono-tabular font-semibold">
                        {formatProjectPrice(proj.startingPriceAed, currency)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {proj.inventory.status === 'verified_live' ? (
                          <span className="text-[#047857] font-semibold">Verified Live</span>
                        ) : (
                          <span className="text-[#B45309] font-medium">Feed Unavailable</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs">
                        {proj.inventory.status === 'verified_live'
                          ? `${proj.inventory.availableUnits} / ${proj.inventory.totalRegisteredUnits}`
                          : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          {canManageInventory && (
                            <button
                              type="button"
                              onClick={() => openInventoryEditor(proj)}
                              className="px-2.5 py-1.5 border border-[#E5E2DC] text-xs font-medium hover:border-[#9A7B3C]"
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
                                className="px-2.5 py-1.5 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(proj)}
                                aria-label={`Delete ${proj.name}`}
                                className="p-1.5 border border-[#E5E2DC] text-[#6B7280] hover:text-[#B91C1C]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <AdminCompanySettingsPanel mapsApiKey={mapsApiKey} />
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
          <div className="bg-white border border-[#E5E2DC] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl font-semibold text-[#111827]">
                  Bulk CSV Project & Inventory Importer
                </h3>
                <p className="text-xs text-[#4B5563] mt-0.5">
                  Leave unit-count columns empty when a project lacks an authorized unit feed; the platform automatically marks inventory as unavailable instead of guessing.
                </p>
              </div>
              <label className="h-9 px-3.5 border border-[#E5E2DC] text-xs font-medium hover:border-[#9A7B3C] cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-[#9A7B3C]" />
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
              className="w-full p-3 border border-[#E5E2DC] font-mono-tabular text-xs text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleValidateCsv}
                disabled={busy}
                className="px-4 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
              >
                Validate CSV via Server
              </button>
              {csvPreview && csvPreview.parsedProjects.length > 0 && canManageProjects && (
                <button
                  type="button"
                  onClick={handleCommitCsv}
                  disabled={busy}
                  className="px-4 py-2 bg-[#047857] text-white text-xs font-medium hover:opacity-90"
                >
                  Import {csvPreview.parsedProjects.length} Verified Projects to Firestore
                </button>
              )}
            </div>

            {csvPreview && (
              <div className="border border-[#E5E2DC] bg-[#FAF9F6] p-4 space-y-3 text-xs">
                <p className="font-semibold text-[#111827]">
                  Validation Summary: {csvPreview.parsedProjects.length} valid · {csvPreview.errors.length} skipped
                </p>
                {csvPreview.errors.map((err, i) => (
                  <p key={i} className="text-[#B91C1C]">
                    Row {err.row}: {err.message}
                  </p>
                ))}
                {csvPreview.parsedProjects.map((row) => (
                  <div key={String(row.id)} className="border-t border-[#E5E2DC] pt-2 flex justify-between">
                    <span>
                      <strong>{String(row.name)}</strong> ({String(row.emirate)}) — {String(row.dataSource)}
                    </span>
                    <span className="font-mono-tabular">
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-[#E5E2DC] p-6 space-y-4">
                <h3 className="font-display text-2xl font-semibold text-[#111827]">
                  Authorized Developer & Registry Sync Providers
                </h3>
                <div className="space-y-3">
                  {syncProviders.map((prov) => (
                    <div key={prov.id} className="border border-[#E5E2DC] p-4 bg-[#FAF9F6]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#111827]">{prov.name}</p>
                          <p className="text-xs font-mono-tabular text-[#6B7280]">{prov.endpointUrl}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold ${
                              prov.lastStatus === 'healthy'
                                ? 'text-[#047857]'
                                : prov.lastStatus === 'warning'
                                ? 'text-[#B45309]'
                                : 'text-[#B91C1C]'
                            }`}
                          >
                            {prov.lastStatus.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleProvider(prov)}
                            className="px-2.5 py-1 border border-[#E5E2DC] bg-white text-xs"
                          >
                            {prov.enabled ? 'Enabled' : 'Paused'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunProviderSync(prov)}
                            disabled={busy}
                            className="px-3 py-1 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
                          >
                            Run Sync Now
                          </button>
                        </div>
                      </div>
                      {prov.lastError && (
                        <p className="text-xs text-[#B45309] mt-2">{prov.lastError}</p>
                      )}
                      <p className="text-[11px] font-mono-tabular text-[#6B7280] mt-2">
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
                className="bg-white border border-[#E5E2DC] p-6 space-y-4"
              >
                <div className="flex items-center gap-2 text-[#9A7B3C]">
                  <Webhook className="w-4 h-4" />
                  <h3 className="font-display text-xl font-semibold text-[#111827]">
                    Real-Time Webhook Push
                  </h3>
                </div>
                <p className="text-xs text-[#4B5563]">
                  Simulate an incoming developer/CRM webhook push to verify real-time SSE updates and audit logging.
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#4B5563] mb-1">
                    Target Project
                  </label>
                  <select
                    value={webhookProjectId}
                    onChange={(e) => setWebhookProjectId(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white text-xs"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#4B5563] mb-1">
                      Available Units
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={webhookAvailable}
                      onChange={(e) => setWebhookAvailable(Number(e.target.value))}
                      className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#4B5563] mb-1">
                      Reserved Units
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={webhookReserved}
                      onChange={(e) => setWebhookReserved(Number(e.target.value))}
                      className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy || !canManageInventory}
                  className="w-full py-2.5 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] disabled:opacity-50"
                >
                  Dispatch Verified Webhook Delta
                </button>
              </form>
            </div>

            {/* Full Inventory History */}
            <div className="bg-white border border-[#E5E2DC] p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-[#9A7B3C]" />
                <h3 className="font-display text-2xl font-semibold text-[#111827]">
                  Complete Inventory Update History ({inventoryLogs.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {inventoryLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border-b border-[#E5E2DC] py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#111827]">{log.projectName}</span>
                      <span className="text-[#4B5563] ml-2">
                        Available: {log.previousAvailable ?? 'N/A'} → {log.newAvailable ?? 'N/A'} ·{' '}
                        {log.syncType} ({log.source})
                      </span>
                      {log.notes && <p className="text-[#6B7280] mt-0.5">{log.notes}</p>}
                    </div>
                    <span className="font-mono-tabular text-[#6B7280]">
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
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
                  className="h-9 px-4 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Developer</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {developers.map((dev) => (
                <div key={dev.id} className="bg-white border border-[#E5E2DC] p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#9A7B3C] font-semibold">
                        {dev.emirate} · {dev.registrationId}
                      </p>
                      <h4 className="font-display text-xl font-semibold text-[#111827]">
                        {dev.name}
                      </h4>
                    </div>
                    {canManageProjects && (
                      <button
                        type="button"
                        onClick={() => setDevForm(dev)}
                        className="px-2.5 py-1 border border-[#E5E2DC] text-xs hover:border-[#9A7B3C]"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#4B5563] line-clamp-2">{dev.history}</p>
                  <p className="text-xs font-mono-tabular text-[#6B7280]">
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
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
                Client Enquiries, Site Visits & Callback Queue
              </h3>
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="scheduled">Scheduled</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="bg-white border border-[#E5E2DC] p-8 text-center text-sm text-[#6B7280]">
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
                    <div key={enq.id} className="bg-white border border-[#E5E2DC] p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase text-[#9A7B3C]">
                            {enq.enquiryType.replace('_', ' ')} · {enq.projectName || 'General UAE Advisory'}
                          </span>
                          <h4 className="text-sm font-semibold text-[#111827] mt-0.5">
                            {enq.fullName} ({enq.email} {enq.phone ? `· ${enq.phone}` : ''})
                          </h4>
                        </div>
                        <span className="font-mono-tabular text-xs text-[#6B7280]">
                          {new Date(enq.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {enq.message && (
                        <p className="text-xs text-[#4B5563] bg-[#FAF9F6] p-3 border border-[#E5E2DC]">
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
                          className="h-9 px-2.5 border border-[#E5E2DC] bg-white text-xs"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="scheduled">Scheduled</option>
                          <option value="closed">Closed</option>
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
                          className="h-9 px-2.5 border border-[#E5E2DC] text-xs"
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
                          className="h-9 px-2.5 border border-[#E5E2DC] text-xs"
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
                          className="h-9 px-3 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
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
            <div className="bg-white border border-[#E5E2DC] p-6 space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
                Staff & User Role Governance
              </h3>
              {!canManageProjects ? (
                <p className="text-xs text-[#6B7280]">
                  Only Super Admins and Admins can modify user roles.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {users.map((u) => (
                    <div
                      key={u.uid}
                      className="border border-[#E5E2DC] p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#111827]">{u.displayName || u.email}</p>
                        <p className="text-[#6B7280]">{u.email}</p>
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
                        className="h-8 px-2 border border-[#E5E2DC] bg-white text-xs"
                      >
                        <option value="customer">Customer</option>
                        <option value="sales_agent">Sales Agent</option>
                        <option value="inventory_manager">Inventory Manager</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E2DC] p-6 space-y-4">
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
                Immutable Admin Audit Trail
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {adminLogs.map((log) => (
                  <div key={log.id} className="border-b border-[#E5E2DC] py-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#9A7B3C]">{log.action}</span>
                      <span className="font-mono-tabular text-[#6B7280]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#111827] mt-0.5">{log.summary}</p>
                    <p className="text-[#6B7280]">Actor: {log.actorEmail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project Edit/Create Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProject}
            className="bg-white border border-[#E5E2DC] w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
                {isNewProject ? 'Register New UAE Project' : `Edit ${editingProject.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="p-1.5 border border-[#E5E2DC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  value={editingProject.name}
                  onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Arabic Name</label>
                <input
                  type="text"
                  value={editingProject.nameAr}
                  onChange={(e) => setEditingProject({ ...editingProject, nameAr: e.target.value })}
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Emirate</label>
                <select
                  value={editingProject.emirate}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      emirate: e.target.value as EmiratesName,
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white"
                >
                  {EMIRATES.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Community *</label>
                <input
                  type="text"
                  required
                  value={editingProject.community}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, community: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Developer</label>
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
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white"
                >
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Category</label>
                <select
                  value={editingProject.category}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      category: e.target.value as ProjectCategory,
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Starting Price (AED)</label>
                <input
                  type="number"
                  value={editingProject.startingPriceAed}
                  onChange={(e) =>
                    setEditingProject({
                      ...editingProject,
                      startingPriceAed: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Construction %</label>
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
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Registration No.</label>
                <input
                  type="text"
                  value={editingProject.registrationNumber}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, registrationNumber: e.target.value })
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular"
                />
              </div>
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">
                  Property Types (comma-separated)
                </label>
                <input
                  type="text"
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
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProject.featured}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, featured: e.target.checked })
                  }
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
                />
                <span>Waterfront</span>
              </label>
            </div>

            <div className="text-xs space-y-2">
              <label className="block font-medium text-[#4B5563]">
                Official Matterport / 3D Tour URL (leave blank if unavailable — use Media & 360° Tours tab for 360° panoramas & video)
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
                className="w-full h-9 px-2.5 border border-[#E5E2DC]"
              />
              {(() => {
                const mediaCheck = evaluateProjectMedia(editingProject);
                return !mediaCheck.isPublishReady ? (
                  <p className="text-[11px] text-[#B45309] bg-[#FFFBEB] border border-[#FDE68A] p-2">
                    Media Completeness ({mediaCheck.completenessPct}%): {mediaCheck.missingReasons.join(' · ')}. Upload authentic photos & configure tours in the Media & 360° Tours tab.
                  </p>
                ) : null;
              })()}
            </div>

            <div className="text-xs">
              <label className="block font-medium text-[#4B5563] mb-1">Project Description</label>
              <textarea
                rows={3}
                value={editingProject.description}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, description: e.target.value })
                }
                className="w-full p-2.5 border border-[#E5E2DC]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="px-4 py-2 border border-[#E5E2DC] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
              >
                {busy ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Inventory Audit Modal */}
      {inventoryTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveInventory}
            className="bg-white border border-[#E5E2DC] w-full max-w-lg p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-3">
              <h3 className="font-display text-2xl font-semibold text-[#111827]">
                Audited Inventory — {inventoryTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setInventoryTarget(null)}
                className="p-1.5 border border-[#E5E2DC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-3">
              <div>
                <label className="block font-medium text-[#4B5563] mb-1">
                  Feed Availability Mode
                </label>
                <select
                  value={invStatus}
                  onChange={(e) =>
                    setInvStatus(e.target.value as 'verified_live' | 'unavailable')
                  }
                  className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white"
                >
                  <option value="verified_live">Verified Live Feed Connected</option>
                  <option value="unavailable">Inventory Feed Unavailable (Hide Unit Counts)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">Total Registered</label>
                  <input
                    type="number"
                    min={0}
                    value={invTotal}
                    onChange={(e) => setInvTotal(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">Released</label>
                  <input
                    type="number"
                    min={0}
                    value={invReleased}
                    onChange={(e) => setInvReleased(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular disabled:bg-[#F3F1EC]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">Available</label>
                  <input
                    type="number"
                    min={0}
                    value={invAvailable}
                    onChange={(e) => setInvAvailable(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular disabled:bg-[#F3F1EC]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">Reserved</label>
                  <input
                    type="number"
                    min={0}
                    value={invReserved}
                    onChange={(e) => setInvReserved(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular disabled:bg-[#F3F1EC]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">Sold</label>
                  <input
                    type="number"
                    min={0}
                    value={invSold}
                    onChange={(e) => setInvSold(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular disabled:bg-[#F3F1EC]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#4B5563] mb-1">On Hold</label>
                  <input
                    type="number"
                    min={0}
                    value={invOnHold}
                    onChange={(e) => setInvOnHold(e.target.value)}
                    disabled={invStatus === 'unavailable'}
                    className="w-full h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular disabled:bg-[#F3F1EC]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-[#4B5563] mb-1">
                  Authorized Data Source Attribution *
                </label>
                <input
                  type="text"
                  required
                  value={invSource}
                  onChange={(e) => setInvSource(e.target.value)}
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>

              <div>
                <label className="block font-medium text-[#4B5563] mb-1">Audit Note *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Verified against developer Tuesday morning unit availability sheet"
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                  className="w-full h-9 px-2.5 border border-[#E5E2DC]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInventoryTarget(null)}
                className="px-4 py-2 border border-[#E5E2DC] text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
              >
                {busy ? 'Committing...' : 'Commit Audited Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Developer Editor Modal */}
      {devForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDeveloper}
            className="bg-white border border-[#E5E2DC] w-full max-w-lg p-6 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-2">
              <h3 className="font-display text-xl font-semibold text-[#111827]">
                {devForm.id ? 'Edit Developer' : 'Register Developer'}
              </h3>
              <button type="button" onClick={() => setDevForm(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Developer Name"
                value={devForm.name || ''}
                onChange={(e) => setDevForm({ ...devForm, name: e.target.value })}
                className="h-9 px-2.5 border border-[#E5E2DC] col-span-2"
              />
              <input
                type="text"
                placeholder="Registration ID"
                value={devForm.registrationId || ''}
                onChange={(e) => setDevForm({ ...devForm, registrationId: e.target.value })}
                className="h-9 px-2.5 border border-[#E5E2DC]"
              />
              <input
                type="text"
                placeholder="Primary Emirate"
                value={devForm.emirate || 'Dubai'}
                onChange={(e) =>
                  setDevForm({ ...devForm, emirate: e.target.value as Developer['emirate'] })
                }
                className="h-9 px-2.5 border border-[#E5E2DC]"
              />
              <input
                type="email"
                placeholder="Contact Email"
                value={devForm.contactEmail || ''}
                onChange={(e) => setDevForm({ ...devForm, contactEmail: e.target.value })}
                className="h-9 px-2.5 border border-[#E5E2DC]"
              />
              <input
                type="url"
                placeholder="Official Website"
                value={devForm.website || ''}
                onChange={(e) => setDevForm({ ...devForm, website: e.target.value })}
                className="h-9 px-2.5 border border-[#E5E2DC]"
              />
            </div>
            <textarea
              rows={3}
              placeholder="Developer profile & track record"
              value={devForm.history || ''}
              onChange={(e) => setDevForm({ ...devForm, history: e.target.value })}
              className="w-full p-2.5 border border-[#E5E2DC]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDevForm(null)}
                className="px-4 py-2 border border-[#E5E2DC]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-[#111827] text-white font-medium hover:bg-[#9A7B3C]"
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
