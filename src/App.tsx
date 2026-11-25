import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bookmark,
  Building2,
  Clock,
  Compass,
  ExternalLink,
  FileSpreadsheet,
  Film,
  GitCompare,
  Globe,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Shield,
  ShieldCheck,
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
  EnquiryType,
  InventoryLog,
  Language,
  Project,
  SavedSearch,
  SearchFilters,
  SyncProvider,
  UserFavorite,
  UserProfile,
} from './types/realEstate.ts';
import {
  IMG_HERO_DUBAI,
  INITIAL_DEVELOPERS,
  INITIAL_INVENTORY_LOGS,
  INITIAL_PROJECTS,
  INITIAL_SYNC_PROVIDERS,
  LEGACY_SAMPLE_IDS,
} from './data/uaeCatalog.ts';
import { TRANSLATIONS } from './i18n/translations.ts';
import { formatProjectPrice } from './utils/currency.ts';
import {
  getEffectiveTourStatus,
  MISSING_PROJECT_PHOTO_LABEL,
  TOUR_STATUS_LABELS,
} from './utils/mediaValidation.ts';
import { exportCatalogToExcel } from './utils/exportUtils.ts';
import {
  doesProjectMatchBathroomFilter,
  doesProjectMatchBhkFilter,
  formatPropertyAreaSqFt,
  formatPropertyBhk,
} from './utils/propertySpecs.ts';
import { getGoogleMapsDirectionsUrl } from './utils/coordinates.ts';
import { auth, googleAuthProvider, testFirestoreConnection } from './lib/firebase.ts';
import {
  createSavedSearch,
  deleteSavedSearch,
  isAdminRole,
  isStaffRole,
  subscribeAdminAuditLogs,
  subscribeAllEnquiries,
  subscribeAllUsers,
  subscribeDevelopers,
  subscribeInventoryLogs,
  subscribeProjects,
  subscribeSavedSearches,
  subscribeSyncProviders,
  subscribeUserEnquiries,
  subscribeUserFavorites,
  submitEnquiry,
  syncUserProfile,
  syncVerifiedCatalogToFirestore,
  toggleUserFavorite,
} from './services/firestoreService.ts';
import {
  fetchClientConfig,
  fetchLiveInventoryUpdates,
  fetchProjectInventoryStatus,
  LiveInventoryOverlayRecord,
  notifyPublicEnquiryCreated,
  refreshProjectTelemetryOnServer,
} from './services/apiClient.ts';
import { ProjectCard } from './components/ProjectCard.tsx';
import { SearchEngineBar } from './components/SearchEngineBar.tsx';
import { UAEPropertyMap } from './components/UAEPropertyMap.tsx';
import { ProjectDetailsPage } from './components/ProjectDetailsPage.tsx';
import { VirtualTourModal } from './components/VirtualTourModal.tsx';
import { InvestmentCalculator } from './components/InvestmentCalculator.tsx';
import { CompareProjectsModal } from './components/CompareProjectsModal.tsx';
import { EnquiryModal } from './components/EnquiryModal.tsx';
import { CustomerPortalModal } from './components/CustomerPortalModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { OfficeLocationMap } from './components/OfficeLocationMap.tsx';
import { CinematicIntro, INTRO_SEEN_STORAGE_KEY } from './components/CinematicIntro.tsx';
import { AnimatedNumber, ScrollReveal } from './components/ScrollReveal.tsx';
import { useCompanyInfo } from './data/companyInfo.ts';

const RECENTLY_VIEWED_KEY = 'wcr_recently_viewed_ids';

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  emirate: '',
  community: '',
  category: '',
  propertyType: '',
  bedroomCount: '',
  minBathrooms: '',
  developerId: '',
  minBudgetAed: '',
  maxBudgetAed: '',
  minSizeSqFt: '',
  maxSizeSqFt: '',
  maxMonthlyPaymentAed: '',
  maxDownPaymentPct: '',
  minConstructionPct: '',
  handoverYear: '',
  tenure: '',
  furnished: '',
  paymentPlanFilter: '',
  minYieldPct: '',
  maxLandmarkDistanceKm: '',
  landmarkCategory: '',
  tourFilter: '',
  investmentOnly: false,
  waterfrontOnly: false,
  verifiedAvailableOnly: false,
  sortBy: 'featured',
};

const EMIRATES_LIST: EmiratesName[] = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];

const PRIMARY_EMIRATE_PAGES: Array<{ emirate: EmiratesName | ''; label: string }> = [
  { emirate: '', label: 'All Projects' },
  { emirate: 'Dubai', label: 'Dubai Projects' },
  { emirate: 'Abu Dhabi', label: 'Abu Dhabi Projects' },
  { emirate: 'Ras Al Khaimah', label: 'Ras Al Khaimah Projects' },
  { emirate: 'Sharjah', label: 'Sharjah Projects' },
  { emirate: 'Umm Al Quwain', label: 'Umm Al Quwain Projects' },
  { emirate: 'Ajman', label: 'Ajman Projects' },
  { emirate: 'Fujairah', label: 'Fujairah Projects' },
];

const EMIRATE_SLUG_MAP: Record<string, EmiratesName> = {
  dubai: 'Dubai',
  'abu-dhabi': 'Abu Dhabi',
  'ras-al-khaimah': 'Ras Al Khaimah',
  sharjah: 'Sharjah',
  'umm-al-quwain': 'Umm Al Quwain',
  ajman: 'Ajman',
  fujairah: 'Fujairah',
};

const CURRENCIES: CurrencyCode[] = ['AED', 'USD', 'INR', 'GBP', 'EUR', 'SAR'];

type CatalogSegment =
  | 'all'
  | 'featured'
  | 'exclusive_luxury'
  | 'newly_launched'
  | 'trending_investment'
  | 'off_plan'
  | 'ready'
  | 'live_inventory'
  | 'recently_added';
const PAGE_SIZE = 24;

export default function App() {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    try {
      if (typeof window === 'undefined') return false;
      const prefersReduced =
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return false;
      return window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY) !== '1';
    } catch {
      return false;
    }
  });
  const [heroParallaxY, setHeroParallaxY] = useState(0);

  const companyInfo = useCompanyInfo();
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState<Language>('en');
  const [currency, setCurrency] = useState<CurrencyCode>('AED');
  const [mapsApiKey, setMapsApiKey] = useState<string>('');
  const [mapsConfigLoading, setMapsConfigLoading] = useState<boolean>(true);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  // Core catalog datasets (seeded baseline immediately hydrated by Firestore onSnapshot & live overlay)
  const [rawProjects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [liveOverlayMap, setLiveOverlayMap] = useState<Record<string, LiveInventoryOverlayRecord>>({});
  const [telemetryVerifiedMap, setTelemetryVerifiedMap] = useState<Record<string, string>>({});
  const projects = useMemo(() => {
    const hasOverlay =
      Object.keys(liveOverlayMap).length > 0 || Object.keys(telemetryVerifiedMap).length > 0;
    if (!hasOverlay) return rawProjects;
    return rawProjects.map((p) => {
      const overlay = liveOverlayMap[p.id];
      const verifiedAt = telemetryVerifiedMap[p.id];
      if (!overlay && !verifiedAt) return p;
      return {
        ...p,
        ...(verifiedAt ? { lastVerifiedAt: verifiedAt } : {}),
        ...(overlay
          ? {
              inventory: {
                ...p.inventory,
                status: overlay.status,
                totalRegisteredUnits: overlay.totalRegisteredUnits,
                releasedUnits: overlay.releasedUnits,
                availableUnits: overlay.availableUnits,
                soldUnits: overlay.soldUnits,
                reservedUnits: overlay.reservedUnits,
                onHoldUnits: overlay.onHoldUnits,
                remainingUnits: overlay.remainingUnits,
                availabilityPct: overlay.availabilityPct,
                lastUpdatedAt: overlay.lastUpdatedAt,
                dataSource: overlay.dataSource,
                sourceType:
                  (overlay.sourceType as Project['inventory']['sourceType']) ||
                  p.inventory.sourceType,
              },
            }
          : {}),
      };
    });
  }, [rawProjects, liveOverlayMap, telemetryVerifiedMap]);
  const [developers, setDevelopers] = useState<Developer[]>(INITIAL_DEVELOPERS);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(INITIAL_INVENTORY_LOGS);
  const [syncProviders, setSyncProviders] = useState<SyncProvider[]>(INITIAL_SYNC_PROVIDERS);

  // Recently Viewed IDs (persisted cleanly in localStorage)
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  // Auth & User State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [userEnquiries, setUserEnquiries] = useState<Enquiry[]>([]);

  // Staff/Admin Datasets
  const [allEnquiries, setAllEnquiries] = useState<Enquiry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminAuditLog[]>([]);

  // Search, Routing & UI Modals
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#emirate/')) {
      const slug = decodeURIComponent(hash.slice('#emirate/'.length)).toLowerCase();
      const matchedEmirate = EMIRATE_SLUG_MAP[slug];
      if (matchedEmirate) {
        return { ...DEFAULT_FILTERS, emirate: matchedEmirate };
      }
    }
    return DEFAULT_FILTERS;
  });
  const [segment, setSegment] = useState<CatalogSegment>('all');
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const [showAllPaged, setShowAllPaged] = useState<boolean>(false);
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#project/')) {
      return decodeURIComponent(hash.slice('#project/'.length));
    }
    return null;
  });

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [virtualTourProject, setVirtualTourProject] = useState<Project | null>(null);
  const [enquiryModalState, setEnquiryModalState] = useState<{
    open: boolean;
    type: EnquiryType;
    project: Project | null;
    requestContext?: 'availability_sheet' | null;
  }>({ open: false, type: 'callback', project: null, requestContext: null });
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Quick Direct Contact Desk Form State
  const [deskName, setDeskName] = useState('');
  const [deskEmail, setDeskEmail] = useState('');
  const [deskPhone, setDeskPhone] = useState('');
  const [deskMsg, setDeskMsg] = useState('');
  const [deskSubmitting, setDeskSubmitting] = useState(false);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [deskSubmitted, setDeskSubmitted] = useState(false);

  const t = TRANSLATIONS[language];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((curr) => (curr === msg ? null : curr)), 4500);
  };

  const handleReplayIntro = () => {
    setShowAdminModal(false);
    setShowPortalModal(false);
    setShowIntro(true);
  };

  // Restrained desktop-only parallax for hero skyline
  useEffect(() => {
    if (selectedProjectSlug) return;
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || window.innerWidth < 1024) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = Math.min(36, Math.max(0, window.scrollY * 0.08));
        setHeroParallaxY(y);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [selectedProjectSlug]);

  // Document direction & lang attribute sync
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Listen for Tier 2 Google Maps Demo Key quota events
  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const loadClientMapsConfig = React.useCallback(() => {
    setMapsConfigLoading(true);
    fetchClientConfig()
      .then((cfg) => {
        if (cfg.mapsApiKey) {
          setMapsApiKey(cfg.mapsApiKey);
          setMapsQuotaExceeded(false);
        }
      })
      .finally(() => {
        setMapsConfigLoading(false);
      });
  }, []);

  // Load Maps API key, hydrate live server inventory overlay, & verify Firestore connectivity
  useEffect(() => {
    loadClientMapsConfig();
    fetchLiveInventoryUpdates().then(({ updates, telemetryCheckedAt }) => {
      if (updates && Object.keys(updates).length > 0) {
        setLiveOverlayMap((prev) => ({ ...prev, ...updates }));
      }
      if (telemetryCheckedAt && Object.keys(telemetryCheckedAt).length > 0) {
        setTelemetryVerifiedMap((prev) => ({ ...prev, ...telemetryCheckedAt }));
      }
    });
    testFirestoreConnection();
  }, [loadClientMapsConfig]);

  // Hash navigation listener for deep-linked project & Emirate pages
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#project/')) {
        setSelectedProjectSlug(decodeURIComponent(hash.slice('#project/'.length)));
      } else if (hash.startsWith('#emirate/')) {
        setSelectedProjectSlug(null);
        const slug = decodeURIComponent(hash.slice('#emirate/'.length)).toLowerCase();
        const matched = EMIRATE_SLUG_MAP[slug] || '';
        setFilters((prev) => ({ ...prev, emirate: matched, community: '' }));
      } else {
        setSelectedProjectSlug(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Reset pagination whenever filters or segment change
  useEffect(() => {
    setCatalogPage(1);
  }, [filters, segment]);

  // Subscribe to Server-Sent Events (/api/events) for real-time webhook & sync notifications
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('inventory:updated', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data.projectId) {
          const total =
            typeof data.totalRegisteredUnits === 'number' ? data.totalRegisteredUnits : null;
          const avail =
            typeof data.availableUnits === 'number' ? data.availableUnits : null;
          setLiveOverlayMap((prev) => ({
            ...prev,
            [data.projectId]: {
              projectId: data.projectId,
              status: avail !== null ? 'verified_live' : 'unavailable',
              totalRegisteredUnits: total,
              releasedUnits:
                total !== null ? total : prev[data.projectId]?.releasedUnits ?? null,
              availableUnits: avail,
              soldUnits: typeof data.soldUnits === 'number' ? data.soldUnits : null,
              reservedUnits:
                typeof data.reservedUnits === 'number' ? data.reservedUnits : null,
              onHoldUnits: prev[data.projectId]?.onHoldUnits ?? null,
              remainingUnits: avail,
              availabilityPct:
                total && total > 0 && avail !== null
                  ? Math.round((avail / total) * 100)
                  : null,
              lastUpdatedAt: data.receivedAt || new Date().toISOString(),
              dataSource: data.source || 'Live Developer Webhook',
              sourceType: 'developer_webhook',
            },
          }));
        }
        showToast(
          data.availableUnits !== null && data.availableUnits !== undefined
            ? `Live Inventory Sync: ${data.projectName || data.projectId} updated (${data.availableUnits} units available)`
            : `Inventory update received for ${data.projectName || data.projectId}.`
        );
      } catch {
        // ignore parse issues
      }
    });
    es.addEventListener('project:updated', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        if (data.projectId && data.lastVerifiedAt) {
          setTelemetryVerifiedMap((prev) => ({
            ...prev,
            [data.projectId]: data.lastVerifiedAt,
          }));
        }
        if (data.projectId && data.inventory) {
          setLiveOverlayMap((prev) => ({
            ...prev,
            [data.projectId]: data.inventory,
          }));
        }
      } catch {
        // ignore
      }
    });
    es.addEventListener('sync:completed', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        showToast(`Feed Synced: ${data.providerName}`);
      } catch {
        // ignore
      }
    });
    return () => es.close();
  }, []);

  // Public Firestore Catalog Subscriptions (always guarantees full 182-project catalog while merging live Firestore state)
  useEffect(() => {
    const legacyIdSet = new Set(LEGACY_SAMPLE_IDS);
    const unsubProjects = subscribeProjects((list) => {
      const validRemote = list.filter((p) => !legacyIdSet.has(p.id));
      const hasLegacyOrIncomplete =
        list.some((p) => legacyIdSet.has(p.id)) ||
        validRemote.length === 0 ||
        !validRemote.some((p) => p.importBatchId === 'excel_182_verified_sync');

      if (!hasLegacyOrIncomplete) {
        setProjects(validRemote);
        return;
      }

      if (validRemote.length > 0) {
        const merged = new Map<string, Project>(INITIAL_PROJECTS.map((p) => [p.id, p]));
        for (const remoteProj of validRemote) {
          merged.set(remoteProj.id, remoteProj);
        }
        setProjects(Array.from(merged.values()));
      } else {
        setProjects(INITIAL_PROJECTS);
      }
    });
    const unsubDevs = subscribeDevelopers((list) => {
      if (list.length >= INITIAL_DEVELOPERS.length) {
        setDevelopers(list);
      } else if (list.length > 0) {
        const mergedDevs = new Map<string, Developer>(INITIAL_DEVELOPERS.map((d) => [d.id, d]));
        for (const dev of list) {
          mergedDevs.set(dev.id, dev);
        }
        setDevelopers(Array.from(mergedDevs.values()));
      } else {
        setDevelopers(INITIAL_DEVELOPERS);
      }
    });
    const unsubLogs = subscribeInventoryLogs((list) => {
      if (list.length > 0) setInventoryLogs(list);
    });
    return () => {
      unsubProjects();
      unsubDevs();
      unsubLogs();
    };
  }, []);

  // Firebase Auth & Role-Scoped Firestore Subscriptions
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user || !user.email) {
        setUserProfile(null);
        setFavorites([]);
        setSavedSearches([]);
        setUserEnquiries([]);
        setAllEnquiries([]);
        setAllUsers([]);
        setAdminLogs([]);
        return;
      }

      try {
        const profile = await syncUserProfile(user.uid, user.email, user.displayName);
        setUserProfile(profile);

        if (isAdminRole(profile.role, profile.email)) {
          await syncVerifiedCatalogToFirestore(profile.uid, profile.email);
        }
      } catch {
        // Handled by Firestore error helper
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    const unsubFavs = subscribeUserFavorites(userProfile.uid, setFavorites);
    const unsubSearches = subscribeSavedSearches(userProfile.uid, setSavedSearches);
    const unsubUserEnq = subscribeUserEnquiries(userProfile.uid, setUserEnquiries);

    let unsubStaffEnq: (() => void) | undefined;
    let unsubProviders: (() => void) | undefined;
    let unsubUsers: (() => void) | undefined;
    let unsubAudit: (() => void) | undefined;

    if (isStaffRole(userProfile.role, userProfile.email)) {
      unsubStaffEnq = subscribeAllEnquiries(setAllEnquiries, () => {});
      unsubProviders = subscribeSyncProviders(
        (list) => {
          if (list.length > 0) setSyncProviders(list);
        },
        () => {}
      );
      unsubAudit = subscribeAdminAuditLogs(setAdminLogs, () => {});
      if (isAdminRole(userProfile.role, userProfile.email)) {
        unsubUsers = subscribeAllUsers(setAllUsers, () => {});
      }
    }

    return () => {
      unsubFavs();
      unsubSearches();
      unsubUserEnq();
      unsubStaffEnq?.();
      unsubProviders?.();
      unsubUsers?.();
      unsubAudit?.();
    };
  }, [userProfile]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
      showToast('Signed in to WHITE COLLAR REALTY Client Portal.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Google Sign-In was cancelled.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setShowAdminModal(false);
    setShowPortalModal(false);
    showToast('Signed out.');
  };

  const openProjectPage = (project: Project) => {
    setRecentlyViewedIds((prev) => {
      const next = [project.id, ...prev.filter((id) => id !== project.id)].slice(0, 8);
      try {
        window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
    window.location.hash = `project/${encodeURIComponent(project.slug)}`;
    setSelectedProjectSlug(project.slug);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEmiratePage = (emirate: EmiratesName | '') => {
    setSelectedProjectSlug(null);
    setFilters({ ...DEFAULT_FILTERS, emirate });
    setSegment('all');
    setCatalogPage(1);
    setShowAllPaged(false);
    if (emirate) {
      const slug = emirate.toLowerCase().replace(/\s+/g, '-');
      window.location.hash = `emirate/${slug}`;
    } else {
      window.location.hash = 'projects';
    }
    setTimeout(() => {
      document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
    }, 30);
  };

  const closeProjectPage = () => {
    window.location.hash = '';
    setSelectedProjectSlug(null);
  };

  const handleToggleFavorite = async (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!userProfile) {
      setShowPortalModal(true);
      showToast('Sign in with Google to save favorite projects.');
      return;
    }
    const currentlySaved = favorites.some((f) => f.projectId === project.id);
    try {
      await toggleUserFavorite(userProfile.uid, project.id, project.name, currentlySaved);
      showToast(
        currentlySaved ? `Removed "${project.name}" from saved.` : `Saved "${project.name}".`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to update saved project in your portal.'
      );
    }
  };

  const handleToggleCompare = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCompareIds((prev) => {
      if (prev.includes(project.id)) {
        return prev.filter((id) => id !== project.id);
      }
      if (prev.length >= 4) {
        showToast('Comparison is limited to 4 developments at once.');
        return prev;
      }
      return [...prev, project.id];
    });
  };

  const openAvailabilitySheet = (project: Project, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEnquiryModalState({
      open: true,
      type: 'availability_alert',
      project,
      requestContext: 'availability_sheet',
    });
  };

  const handleSaveCurrentSearch = async () => {
    if (!userProfile) {
      setShowPortalModal(true);
      showToast('Sign in with Google to save searches & receive availability alerts.');
      return;
    }
    const title = [
      filters.emirate || 'All UAE',
      filters.propertyType || 'All Types',
      filters.maxBudgetAed ? `<= AED ${Number(filters.maxBudgetAed).toLocaleString()}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    try {
      await createSavedSearch(userProfile.uid, {
        title,
        emirate: filters.emirate || undefined,
        maxBudgetAed: filters.maxBudgetAed === '' ? undefined : Number(filters.maxBudgetAed),
        propertyType: filters.propertyType || undefined,
        category: filters.category || undefined,
        alertsEnabled: true,
      });
      showToast(`Saved search "${title}" with live price & unit alerts.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save search right now.');
    }
  };

  const handleRefreshProjectInventory = async (project: Project) => {
    try {
      const res = await refreshProjectTelemetryOnServer(project.id);
      if (res.lastVerifiedAt) {
        setTelemetryVerifiedMap((prev) => ({
          ...prev,
          [project.id]: res.lastVerifiedAt as string,
        }));
      }
      if (res.inventory) {
        setLiveOverlayMap((prev) => ({
          ...prev,
          [project.id]: res.inventory as LiveInventoryOverlayRecord,
        }));
      }
      showToast(
        res.message ||
          (res.status === 'verified_live'
            ? 'Live unit availability synchronized.'
            : 'Registry verified. Contact Developer for Latest Availability.')
      );
    } catch {
      try {
        const invRes = await fetchProjectInventoryStatus(project.id);
        if (invRes.lastVerifiedAt) {
          setTelemetryVerifiedMap((prev) => ({
            ...prev,
            [project.id]: invRes.lastVerifiedAt,
          }));
        }
        if (invRes.inventory) {
          setLiveOverlayMap((prev) => ({
            ...prev,
            [project.id]: invRes.inventory,
          }));
        }
        showToast(invRes.contactMessage || 'Contact Developer for Latest Availability.');
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Unable to check live availability. Contact Developer for Latest Availability.'
        );
      }
    }
  };

  // Distinct communities for SearchEngineBar
  const communities = useMemo(() => {
    const filteredByEmirate = filters.emirate
      ? projects.filter((p) => p.emirate === filters.emirate)
      : projects;
    return Array.from(new Set(filteredByEmirate.map((p) => p.community))).sort();
  }, [projects, filters.emirate]);

  const recentlyViewedProjects = useMemo(() => {
    return recentlyViewedIds
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is Project => Boolean(p));
  }, [recentlyViewedIds, projects]);

  // Dynamic Filtering & Sorting Engine
  const filteredProjects = useMemo(() => {
    const list = projects.filter((p) => {
      // Quick Segment Tabs
      if (segment === 'featured' && !p.featured) return false;
      if (segment === 'exclusive_luxury' && p.startingPriceAed < 8000000 && !p.brandedResidence) {
        return false;
      }
      if (
        segment === 'newly_launched' &&
        p.category !== 'Upcoming launch' &&
        !p.launchDate.startsWith('2025') &&
        !p.launchDate.startsWith('2026')
      ) {
        return false;
      }
      if (segment === 'trending_investment' && (p.investment.grossYieldPct ?? 0) < 7.0) {
        return false;
      }
      if (segment === 'ready' && p.category !== 'Ready-to-move') return false;
      if (segment === 'off_plan' && p.category !== 'Off-plan') return false;
      if (
        segment === 'live_inventory' &&
        (p.inventory.status !== 'verified_live' || !p.inventory.availableUnits)
      ) {
        return false;
      }

      // Text query
      if (filters.query.trim()) {
        const q = filters.query.trim().toLowerCase();
        const hay =
          `${p.name} ${p.nameAr} ${p.community} ${p.neighbourhood} ${p.emirate} ${p.developerName} ${p.registrationNumber} ${p.buildingName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (filters.emirate && p.emirate !== filters.emirate) return false;
      if (filters.community && p.community !== filters.community) return false;
      if (filters.category && p.category !== filters.category) return false;
      if (
        filters.propertyType &&
        !p.propertyTypes.includes(filters.propertyType as never)
      ) {
        return false;
      }
      if (
        filters.bedroomCount &&
        !doesProjectMatchBhkFilter(p, filters.bedroomCount)
      ) {
        return false;
      }
      if (
        filters.minBathrooms !== '' &&
        !doesProjectMatchBathroomFilter(p, Number(filters.minBathrooms))
      ) {
        return false;
      }
      if (filters.developerId && p.developerId !== filters.developerId) return false;

      if (
        filters.minBudgetAed !== '' &&
        (p.startingPriceAed <= 0 || p.maxPriceAed < Number(filters.minBudgetAed))
      ) {
        return false;
      }
      if (
        filters.maxBudgetAed !== '' &&
        (p.startingPriceAed <= 0 || p.startingPriceAed > Number(filters.maxBudgetAed))
      ) {
        return false;
      }
      if (
        filters.minSizeSqFt !== '' &&
        (p.maxSizeSqFt <= 0 || p.maxSizeSqFt < Number(filters.minSizeSqFt))
      ) {
        return false;
      }
      if (
        filters.maxSizeSqFt !== '' &&
        (p.minSizeSqFt <= 0 || p.minSizeSqFt > Number(filters.maxSizeSqFt))
      ) {
        return false;
      }

      // Monthly affordability estimate: 20-year 4.5% P&I on financed balance
      if (filters.maxMonthlyPaymentAed !== '') {
        if (p.startingPriceAed <= 0) return false;
        const principal = p.startingPriceAed * (1 - p.downPaymentPct / 100);
        const r = 0.045 / 12;
        const n = 240;
        const monthlyEst = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
        if (monthlyEst > Number(filters.maxMonthlyPaymentAed)) return false;
      }

      if (
        filters.maxDownPaymentPct !== '' &&
        p.downPaymentPct > Number(filters.maxDownPaymentPct)
      ) {
        return false;
      }
      if (
        filters.minConstructionPct !== '' &&
        p.constructionPct < Number(filters.minConstructionPct)
      ) {
        return false;
      }
      if (filters.handoverYear) {
        const hy = Number(filters.handoverYear);
        if (hy === 2024 && p.handoverYear > 2025) return false;
        if (hy === 2029 && p.handoverYear < 2029) return false;
        if (hy !== 2024 && hy !== 2029 && p.handoverYear !== hy) return false;
      }
      if (filters.tenure && p.tenure !== filters.tenure) return false;
      if (filters.furnished && p.furnished !== filters.furnished) return false;
      if (
        filters.paymentPlanFilter.trim() &&
        !p.paymentPlan.toLowerCase().includes(filters.paymentPlanFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        filters.minYieldPct !== '' &&
        (p.investment.grossYieldPct ?? 0) < Number(filters.minYieldPct)
      ) {
        return false;
      }
      if (filters.investmentOnly && (p.investment.grossYieldPct ?? 0) < 7.0) {
        return false;
      }
      if (filters.tourFilter) {
        const eff = getEffectiveTourStatus(p);
        if (filters.tourFilter === 'any_media' && eff === 'coming_soon') return false;
        if (filters.tourFilter === '3d_or_360' && eff !== '360_available' && eff !== '3d_available') {
          return false;
        }
        if (filters.tourFilter === 'video_only' && eff !== 'video_available') return false;
      }
      if (filters.landmarkCategory || filters.maxLandmarkDistanceKm !== '') {
        const maxKm =
          filters.maxLandmarkDistanceKm === '' ? 999 : Number(filters.maxLandmarkDistanceKm);
        const matchedLandmark = p.nearbyLandmarks.some((lm) => {
          const catOk = !filters.landmarkCategory || lm.category === filters.landmarkCategory;
          return catOk && lm.distanceKm <= maxKm;
        });
        if (!matchedLandmark) return false;
      }
      if (filters.waterfrontOnly && !p.waterfront) return false;
      if (
        filters.verifiedAvailableOnly &&
        (p.inventory.status !== 'verified_live' || !p.inventory.availableUnits)
      ) {
        return false;
      }

      return true;
    });

    const effectiveSort = segment === 'recently_added' ? 'newest' : filters.sortBy;

    // Sort results
    return [...list].sort((a, b) => {
      switch (effectiveSort) {
        case 'lowest_price': {
          const ap = a.startingPriceAed > 0 ? a.startingPriceAed : Number.MAX_SAFE_INTEGER;
          const bp = b.startingPriceAed > 0 ? b.startingPriceAed : Number.MAX_SAFE_INTEGER;
          return ap - bp;
        }
        case 'highest_price':
          return b.startingPriceAed - a.startingPriceAed;
        case 'newest':
          return (b.updatedAt || b.launchDate).localeCompare(a.updatedAt || a.launchDate);
        case 'highest_availability':
          return (b.inventory.availableUnits ?? -1) - (a.inventory.availableUnits ?? -1);
        case 'nearest_handover':
          return a.handoverYear - b.handoverYear;
        case 'best_investment':
          return (b.investment.grossYieldPct ?? 0) - (a.investment.grossYieldPct ?? 0);
        case 'featured':
        default:
          return Number(b.featured) - Number(a.featured) || b.constructionPct - a.constructionPct;
      }
    });
  }, [projects, filters, segment]);

  // Emirate Market Benchmark Chart Data
  const emirateInsightsData = useMemo(() => {
    return EMIRATES_LIST.map((em) => {
      const items = projects.filter((p) => p.emirate === em);
      const psfItems = items.filter((p) => p.pricePerSqFtAed > 0);
      const avgPsf = psfItems.length
        ? Math.round(psfItems.reduce((s, p) => s + p.pricePerSqFtAed, 0) / psfItems.length)
        : 0;
      const yieldItems = items.filter((p) => (p.investment.grossYieldPct ?? 0) > 0);
      const avgYield = yieldItems.length
        ? Number(
            (
              yieldItems.reduce((s, p) => s + (p.investment.grossYieldPct ?? 0), 0) /
              yieldItems.length
            ).toFixed(1)
          )
        : 0;
      return {
        emirate: em.replace('Ras Al Khaimah', 'RAK').replace('Umm Al Quwain', 'UAQ'),
        fullName: em,
        avgPsf,
        avgYield,
        projectCount: items.length,
      };
    });
  }, [projects]);

  const activeDetailProject = useMemo(
    () =>
      selectedProjectSlug
        ? projects.find((p) => p.slug === selectedProjectSlug || p.id === selectedProjectSlug) ||
          null
        : null,
    [projects, selectedProjectSlug]
  );

  const comparedProjects = useMemo(
    () => projects.filter((p) => compareIds.includes(p.id)),
    [projects, compareIds]
  );

  const totalCatalogPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));

  const visibleCatalogProjects = useMemo(() => {
    if (showAllPaged) return filteredProjects;
    const start = (catalogPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [filteredProjects, catalogPage, showAllPaged]);

  const emirateCounts = useMemo(() => {
    const counts: Record<string, number> = { '': projects.length };
    for (const em of EMIRATES_LIST) {
      counts[em] = 0;
    }
    for (const p of projects) {
      counts[p.emirate] = (counts[p.emirate] || 0) + 1;
    }
    return counts;
  }, [projects]);

  const tourShowcaseProjects = useMemo(() => {
    const live = projects.filter((p) => getEffectiveTourStatus(p) !== 'coming_soon');
    const coming = projects.filter((p) => getEffectiveTourStatus(p) === 'coming_soon');
    return [...live, ...coming].slice(0, 4);
  }, [projects]);

  const liveInventoryCount = useMemo(
    () =>
      projects.filter((p) => p.inventory.status === 'verified_live' && p.inventory.availableUnits)
        .length,
    [projects]
  );

  const handleDeskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeskError(null);
    if (!deskName.trim() || !deskEmail.trim()) {
      setDeskError('Please provide your full name and email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deskEmail.trim())) {
      setDeskError('Please enter a valid email address.');
      return;
    }
    setDeskSubmitting(true);
    try {
      const safeUid =
        firebaseUser?.emailVerified && userProfile?.uid ? userProfile.uid : undefined;
      await submitEnquiry({
        ...(safeUid ? { userId: safeUid } : {}),
        enquiryType: 'callback',
        fullName: deskName.trim(),
        email: deskEmail.trim(),
        phone: deskPhone.trim(),
        message: deskMsg.trim(),
      });
      await notifyPublicEnquiryCreated('callback', 'Direct Contact Desk');
      setDeskSubmitted(true);
      setDeskName('');
      setDeskEmail('');
      setDeskPhone('');
      setDeskMsg('');
    } catch (err) {
      setDeskError(
        err instanceof Error
          ? err.message
          : 'Unable to submit enquiry right now. Please contact our desk on WhatsApp or phone.'
      );
    } finally {
      setDeskSubmitting(false);
    }
  };

  return (
    <div id="top" className="min-h-screen bg-[#080808] text-[#F5F1E8] flex flex-col">
      {/* First-Visit Cinematic Ultra-Luxury Dubai Intro */}
      <CinematicIntro open={showIntro} onComplete={() => setShowIntro(false)} />

      {/* Tier 2 Google Maps Demo Key Quota Warning Banner */}
      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 bg-[#1B1B1B] border-b border-[#D4AF72]/50 text-[#D4AF72] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Google Maps Demo Key Quota Exceeded:</strong> The preview key has hit its
              daily limit. Map pins remain accessible in coordinate mode or you can attach a billed
              Cloud project API key.{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-[#F5F1E8]"
              >
                Quota Help &amp; Billing Setup
              </a>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMapsQuotaExceeded(false)}
            className="font-semibold underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Official Contact Bar */}
      <div className="bg-[#121212] text-[#A5A19A] text-[10px] sm:text-[11px] border-b border-[#D4AF72]/15">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="hidden md:flex items-center gap-3 min-w-0 flex-1">
            <span className="text-[#D4AF72] font-semibold tracking-wider uppercase text-[10px] whitespace-nowrap shrink-0">
              WHITE COLLAR REALTY · Official Advisory
            </span>
            <span className="text-[#D4AF72]/30 shrink-0 hidden lg:inline">|</span>
            <span className="hidden lg:flex items-center gap-1.5 text-[#A5A19A] min-w-0">
              <MapPin className="w-3 h-3 text-[#D4AF72] shrink-0" />
              <span className="truncate">{companyInfo.shortAddress}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between md:justify-end gap-x-3 gap-y-1 w-full md:w-auto shrink-0 font-medium">
            <a
              href={companyInfo.phoneHref}
              className="hover:text-[#D4AF72] flex items-center gap-1 sm:gap-1.5 transition-colors text-[#F5F1E8] whitespace-nowrap"
            >
              <Phone className="w-3 h-3 text-[#D4AF72] shrink-0" />
              <span className="font-mono-tabular">{companyInfo.phone}</span>
            </a>
            <a
              href={companyInfo.whatsappDeskUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#6EE7B7] flex items-center gap-1 sm:gap-1.5 transition-colors text-[#F5F1E8] whitespace-nowrap"
            >
              <MessageCircle className="w-3 h-3 text-[#6EE7B7] shrink-0" />
              <span>WhatsApp Desk</span>
            </a>
            <a
              href={companyInfo.emailHref}
              className="hidden xl:flex hover:text-[#D4AF72] items-center gap-1.5 transition-colors text-[#F5F1E8] whitespace-nowrap"
            >
              <Mail className="w-3 h-3 text-[#D4AF72] shrink-0" />
              <span>{companyInfo.email}</span>
            </a>
            <a
              href={getGoogleMapsDirectionsUrl(
                companyInfo.officeCoordinates,
                companyInfo.mapsDirectionsUrl || companyInfo.googleMapsSearchUrl
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF72] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <span>Directions</span>
              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* Top Navigation Bar (Strict 3-Zone Contract: Brand | <=5 Nav Links | 1 Primary CTA + Mobile/Tablet Drawer Toggle) */}
      <header className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-md border-b border-[#D4AF72]/20 pt-safe">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-2.5 sm:px-6 lg:px-8 min-h-14 sm:min-h-16 py-2 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 lg:flex-initial">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border border-[#D4AF72]/25 bg-[#121212] text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] transition-colors shrink-0"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                closeProjectPage();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0 max-w-full"
            >
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF72] shrink-0" />
              <span
                style={{ fontSize: 'clamp(0.82rem, 3.7vw, 1.45rem)' }}
                className="brand-wordmark font-display font-semibold tracking-[0.03em] sm:tracking-[0.05em] leading-none text-[#F5F1E8]"
              >
                {t.brand}
              </span>
            </a>
          </div>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-5 xl:gap-8">
            <a
              href="#projects"
              onClick={closeProjectPage}
              className="text-xs font-medium text-[#A5A19A] hover:text-[#D4AF72] transition-colors whitespace-nowrap shrink-0"
            >
              {t.navProjects}
            </a>
            <a
              href="#uae-map"
              onClick={closeProjectPage}
              className="text-xs font-medium text-[#A5A19A] hover:text-[#D4AF72] transition-colors whitespace-nowrap shrink-0"
            >
              {t.navMap}
            </a>
            <a
              href="#developers"
              onClick={closeProjectPage}
              className="text-xs font-medium text-[#A5A19A] hover:text-[#D4AF72] transition-colors whitespace-nowrap shrink-0"
            >
              {t.navDevelopers}
            </a>
            <a
              href="#calculator"
              onClick={closeProjectPage}
              className="text-xs font-medium text-[#A5A19A] hover:text-[#D4AF72] transition-colors whitespace-nowrap shrink-0"
            >
              {t.navCalculator}
            </a>
            <a
              href="#insights"
              onClick={closeProjectPage}
              className="text-xs font-medium text-[#A5A19A] hover:text-[#D4AF72] transition-colors whitespace-nowrap shrink-0"
            >
              {t.navInsights}
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setEnquiryModalState({ open: true, type: 'callback', project: null })}
              className="h-9 sm:h-10 px-2.5 sm:px-4 bg-[#D4AF72] text-[#080808] text-[11px] sm:text-xs font-semibold hover:bg-[#E6C77A] transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">Enquire</span>
              <span className="hidden sm:inline">{t.primaryCta}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Slide-Over Navigation Drawer (< 1024px) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-[#080808]/80 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-80 max-w-[90vw] h-[100dvh] bg-[#121212] border-r border-[#D4AF72]/25 flex flex-col justify-between overflow-y-auto pt-safe pb-safe">
            <div>
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#D4AF72]/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4AF72] shrink-0" />
                  <span className="brand-wordmark font-display text-[17px] sm:text-lg font-medium tracking-[0.03em] text-[#F5F1E8]">
                    {t.brand}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-10 h-10 flex items-center justify-center border border-[#D4AF72]/25 text-[#A5A19A] hover:text-[#F5F1E8] hover:border-[#D4AF72] shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav aria-label="Mobile navigation" className="p-4 space-y-1">
                {[
                  { href: '#projects', label: t.navProjects },
                  { href: '#uae-map', label: t.navMap },
                  { href: '#developers', label: t.navDevelopers },
                  { href: '#calculator', label: t.navCalculator },
                  { href: '#insights', label: t.navInsights },
                  { href: '#contact', label: t.contactHeading },
                ].map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      closeProjectPage();
                      setMobileNavOpen(false);
                    }}
                    className="flex items-center justify-between px-3.5 py-3 text-sm font-medium text-[#F5F1E8] hover:bg-[#1B1B1B] hover:text-[#D4AF72] border border-transparent hover:border-[#D4AF72]/20 transition-colors"
                  >
                    <span>{item.label}</span>
                    <ArrowUpRight className="w-4 h-4 text-[#D4AF72]" />
                  </a>
                ))}
              </nav>

              <div className="px-4 py-3 border-t border-[#D4AF72]/15 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF72] px-1">
                  Platform Tools
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setShowCompareModal(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] flex items-center justify-between hover:border-[#D4AF72]"
                >
                  <span className="flex items-center gap-2">
                    <GitCompare className="w-4 h-4 text-[#D4AF72]" />
                    <span>Compare Properties</span>
                  </span>
                  <span className="font-mono-tabular text-[#D4AF72]">{compareIds.length}/4</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    setShowPortalModal(true);
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] flex items-center justify-between hover:border-[#D4AF72]"
                >
                  <span className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[#D4AF72]" />
                    <span>{userProfile ? `${t.navPortal} (${favorites.length})` : t.signInGoogle}</span>
                  </span>
                </button>
                {userProfile && isStaffRole(userProfile.role, userProfile.email) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileNavOpen(false);
                      setShowAdminModal(true);
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>{t.navAdmin}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    handleReplayIntro();
                  }}
                  className="w-full px-3.5 py-2.5 bg-[#080808] border border-[#D4AF72]/25 text-xs font-medium text-[#D4AF72] flex items-center gap-2"
                >
                  <Film className="w-4 h-4" />
                  <span>Replay Skyline Intro</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-[#D4AF72]/20 bg-[#080808]/60 space-y-2 text-xs">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
                Advisory Desk
              </p>
              <a
                href={companyInfo.phoneHref}
                className="flex items-center gap-2 text-[#F5F1E8] hover:text-[#D4AF72] py-1"
              >
                <Phone className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="font-mono-tabular">{companyInfo.phone}</span>
              </a>
              <a
                href={companyInfo.whatsappDeskUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[#6EE7B7] py-1"
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>WhatsApp Advisory Desk</span>
              </a>
              <p className="text-[11px] text-[#A5A19A] leading-relaxed break-words">
                {companyInfo.shortAddress}
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Workspace Utility Strip (Language, Multi-Currency, Portal, Compare, Admin) */}
      <div className="bg-[#121212] border-b border-[#D4AF72]/15">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="hidden lg:flex items-center gap-3 min-w-0">
            <span className="text-[#A5A19A] truncate">
              Dubai · Abu Dhabi · Sharjah · Ajman · RAK · Fujairah · UAQ
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 w-full lg:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language Switcher */}
              <button
                type="button"
                onClick={() => setLanguage((prev) => (prev === 'en' ? 'ar' : 'en'))}
                className="h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 hover:border-[#D4AF72] flex items-center gap-1.5 font-medium text-[#F5F1E8] transition-colors whitespace-nowrap"
              >
                <Globe className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="xs:hidden">{language === 'en' ? 'EN' : 'AR'}</span>
                <span className="hidden xs:inline">
                  {language === 'en' ? 'EN | العربية' : 'العربية | EN'}
                </span>
              </button>

              {/* Currency Switcher */}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                aria-label="Select display currency"
                className="h-9 px-2 sm:px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Compare Trigger */}
              <button
                type="button"
                onClick={() => setShowCompareModal(true)}
                className="h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 hover:border-[#D4AF72] flex items-center gap-1.5 font-medium text-[#F5F1E8] transition-colors whitespace-nowrap"
              >
                <GitCompare className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="xs:hidden">({compareIds.length})</span>
                <span className="hidden xs:inline">Compare ({compareIds.length}/4)</span>
              </button>

              {/* Client Portal / Sign In */}
              <button
                type="button"
                onClick={() => setShowPortalModal(true)}
                className="h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 hover:border-[#D4AF72] flex items-center gap-1.5 font-medium text-[#F5F1E8] transition-colors whitespace-nowrap"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                <span className="sm:hidden">{userProfile ? t.navPortal : 'Sign In'}</span>
                <span className="hidden sm:inline">
                  {userProfile ? `${t.navPortal} (${favorites.length})` : t.signInGoogle}
                </span>
              </button>

              {/* Role-Gated Staff / Admin Console */}
              {userProfile && isStaffRole(userProfile.role, userProfile.email) && (
                <button
                  type="button"
                  onClick={() => setShowAdminModal(true)}
                  className="h-9 px-2.5 sm:px-3 bg-[#D4AF72] text-[#080808] border border-[#D4AF72] hover:bg-[#E6C77A] flex items-center gap-1.5 font-semibold transition-colors whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="xs:hidden">Admin</span>
                  <span className="hidden xs:inline">{t.navAdmin}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main View: Either Full Project Details Page or Complete UAE Platform Homepage */}
      <main className="flex-1">
        {activeDetailProject ? (
          <ProjectDetailsPage
            project={activeDetailProject}
            developer={developers.find((d) => d.id === activeDetailProject.developerId)}
            otherDeveloperProjects={projects.filter(
              (p) =>
                p.developerId === activeDetailProject.developerId &&
                p.id !== activeDetailProject.id
            )}
            comparableProjects={projects.filter(
              (p) =>
                p.id !== activeDetailProject.id &&
                (p.emirate === activeDetailProject.emirate ||
                  p.category === activeDetailProject.category)
            )}
            inventoryLogs={inventoryLogs}
            mapsApiKey={mapsApiKey}
            mapsLoading={mapsConfigLoading}
            currency={currency}
            language={language}
            isSaved={favorites.some((f) => f.projectId === activeDetailProject.id)}
            isCompared={compareIds.includes(activeDetailProject.id)}
            onBack={closeProjectPage}
            onSelectProject={openProjectPage}
            onToggleSave={(p) => handleToggleFavorite(p)}
            onToggleCompare={(p) => handleToggleCompare(p)}
            onOpenVirtualTour={(p) => setVirtualTourProject(p)}
            onOpenEnquiry={(type, p, context) =>
              setEnquiryModalState({
                open: true,
                type,
                project: p,
                requestContext: context ?? null,
              })
            }
            onRefreshInventory={handleRefreshProjectInventory}
            onRetryMapsConfig={loadClientMapsConfig}
          />
        ) : (
          <>
            {/* 1. ULTRA-LUXURY ARCHITECTURAL HERO SECTION */}
            <section className="relative bg-[#080808] text-[#F5F1E8]">
              <div className="relative min-h-[480px] sm:min-h-[560px] lg:min-h-[640px] flex items-center overflow-hidden">
                {!heroImgFailed && IMG_HERO_DUBAI && (
                  <img
                    src={IMG_HERO_DUBAI}
                    alt="Dubai and UAE architectural waterfront skyline at twilight"
                    onError={() => setHeroImgFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover animate-hero-ken-burns"
                  />
                )}
                {/* Obsidian Gradient Scrims */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/80 to-[#080808]/40" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-[#080808]/45" />

                {/* Subtle Animated Architectural Skyline Silhouette Accent */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 800 320"
                  preserveAspectRatio="xMaxYMax slice"
                  className="pointer-events-none hidden lg:block absolute right-0 bottom-0 w-[62%] h-[78%] animate-skyline-glow"
                  style={{
                    transform: `translate3d(0, ${-heroParallaxY}px, 0)`,
                  }}
                >
                  <g fill="none" stroke="#D4AF72" strokeOpacity="0.22" strokeWidth="1">
                    <polygon points="520,320 520,120 562,92 562,320" />
                    <polygon points="580,320 584,18 592,140 602,148 612,320" />
                    <rect x="438" y="156" width="54" height="164" />
                    <rect x="635" y="138" width="58" height="182" />
                    <path d="M710 320 Q725 180 760 110 Q768 205 766 320 Z" />
                  </g>
                </svg>

                <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 w-full">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
                    <div className="lg:col-span-8 min-w-0">
                      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.22em] sm:tracking-[0.26em] text-[#D4AF72] mb-3 sm:mb-4">
                        {t.heroKicker}
                      </p>
                      <h1
                        style={{ fontSize: 'clamp(1.85rem, 4.4vw, 4.4rem)' }}
                        className="font-display font-medium leading-[1.08] tracking-tight text-[#F5F1E8] mb-4 sm:mb-5 break-words"
                      >
                        {t.heroTitle}
                      </h1>
                      <p className="text-sm sm:text-base text-[#A5A19A] leading-relaxed max-w-2xl mb-6 sm:mb-8">
                        {t.heroSubtitle}
                      </p>

                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href="#projects"
                          className="px-5 sm:px-6 py-3 sm:py-3.5 bg-[#D4AF72] text-[#080808] text-xs sm:text-sm font-semibold hover:bg-[#E6C77A] transition-colors duration-200"
                        >
                          {t.exploreProjects}
                        </a>
                        <a
                          href="#uae-map"
                          className="px-5 sm:px-6 py-3 sm:py-3.5 bg-[#121212]/80 border border-[#D4AF72]/40 text-[#F5F1E8] text-xs sm:text-sm font-medium hover:border-[#D4AF72] hover:text-[#D4AF72] transition-colors duration-200"
                        >
                          {t.openMap}
                        </a>
                      </div>
                    </div>

                    {/* Architectural Portfolio Telemetry Metrics */}
                    <div className="lg:col-span-4 min-w-0 grid grid-cols-1 xs:grid-cols-3 lg:grid-cols-1 gap-4 border-t lg:border-t-0 lg:border-l border-[#D4AF72]/25 pt-5 lg:pt-0 lg:pl-8">
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#A5A19A]">
                          Verified Developments
                        </p>
                        <p className="font-display text-2xl sm:text-3xl font-medium text-[#D4AF72] mt-0.5 tabular-nums">
                          <AnimatedNumber value={projects.length} />
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#A5A19A]">
                          Master Developers
                        </p>
                        <p className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8] mt-0.5 tabular-nums">
                          <AnimatedNumber value={developers.length} />
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#A5A19A]">
                          Live Inventory Feeds
                        </p>
                        <p className="font-display text-2xl sm:text-3xl font-medium text-[#6EE7B7] mt-0.5 tabular-nums">
                          <AnimatedNumber value={liveInventoryCount} />
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. ADVANCED PROPERTY SEARCH ENGINE */}
              <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 relative -mt-6 sm:-mt-10 lg:-mt-12 z-20 pb-8 sm:pb-10">
                <SearchEngineBar
                  filters={filters}
                  developers={developers}
                  communities={communities}
                  language={language}
                  resultCount={filteredProjects.length}
                  onChange={setFilters}
                  onReset={() => {
                    setFilters(DEFAULT_FILTERS);
                    setSegment('all');
                  }}
                  onSaveSearch={handleSaveCurrentSearch}
                />
              </div>
            </section>

            {/* RECENTLY VIEWED RESIDENCES (when user has visited projects) */}
            {recentlyViewedProjects.length > 0 && (
              <section className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 pb-8 border-b border-[#D4AF72]/15">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#D4AF72]" />
                    <h2 className="font-display text-xl sm:text-2xl font-medium text-[#F5F1E8]">
                      {t.recentlyViewedHeading}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentlyViewedIds([]);
                      try {
                        window.localStorage.removeItem(RECENTLY_VIEWED_KEY);
                      } catch {
                        // ignore
                      }
                    }}
                    className="text-xs text-[#A5A19A] hover:text-[#D4AF72] transition-colors"
                  >
                    Clear History
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentlyViewedProjects.slice(0, 4).map((proj) => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => openProjectPage(proj)}
                      className="text-left bg-[#121212] border border-[#D4AF72]/20 hover:border-[#D4AF72] p-3 flex items-center gap-3 transition-colors group"
                    >
                      {proj.heroImage && !failedImageUrls[proj.heroImage] ? (
                        <img
                          src={proj.heroImage}
                          alt={proj.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImageUrls((prev) => ({ ...prev, [proj.heroImage]: true }))
                          }
                          className="w-16 h-14 object-cover bg-[#1B1B1B] shrink-0 border border-[#D4AF72]/15"
                        />
                      ) : (
                        <div className="w-16 h-14 bg-[#1B1B1B] border border-[#D4AF72]/15 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5 text-[#D4AF72]" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-[#D4AF72] truncate">
                          {proj.community}
                        </p>
                        <p className="font-display text-base font-medium text-[#F5F1E8] group-hover:text-[#D4AF72] truncate">
                          {proj.name}
                        </p>
                        <p className="text-[11px] text-[#A5A19A] truncate">
                          {formatPropertyBhk(proj)} | {formatPropertyAreaSqFt(proj)}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-[#D4AF72]">
                          {formatProjectPrice(proj.startingPriceAed, currency, true)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 3. VERIFIED UAE PROJECTS CATALOG, CURATED SEGMENTS & PAGINATION */}
            <section id="projects" className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-10 sm:py-14">
              {/* Emirate Directory Tabs */}
              <div className="mb-6 pb-4 border-b border-[#D4AF72]/15 flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-2">
                {PRIMARY_EMIRATE_PAGES.map(({ emirate, label }) => {
                  const active = filters.emirate === emirate;
                  const count = emirateCounts[emirate] ?? 0;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => openEmiratePage(emirate)}
                      className={`px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap flex items-center gap-2 ${
                        active
                          ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                          : 'bg-[#121212] text-[#F5F1E8] border-[#D4AF72]/20 hover:border-[#D4AF72]'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`font-mono-tabular text-[11px] ${
                          active ? 'text-[#080808]/80' : 'text-[#A5A19A]'
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                    Audited Multi-Emirate Inventory · {filteredProjects.length} Projects Matching
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl font-medium text-[#F5F1E8] mt-1">
                    {filters.emirate
                      ? `${filters.emirate} Real Estate Projects (${filteredProjects.length})`
                      : segment === 'featured'
                      ? t.featuredHeading
                      : segment === 'exclusive_luxury'
                      ? t.exclusiveLuxuryHeading
                      : segment === 'newly_launched'
                      ? t.newlyLaunchedHeading
                      : segment === 'trending_investment'
                      ? t.trendingInvestmentHeading
                      : segment === 'ready'
                      ? t.readyToMoveHeading
                      : segment === 'off_plan'
                      ? t.offPlanHeading
                      : segment === 'live_inventory'
                      ? t.verifiedInventoryHeading
                      : segment === 'recently_added'
                      ? t.recentlyAddedHeading
                      : `All UAE Real Estate Projects (${filteredProjects.length})`}
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => exportCatalogToExcel(filteredProjects, developers)}
                    className="h-9 px-3.5 border border-[#D4AF72]/25 bg-[#121212] text-xs font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] transition-colors flex items-center gap-2 shrink-0"
                    title="Export filtered property intelligence & developer directory to Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#6EE7B7]" />
                    <span>Export to Excel ({filteredProjects.length})</span>
                  </button>
                </div>
              </div>

              {/* Clean Collection Segment Selector */}
              <div className="mb-7 flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 border border-[#D4AF72]/20 bg-[#121212] p-1.5">
                {(
                  [
                    ['all', 'All Projects'],
                    ['featured', 'Featured'],
                    ['exclusive_luxury', 'Exclusive Luxury'],
                    ['newly_launched', 'Newly Launched'],
                    ['trending_investment', 'Trending Investments'],
                    ['off_plan', 'Off-Plan'],
                    ['ready', 'Ready-to-Move'],
                    ['live_inventory', 'Live Inventory'],
                    ['recently_added', 'Recently Added'],
                  ] as Array<[CatalogSegment, string]>
                ).map(([segKey, segLabel]) => (
                  <button
                    key={segKey}
                    type="button"
                    onClick={() => setSegment(segKey)}
                    className={`px-3 py-2 sm:py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      segment === segKey
                        ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                        : 'text-[#A5A19A] hover:text-[#F5F1E8]'
                    }`}
                  >
                    {segLabel}
                  </button>
                ))}
              </div>

              {filteredProjects.length === 0 ? (
                <div className="bg-[#121212] border border-[#D4AF72]/25 p-8 sm:p-12 text-center">
                  <h3 className="font-display text-2xl font-medium text-[#F5F1E8]">
                    No UAE projects match your exact filter criteria
                  </h3>
                  <p className="text-sm text-[#A5A19A] mt-2 mb-5">
                    Adjust your budget ceiling, Emirate selection, unit size, or minimum rental
                    yield, or register an availability alert for upcoming releases.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSegment('all');
                    }}
                    className="px-5 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                  >
                    Reset All Search Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-6">
                    {visibleCatalogProjects.map((project, idx) => (
                      <ScrollReveal key={project.id} delayMs={(idx % 6) * 45}>
                        <ProjectCard
                          project={project}
                          currency={currency}
                          language={language}
                          isSaved={favorites.some((f) => f.projectId === project.id)}
                          isCompared={compareIds.includes(project.id)}
                          onSelect={openProjectPage}
                          onToggleSave={handleToggleFavorite}
                          onToggleCompare={handleToggleCompare}
                          onRequestAvailabilitySheet={openAvailabilitySheet}
                        />
                      </ScrollReveal>
                    ))}
                  </div>

                  {/* Pagination Controls for 182+ Projects */}
                  {filteredProjects.length > PAGE_SIZE && (
                    <div className="mt-8 pt-6 border-t border-[#D4AF72]/20 flex flex-wrap items-center justify-between gap-4 text-xs">
                      <span className="font-mono-tabular text-[#A5A19A]">
                        Showing{' '}
                        {showAllPaged
                          ? `1–${filteredProjects.length}`
                          : `${(catalogPage - 1) * PAGE_SIZE + 1}–${Math.min(
                              catalogPage * PAGE_SIZE,
                              filteredProjects.length
                            )}`}{' '}
                        of {filteredProjects.length} projects
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {!showAllPaged && (
                          <>
                            <button
                              type="button"
                              disabled={catalogPage <= 1}
                              onClick={() => {
                                setCatalogPage((p) => Math.max(1, p - 1));
                                document
                                  .getElementById('projects')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#121212] text-[#F5F1E8] hover:border-[#D4AF72] disabled:opacity-40"
                            >
                              Previous
                            </button>
                            <span className="font-mono-tabular px-2 text-[#F5F1E8]">
                              Page {catalogPage} of {totalCatalogPages}
                            </span>
                            <button
                              type="button"
                              disabled={catalogPage >= totalCatalogPages}
                              onClick={() => {
                                setCatalogPage((p) => Math.min(totalCatalogPages, p + 1));
                                document
                                  .getElementById('projects')
                                  ?.scrollIntoView({ behavior: 'smooth' });
                              }}
                              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#121212] text-[#F5F1E8] hover:border-[#D4AF72] disabled:opacity-40"
                            >
                              Next
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowAllPaged((prev) => !prev)}
                          className="h-9 px-3.5 bg-[#D4AF72] text-[#080808] font-semibold hover:bg-[#E6C77A] transition-colors"
                        >
                          {showAllPaged
                            ? `Paginate (${PAGE_SIZE}/page)`
                            : `Show All (${filteredProjects.length})`}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* 4. EXPLORE BY EMIRATE (ALL 7 UAE EMIRATES) */}
            <section className="bg-[#121212] border-y border-[#D4AF72]/20 py-12 sm:py-14">
              <ScrollReveal className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                  National Coverage
                </p>
                <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] mt-1 mb-6 sm:mb-8">
                  {t.byEmirateHeading}
                </h2>

                <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {EMIRATES_LIST.map((em) => {
                    const emProjects = projects.filter((p) => p.emirate === em);
                    const priced = emProjects.map((p) => p.startingPriceAed).filter((n) => n > 0);
                    const minPrice = priced.length ? Math.min(...priced) : null;
                    const active = filters.emirate === em;
                    return (
                      <button
                        key={em}
                        type="button"
                        onClick={() => openEmiratePage(active ? '' : em)}
                        className={`text-left p-4 border transition-colors flex flex-col justify-between min-h-[124px] ${
                          active
                            ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                            : 'bg-[#1B1B1B] text-[#F5F1E8] border-[#D4AF72]/20 hover:border-[#D4AF72]'
                        }`}
                      >
                        <div>
                          <MapPin
                            className={`w-4 h-4 mb-2 ${
                              active ? 'text-[#080808]' : 'text-[#D4AF72]'
                            }`}
                          />
                          <h3 className="font-display text-lg font-medium leading-tight">{em}</h3>
                        </div>
                        <div className="pt-3 text-[11px] font-mono-tabular">
                          <span className="block">
                            {emProjects.length} {emProjects.length === 1 ? 'Project' : 'Projects'}
                          </span>
                          {minPrice !== null && (
                            <span className={active ? 'text-[#080808]/80' : 'text-[#A5A19A]'}>
                              From {formatProjectPrice(minPrice, currency, true)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollReveal>
            </section>

            {/* 5. EXPLORE BY VERIFIED DEVELOPER */}
            <section id="developers" className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-12 sm:py-14">
              <ScrollReveal>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                      RERA, ADM, SRERD &amp; Municipal Registries
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] mt-1">
                      {t.byDeveloperHeading}
                    </h2>
                  </div>
                  {filters.developerId && (
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, developerId: '' })}
                      className="text-xs font-medium text-[#D4AF72] underline"
                    >
                      Clear Developer Filter
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {developers.map((dev) => {
                    const devProjCount = projects.filter((p) => p.developerId === dev.id).length;
                    const active = filters.developerId === dev.id;
                    return (
                      <div
                        key={dev.id}
                        className={`p-5 border transition-colors flex flex-col justify-between ${
                          active
                            ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                            : 'bg-[#121212] text-[#F5F1E8] border-[#D4AF72]/20 hover:border-[#D4AF72]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setFilters({ ...DEFAULT_FILTERS, developerId: active ? '' : dev.id });
                            setSegment('all');
                            document
                              .getElementById('projects')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="text-left w-full"
                        >
                          <div className="flex items-center justify-between text-[11px] mb-2">
                            <span className={active ? 'text-[#080808]/80 font-semibold' : 'text-[#D4AF72]'}>
                              {dev.emirate}
                            </span>
                            {dev.verified && (
                              <ShieldCheck
                                className={`w-3.5 h-3.5 ${
                                  active ? 'text-[#080808]' : 'text-[#6EE7B7]'
                                }`}
                              />
                            )}
                          </div>
                          <h3 className="font-display text-xl font-medium leading-snug">
                            {language === 'ar' && dev.nameAr ? dev.nameAr : dev.name}
                          </h3>
                          <p
                            className={`text-[11px] font-mono-tabular mt-1 ${
                              active ? 'text-[#080808]/80' : 'text-[#A5A19A]'
                            }`}
                          >
                            {dev.registrationId}
                          </p>
                        </button>
                        <div className="mt-4 pt-3 border-t border-current/15 flex items-center justify-between text-xs font-mono-tabular">
                          <span>{devProjCount} Listed</span>
                          <div className="flex items-center gap-2">
                            {dev.website && (
                              <a
                                href={dev.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Official Developer Website"
                                className={
                                  active
                                    ? 'text-[#080808] hover:underline'
                                    : 'text-[#D4AF72] hover:text-[#E6C77A]'
                                }
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollReveal>
            </section>

            {/* 6. INTERACTIVE UAE PROPERTY MAP */}
            <section id="uae-map" className="bg-[#121212] border-y border-[#D4AF72]/20 py-12 sm:py-14">
              <ScrollReveal className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8">
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                    Geospatial Discovery
                  </p>
                  <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] mt-1">
                    {t.mapSectionHeading}
                  </h2>
                </div>
                <UAEPropertyMap
                  projects={projects}
                  mapsApiKey={mapsApiKey}
                  mapsLoading={mapsConfigLoading}
                  currency={currency}
                  onOpenProject={openProjectPage}
                  onRequestAvailabilitySheet={(proj) => openAvailabilitySheet(proj)}
                  onRetryMapsConfig={loadClientMapsConfig}
                />
              </ScrollReveal>
            </section>

            {/* 7. VIRTUAL TOUR SHOWCASE */}
            <section className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-12 sm:py-14">
              <ScrollReveal>
                <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                      360° &amp; 3D Interactive Walkthroughs
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] mt-1">
                      {t.virtualTourHeading}
                    </h2>
                  </div>
                  <p className="text-xs text-[#A5A19A]">
                    Only verified 360° panoramas, 3D twins &amp; genuine walkthrough videos are
                    displayed.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                  {tourShowcaseProjects.map((proj) => {
                    const effStatus = getEffectiveTourStatus(proj);
                    const hasLiveTour = effStatus !== 'coming_soon';
                    return (
                      <div
                        key={proj.id}
                        className="bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] transition-colors flex flex-col justify-between group"
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-[#121212]">
                          {proj.heroImage && !failedImageUrls[proj.heroImage] ? (
                            <img
                              src={proj.heroImage}
                              alt={proj.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImageUrls((prev) => ({
                                  ...prev,
                                  [proj.heroImage]: true,
                                }))
                              }
                              className="w-full h-full object-cover group-hover:scale-[1.035] transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center px-4 text-center">
                              <Building2 className="w-7 h-7 text-[#D4AF72] mb-1.5" />
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A5A19A]">
                                {MISSING_PROJECT_PHOTO_LABEL}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/90 via-[#080808]/20 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3 text-[#F5F1E8]">
                            <p className="text-[11px] text-[#D4AF72] uppercase font-semibold">
                              {TOUR_STATUS_LABELS[effStatus]}
                              {hasLiveTour && proj.virtualTour.rooms?.length
                                ? ` · ${proj.virtualTour.rooms.length} Scenes`
                                : ''}
                            </p>
                            <h3 className="font-display text-xl font-medium leading-tight mt-0.5">
                              {proj.name}
                            </h3>
                          </div>
                        </div>
                        <div className="p-4 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#A5A19A]">
                            <span>
                              {proj.community}, {proj.emirate}
                            </span>
                          </div>
                          {hasLiveTour ? (
                            <button
                              type="button"
                              onClick={() => setVirtualTourProject(proj)}
                              className="w-full py-2 px-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Compass className="w-3.5 h-3.5" />
                              <span>EXPLORE VIRTUAL EXPERIENCE</span>
                            </button>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setVirtualTourProject(proj)}
                                className="w-full py-2 px-3 border border-[#D4AF72]/25 text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] flex items-center justify-center gap-1.5"
                              >
                                <Compass className="w-3.5 h-3.5 text-[#D4AF72]" />
                                <span>INSPECT TOUR STATUS</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEnquiryModalState({
                                    open: true,
                                    type: 'virtual_consultation',
                                    project: proj,
                                  })
                                }
                                className="w-full py-1.5 px-3 bg-[#121212] border border-[#D4AF72]/20 text-[#F5F1E8] text-[11px] font-medium hover:border-[#D4AF72]"
                              >
                                Request Private Tour
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollReveal>
            </section>

            {/* 8. INSTITUTIONAL INVESTMENT CALCULATOR */}
            <section id="calculator" className="bg-[#080808] border-y border-[#D4AF72]/20 py-12 sm:py-14">
              <ScrollReveal className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8">
                <InvestmentCalculator currency={currency} />
              </ScrollReveal>
            </section>

            {/* 9. UAE MARKET INSIGHTS & LIVE INVENTORY FEED */}
            <section id="insights" className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-12 sm:py-14">
              <ScrollReveal>
                <div className="mb-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                    DLD, ADM, SRERD &amp; Municipal Intelligence
                  </p>
                  <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] mt-1">
                    {t.insightsHeading}
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                  <div className="lg:col-span-7 min-w-0 bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6">
                    <h3 className="font-display text-xl sm:text-2xl font-medium text-[#F5F1E8] mb-1">
                      Average Price per sq ft (AED) Across All 7 Emirates
                    </h3>
                    <p className="text-xs text-[#A5A19A] mb-5">
                      Derived from verified registered developments in White Collar Realty’s live
                      database.
                    </p>
                    <div className="h-64 sm:h-72 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={emirateInsightsData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 114, 0.14)" />
                          <XAxis dataKey="emirate" tick={{ fontSize: 11, fill: '#A5A19A' }} />
                          <YAxis width={45} tick={{ fontSize: 11, fill: '#A5A19A' }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#121212',
                              borderColor: 'rgba(212, 175, 114, 0.45)',
                              color: '#F5F1E8',
                              fontSize: '12px',
                            }}
                            formatter={(value: unknown) => [
                              `AED ${Number(value).toLocaleString()} / sq ft`,
                              'Avg Price/sq ft',
                            ]}
                          />
                          <Bar dataKey="avgPsf" fill="#D4AF72" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Audited Inventory Feed */}
                  <div className="lg:col-span-5 min-w-0 bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-xl sm:text-2xl font-medium text-[#F5F1E8] mb-1">
                        Live Inventory Synchronization Ledger
                      </h3>
                      <p className="text-xs text-[#A5A19A] mb-4">
                        Timestamped unit-level audit updates from developer APIs, webhooks, and CRM
                        feeds.
                      </p>
                      <div className="space-y-3">
                        {inventoryLogs.slice(0, 5).map((log) => (
                          <div
                            key={log.id}
                            className="border-b border-[#D4AF72]/15 pb-3 text-xs space-y-1"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-[#F5F1E8] break-words">
                                {log.projectName}
                              </span>
                              <span className="font-mono-tabular text-[#6EE7B7] font-semibold shrink-0">
                                {log.previousAvailable ?? 'N/A'} → {log.newAvailable ?? 'N/A'}{' '}
                                avail
                              </span>
                            </div>
                            <p className="text-[#A5A19A] break-words">
                              {log.syncType} · {log.source}
                            </p>
                            <p className="font-mono-tabular text-[11px] text-[#A5A19A]/80">
                              {new Date(log.timestamp).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </section>

            {/* 10. ABOUT WHITE COLLAR REALTY & DIRECT CONTACT / WHATSAPP DESK */}
            <section id="contact" className="bg-[#121212] border-t border-[#D4AF72]/20 py-12 sm:py-16">
              <ScrollReveal className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                  <div className="lg:col-span-6 min-w-0 space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF72]">
                      {t.aboutHeading}
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] leading-tight">
                      Private Real Estate Intelligence Across Every UAE Emirate
                    </h2>
                    <p className="text-sm text-[#A5A19A] leading-relaxed">
                      WHITE COLLAR REALTY bridges private wealth, global investors, and UAE master
                      developers with transparent unit-level inventory verification, DLD/ADM/SRERD
                      registration tracking, Golden Visa advisory, and real-time yield analytics.
                    </p>
                    <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 pt-4 border-t border-[#D4AF72]/20 font-mono-tabular">
                      <div>
                        <span className="block text-2xl font-semibold text-[#D4AF72]">7</span>
                        <span className="text-xs text-[#A5A19A] font-sans">
                          UAE Emirates Covered
                        </span>
                      </div>
                      <div>
                        <span className="block text-2xl font-semibold text-[#D4AF72]">
                          {developers.length}+
                        </span>
                        <span className="text-xs text-[#A5A19A] font-sans">
                          Verified Developers
                        </span>
                      </div>
                      <div>
                        <span className="block text-2xl font-semibold text-[#D4AF72]">
                          AED / 6
                        </span>
                        <span className="text-xs text-[#A5A19A] font-sans">Live Currencies</span>
                      </div>
                    </div>

                    {/* Official Office Card */}
                    <div className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-4 text-xs space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF72]">
                        Official Corporate Office
                      </p>
                      <p className="text-[#F5F1E8] font-medium leading-relaxed">
                        {companyInfo.formattedAddress}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        <a
                          href={companyInfo.phoneHref}
                          className="text-[#F5F1E8] hover:text-[#D4AF72] flex items-center gap-1 font-semibold"
                        >
                          <Phone className="w-3 h-3 text-[#D4AF72]" />
                          <span>{companyInfo.phone}</span>
                        </a>
                        <span className="text-[#D4AF72]/30">·</span>
                        <a
                          href={companyInfo.emailHref}
                          className="text-[#F5F1E8] hover:text-[#D4AF72] flex items-center gap-1 font-semibold"
                        >
                          <Mail className="w-3 h-3 text-[#D4AF72]" />
                          <span>{companyInfo.email}</span>
                        </a>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap gap-2.5 sm:gap-3">
                      <a
                        href={companyInfo.whatsappDeskUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 sm:px-5 py-2.5 bg-[#065F46] text-[#ECFDF5] text-xs font-semibold flex items-center gap-2 hover:bg-[#047857] transition-colors max-w-full"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        <span>WhatsApp Advisory ({companyInfo.phone})</span>
                      </a>
                      <a
                        href={companyInfo.phoneHref}
                        className="px-4 sm:px-5 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center gap-2 transition-colors max-w-full"
                      >
                        <Phone className="w-4 h-4 shrink-0" />
                        <span>Call {companyInfo.phone}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setEnquiryModalState({ open: true, type: 'visit', project: null })
                        }
                        className="px-4 py-2.5 bg-[#1B1B1B] border border-[#D4AF72]/30 text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] flex items-center gap-2 transition-colors max-w-full"
                      >
                        <span>Schedule Private Viewing</span>
                      </button>
                    </div>
                  </div>

                  {/* Embedded Direct Contact / Callback Desk */}
                  <div className="lg:col-span-6 bg-[#1B1B1B] border border-[#D4AF72]/25 text-[#F5F1E8] p-6 sm:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                      {t.contactHeading}
                    </p>
                    <h3 className="font-display text-2xl font-medium mt-1 mb-4 text-[#F5F1E8]">
                      Request Verified Developer Availability or Private Consultation
                    </h3>

                    {deskSubmitted ? (
                      <div className="border border-[#34D399]/35 bg-[#064E3B]/35 p-5 text-sm text-[#6EE7B7] font-medium">
                        Your consultation request has been registered in our advisory CRM. A
                        specialist will contact you via {companyInfo.phone} shortly.
                      </div>
                    ) : (
                      <form onSubmit={handleDeskSubmit} className="space-y-3 text-xs">
                        {deskError && (
                          <div className="p-2.5 bg-[#7F1D1D]/40 border border-[#F87171]/40 text-[#FCA5A5] text-[11px]">
                            {deskError}
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            required
                            placeholder="Full Name *"
                            value={deskName}
                            onChange={(e) => setDeskName(e.target.value)}
                            className="h-10 px-3 bg-[#121212] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                          />
                          <input
                            type="email"
                            required
                            placeholder="Email Address *"
                            value={deskEmail}
                            onChange={(e) => setDeskEmail(e.target.value)}
                            className="h-10 px-3 bg-[#121212] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                          />
                        </div>
                        <input
                          type="tel"
                          placeholder="Phone / WhatsApp (+91 / +971...)"
                          value={deskPhone}
                          onChange={(e) => setDeskPhone(e.target.value)}
                          className="w-full h-10 px-3 bg-[#121212] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                        />
                        <textarea
                          rows={3}
                          placeholder="Emirate preference, target budget in AED, or specific development..."
                          value={deskMsg}
                          onChange={(e) => setDeskMsg(e.target.value)}
                          className="w-full p-3 bg-[#121212] border border-[#D4AF72]/25 text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
                        />
                        <button
                          type="submit"
                          disabled={deskSubmitting}
                          className="w-full py-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          {deskSubmitting ? 'Submitting Request...' : 'Request Advisory Callback'}
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Interactive Google Map of White Collar Realty Office */}
                <div className="pt-8 border-t border-[#D4AF72]/15">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                        Interactive Location &amp; Navigation
                      </p>
                      <h3 className="font-display text-2xl font-medium text-[#F5F1E8] mt-0.5">
                        Visit WHITE COLLAR REALTY Office
                      </h3>
                    </div>
                    <a
                      href={getGoogleMapsDirectionsUrl(
                        companyInfo.officeCoordinates,
                        companyInfo.mapsDirectionsUrl || companyInfo.googleMapsSearchUrl
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 sm:px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center justify-center gap-1.5 transition-colors text-center max-w-full"
                    >
                      <span className="leading-snug">GET DIRECTIONS TO WHITE COLLAR REALTY</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                  <OfficeLocationMap
                    apiKey={mapsApiKey}
                    mapsLoading={mapsConfigLoading}
                    onRetryMapsConfig={loadClientMapsConfig}
                  />
                </div>
              </ScrollReveal>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#080808] text-[#A5A19A] border-t border-[#D4AF72]/20 py-12 text-xs">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Col 1: Brand & Charter */}
            <div className="space-y-3 min-w-0">
              <p className="brand-wordmark font-display text-lg sm:text-xl font-medium text-[#F5F1E8] tracking-[0.04em]">
                WHITE COLLAR REALTY
              </p>
              <p className="text-[#A5A19A] leading-relaxed text-xs">
                UAE Real Estate Intelligence, Off-plan &amp; Ready Inventory Discovery, Golden Visa
                Advisory, and Developer Governance Platform.
              </p>
              <p className="text-[11px] text-[#D4AF72] font-semibold">
                Authenticity First · Zero Fabricated 360° Tours · Official Feeds
              </p>
            </div>

            {/* Col 2: Official Corporate Address */}
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F5F1E8]">
                Official Office Address
              </p>
              <p className="text-[#A5A19A] leading-relaxed break-words">{companyInfo.formattedAddress}</p>
              <p className="text-[11px] text-[#A5A19A]/70 font-mono-tabular">
                GPS: {companyInfo.officeCoordinates.lat}° N, {companyInfo.officeCoordinates.lng}° E
              </p>
              <a
                href={getGoogleMapsDirectionsUrl(
                  companyInfo.officeCoordinates,
                  companyInfo.mapsDirectionsUrl || companyInfo.googleMapsSearchUrl
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#D4AF72] font-semibold hover:underline pt-1 max-w-full"
              >
                <span className="leading-snug">GET DIRECTIONS TO WHITE COLLAR REALTY</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            {/* Col 3: Direct Contact Channels */}
            <div className="space-y-2 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F5F1E8]">
                Direct Contact &amp; Helplines
              </p>
              <p>
                <span className="text-[#A5A19A]/70 block text-[11px]">
                  Primary Phone &amp; WhatsApp:
                </span>
                <a
                  href={companyInfo.phoneHref}
                  className="text-[#F5F1E8] font-semibold hover:text-[#D4AF72]"
                >
                  {companyInfo.phone}
                </a>
              </p>
              <p className="min-w-0">
                <span className="text-[#A5A19A]/70 block text-[11px]">Official Email:</span>
                <a
                  href={companyInfo.emailHref}
                  className="text-[#F5F1E8] font-semibold hover:text-[#D4AF72] break-all"
                >
                  {companyInfo.email}
                </a>
              </p>
              <p className="min-w-0">
                <span className="text-[#A5A19A]/70 block text-[11px]">Official Website:</span>
                <a
                  href={companyInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#D4AF72] font-semibold hover:underline break-all"
                >
                  {companyInfo.website}
                </a>
              </p>
              <div className="pt-1">
                <a
                  href={companyInfo.whatsappDeskUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#065F46] text-[#ECFDF5] text-[11px] font-semibold hover:bg-[#047857]"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Col 4: Quick Portals & Discovery */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#F5F1E8]">
                Platform Discovery
              </p>
              <ul className="space-y-1.5 text-[#A5A19A]">
                <li>
                  <a href="#projects" onClick={closeProjectPage} className="hover:text-[#D4AF72] transition-colors">
                    All {projects.length} UAE Projects
                  </a>
                </li>
                <li>
                  <a href="#uae-map" onClick={closeProjectPage} className="hover:text-[#D4AF72] transition-colors">
                    Interactive UAE Property Map
                  </a>
                </li>
                <li>
                  <a href="#developers" onClick={closeProjectPage} className="hover:text-[#D4AF72] transition-colors">
                    {developers.length} Verified UAE Master Developers
                  </a>
                </li>
                <li>
                  <a href="#calculator" onClick={closeProjectPage} className="hover:text-[#D4AF72] transition-colors">
                    Mortgage &amp; ROI Yield Calculator
                  </a>
                </li>
                <li>
                  <a href="#insights" onClick={closeProjectPage} className="hover:text-[#D4AF72] transition-colors">
                    Emirate Price &amp; Yield Analytics
                  </a>
                </li>
              </ul>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReplayIntro}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] border border-[#D4AF72]/30 text-[#D4AF72] hover:border-[#D4AF72] text-[11px] font-medium transition-colors"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Replay Skyline Intro</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#D4AF72]/15 flex flex-wrap items-center justify-between gap-4 text-[#A5A19A]/70 text-[11px]">
            <p>
              © {new Date().getFullYear()} WHITE COLLAR REALTY. All rights reserved. Registered real
              estate intelligence &amp; advisory.
            </p>
            <p>
              Gurugram · Dubai · Abu Dhabi · Sharjah · Ras Al Khaimah · Ajman · Fujairah · Umm Al
              Quwain
            </p>
          </div>
        </div>
      </footer>

      {/* Compact Floating Compare Tray */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/50 px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xl flex items-center justify-between sm:justify-start gap-2.5 sm:gap-4 w-[calc(100vw-1.5rem)] sm:w-auto max-w-md">
          <span className="text-xs font-medium whitespace-nowrap">
            Comparing <strong className="text-[#D4AF72]">{compareIds.length}</strong>/4
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowCompareModal(true)}
              className="h-9 px-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] whitespace-nowrap"
            >
              Compare Now
            </button>
            <button
              type="button"
              onClick={() => setCompareIds([])}
              aria-label="Clear comparison selection"
              className="w-8 h-8 flex items-center justify-center text-[#A5A19A] hover:text-[#F5F1E8]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Non-Intrusive Real-Time Toast Notification */}
      {toast && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 sm:left-auto sm:right-4 z-50 bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/40 px-4 py-3 text-xs shadow-2xl sm:max-w-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
            <span className="break-words">{toast}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="text-[#A5A19A] hover:text-[#F5F1E8] shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modals */}
      {virtualTourProject && (
        <VirtualTourModal
          project={virtualTourProject}
          onClose={() => setVirtualTourProject(null)}
          onRequestPrivateTour={(proj) => {
            setVirtualTourProject(null);
            setEnquiryModalState({ open: true, type: 'virtual_consultation', project: proj });
          }}
        />
      )}

      {showCompareModal && (
        <CompareProjectsModal
          projects={comparedProjects}
          currency={currency}
          onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
          onOpenProject={(proj) => {
            setShowCompareModal(false);
            openProjectPage(proj);
          }}
          onRequestAvailabilitySheet={(proj) => {
            setShowCompareModal(false);
            openAvailabilitySheet(proj);
          }}
          onClose={() => setShowCompareModal(false)}
        />
      )}

      {enquiryModalState.open && (
        <EnquiryModal
          initialType={enquiryModalState.type}
          requestContext={enquiryModalState.requestContext}
          project={enquiryModalState.project}
          currentUser={
            firebaseUser
              ? {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                }
              : null
          }
          onClose={() =>
            setEnquiryModalState({
              open: false,
              type: 'callback',
              project: null,
              requestContext: null,
            })
          }
        />
      )}

      {showPortalModal && (
        <CustomerPortalModal
          userProfile={userProfile}
          projects={projects}
          recentlyViewedProjects={recentlyViewedProjects}
          favorites={favorites}
          savedSearches={savedSearches}
          enquiries={userEnquiries}
          currency={currency}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onSelectProject={openProjectPage}
          onRemoveFavorite={async (pid, pname) => {
            if (!userProfile) return;
            await toggleUserFavorite(userProfile.uid, pid, pname, true);
          }}
          onDeleteSavedSearch={async (sid) => {
            if (!userProfile) return;
            await deleteSavedSearch(userProfile.uid, sid);
          }}
          onApplySavedSearch={(srch) => {
            setFilters({
              ...DEFAULT_FILTERS,
              emirate: srch.emirate || '',
              propertyType: srch.propertyType || '',
              category: srch.category || '',
              maxBudgetAed: srch.maxBudgetAed ?? '',
            });
            closeProjectPage();
            document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
          }}
          onReplayIntro={handleReplayIntro}
          onClose={() => setShowPortalModal(false)}
        />
      )}

      {showAdminModal && userProfile && isStaffRole(userProfile.role, userProfile.email) && (
        <AdminDashboard
          userProfile={userProfile}
          projects={projects}
          developers={developers}
          inventoryLogs={inventoryLogs}
          syncProviders={syncProviders}
          enquiries={allEnquiries}
          users={allUsers}
          adminLogs={adminLogs}
          currency={currency}
          mapsApiKey={mapsApiKey}
          onReplayIntro={handleReplayIntro}
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  );
}
