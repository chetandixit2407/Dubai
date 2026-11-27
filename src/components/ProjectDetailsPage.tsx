import React, { useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  CollisionBehavior,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  Compass,
  Crosshair,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GitCompare,
  GraduationCap,
  HeartPulse,
  Landmark,
  Layers,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Train,
  Video,
} from 'lucide-react';
import { exportSingleProjectToExcel } from '../utils/exportUtils.ts';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CurrencyCode,
  Developer,
  EnquiryType,
  InventoryLog,
  Language,
  MediaCategory,
  Project,
  ProjectMediaItem,
} from '../types/realEstate.ts';
import {
  formatCurrency,
  formatInrTimestampNote,
  formatProjectPrice,
} from '../utils/currency.ts';
import {
  getEffectiveTourStatus,
  MEDIA_CATEGORY_LABELS,
  MEDIA_CLASSIFICATION_LABELS,
  TOUR_STATUS_LABELS,
} from '../utils/mediaValidation.ts';
import {
  getGoogleMapsDirectionsUrl,
  isValidCoordinate,
  LatLng,
} from '../utils/coordinates.ts';
import { geocodeAddressOnServer, GeocodeResultItem } from '../services/apiClient.ts';
import { useCompanyInfo } from '../data/companyInfo.ts';
import { GoogleMapsGuard, MapsErrorReason } from './GoogleMapsGuard.tsx';
import { InvestmentCalculator } from './InvestmentCalculator.tsx';
import { LuxurySkeleton } from './ScrollReveal.tsx';
import {
  formatCleanFullAddress,
  formatCleanLocation,
  formatFloorPlanAreaSqFt,
  formatFloorPlanBathrooms,
  formatFloorPlanBhk,
  formatPropertyAreaSqFt,
  formatPropertyBathrooms,
  formatPropertyBhk,
  formatPropertySpecsSummary,
  formatRegistrationBadge,
} from '../utils/propertySpecs.ts';

interface ProjectDetailsPageProps {
  project: Project;
  developer?: Developer;
  otherDeveloperProjects: Project[];
  comparableProjects: Project[];
  inventoryLogs: InventoryLog[];
  mapsApiKey: string;
  mapsLoading?: boolean;
  currency: CurrencyCode;
  language: Language;
  isSaved: boolean;
  isCompared: boolean;
  onBack: () => void;
  onSelectProject: (project: Project) => void;
  onToggleSave: (project: Project) => void;
  onToggleCompare: (project: Project) => void;
  onOpenVirtualTour: (project: Project) => void;
  onOpenEnquiry: (
    type: EnquiryType,
    project: Project,
    context?: 'availability_sheet'
  ) => void;
  onRefreshInventory: (project: Project) => Promise<void>;
  onRetryMapsConfig?: () => void;
}

const ProjectMapRecenter: React.FC<{
  target: LatLng;
  zoom: number;
  token: number;
}> = ({ target, zoom, token }) => {
  const map = useMap();
  React.useEffect(() => {
    if (!map) return;
    map.panTo(target);
    map.setZoom(zoom);
  }, [map, target.lat, target.lng, zoom, token]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        map.panTo(target);
        map.setZoom(zoom);
      }}
      className="absolute bottom-7 left-2.5 z-10 h-8 sm:h-9 px-2.5 sm:px-3 bg-[#080808]/95 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer"
    >
      <Crosshair className="w-3.5 h-3.5 text-[#D4AF72]" />
      <span>Recenter Pin</span>
    </button>
  );
};

const ProjectPinWithPopup: React.FC<{
  project: Project;
  position: LatLng;
}> = ({ project, position }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={project.name}
        collisionBehavior={CollisionBehavior.REQUIRED}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="px-2.5 py-1 bg-[#080808] text-[#F5F1E8] text-xs font-semibold border border-[#D4AF72] shadow-lg cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[#D4AF72]" />
          <span>{project.name}</span>
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2.5 sm:p-3 bg-[#121212] text-[#F5F1E8] w-[min(250px,calc(100vw-64px))] space-y-1 text-xs">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF72]">
              {project.emirate} · {project.community}
            </p>
            <p className="font-display text-sm font-medium text-[#F5F1E8]">{project.name}</p>
            <p className="text-[11px] text-[#A5A19A]">
              {project.fullAddress || `${project.community}, ${project.emirate}, UAE`}
            </p>
            <p className="font-mono-tabular text-[11px] text-[#D4AF72]">
              {position.lat.toFixed(5)}° N, {position.lng.toFixed(5)}° E
            </p>
            <a
              href={getGoogleMapsDirectionsUrl(position, project.googleMapsUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-[#D4AF72] text-[#080808] text-[11px] font-semibold"
            >
              <Navigation className="w-3 h-3" />
              <span>Directions</span>
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const ProjectDetailsPage: React.FC<ProjectDetailsPageProps> = ({
  project,
  developer,
  otherDeveloperProjects,
  comparableProjects,
  inventoryLogs,
  mapsApiKey,
  mapsLoading = false,
  currency,
  language,
  isSaved,
  isCompared,
  onBack,
  onSelectProject,
  onToggleSave,
  onToggleCompare,
  onOpenVirtualTour,
  onOpenEnquiry,
  onRefreshInventory,
  onRetryMapsConfig,
}) => {
  const companyInfo = useCompanyInfo();
  const [activePhoto, setActivePhoto] = useState(project.heroImage);
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<MediaCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [mapErrorReason, setMapErrorReason] = useState<MapsErrorReason | null>(null);
  const [mapRetryToken, setMapRetryToken] = useState(0);
  const [areaSearch, setAreaSearch] = useState('');
  const [areaSearching, setAreaSearching] = useState(false);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [areaResult, setAreaResult] = useState<GeocodeResultItem | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);

  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    () => project.primaryVideo?.id || project.videoItems?.[0]?.id || ''
  );

  const markUrlFailed = React.useCallback((url: string) => {
    if (!url) return;
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const markUrlLoaded = React.useCallback((url: string) => {
    if (!url) return;
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  React.useEffect(() => {
    setActivePhoto(project.heroImage);
    setFailedUrls(new Set());
    setLoadedUrls(new Set());
    setMediaCategoryFilter('all');
    setSelectedVideoId(project.primaryVideo?.id || project.videoItems?.[0]?.id || '');
    setAreaResult(null);
    setAreaError(null);
    setMapFocusToken((n) => n + 1);
  }, [project.id, project.heroImage, project.primaryVideo?.id]);

  const handleAreaSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = areaSearch.trim();
    if (q.length < 2) return;
    setAreaError(null);
    setAreaSearching(true);
    try {
      const res = await geocodeAddressOnServer(`${q}, ${project.emirate}, UAE`, 'ae');
      setAreaResult(res.primary);
      setMapFocusToken((n) => n + 1);
    } catch (err) {
      setAreaError(err instanceof Error ? err.message : 'Unable to locate this area.');
    } finally {
      setAreaSearching(false);
    }
  };

  const activeVideo = React.useMemo(() => {
    return (
      (project.videoItems || []).find((v) => v.id === selectedVideoId) ||
      project.primaryVideo ||
      (project.videoItems && project.videoItems[0]) ||
      null
    );
  }, [project.videoItems, project.primaryVideo, selectedVideoId]);

  const displayName = language === 'ar' && project.nameAr ? project.nameAr : project.name;
  const displayDesc =
    language === 'ar' && project.descriptionAr ? project.descriptionAr : project.description;

  const effectiveTourStatus = getEffectiveTourStatus(project);

  const projectMediaList: ProjectMediaItem[] = React.useMemo(() => {
    const owned = (project.mediaItems || []).filter(
      (m) => m.projectId === project.id && Boolean(m.url)
    );
    const list: ProjectMediaItem[] = [...owned];

    if (!list.some((m) => m.url === project.heroImage) && project.heroImage) {
      list.unshift({
        id: `${project.id}-hero-fallback`,
        projectId: project.id,
        url: project.heroImage,
        category: 'exterior',
        classification: project.heroClassification || 'illustrative_image',
        caption: `${project.name} Architectural Elevation`,
        sourceName: project.heroSourceName || `${project.developerName} Media Feed`,
        sourcePriority: 1,
        verifiedProjectSpecific: Boolean(project.verified),
      });
    }

    for (const [idx, cImg] of (project.constructionImages || []).entries()) {
      if (cImg && !list.some((m) => m.url === cImg)) {
        list.push({
          id: `${project.id}-const-${idx}`,
          projectId: project.id,
          url: cImg,
          category: 'construction_progress',
          classification: 'construction_photo',
          caption: `${project.name} Construction Update`,
          sourceName: project.heroSourceName || 'Verified Site Documentation',
          sourcePriority: 4,
          verifiedProjectSpecific: false,
        });
      }
    }

    return list;
  }, [project]);

  const activeMedia =
    projectMediaList.find((m) => m.url === activePhoto) || projectMediaList[0];

  const availableCategories = React.useMemo(
    () => Array.from(new Set(projectMediaList.map((m) => m.category))),
    [projectMediaList]
  );

  const mediaDisplayLabels = React.useMemo(() => {
    const totalPerCategory = new Map<MediaCategory, number>();
    for (const item of projectMediaList) {
      totalPerCategory.set(item.category, (totalPerCategory.get(item.category) ?? 0) + 1);
    }
    const seenPerCategory = new Map<MediaCategory, number>();
    const map = new Map<string, string>();
    for (const item of projectMediaList) {
      const count = totalPerCategory.get(item.category) ?? 1;
      const idx = (seenPerCategory.get(item.category) ?? 0) + 1;
      seenPerCategory.set(item.category, idx);
      const base = MEDIA_CATEGORY_LABELS[item.category];
      map.set(item.id, count > 1 ? `${base} · View ${idx}` : base);
    }
    return map;
  }, [projectMediaList]);

  const filteredMedia = React.useMemo(
    () =>
      mediaCategoryFilter === 'all'
        ? projectMediaList
        : projectMediaList.filter((m) => m.category === mediaCategoryFilter),
    [projectMediaList, mediaCategoryFilter]
  );

  const regBadge = formatRegistrationBadge(project.registrationNumber);
  const inv = project.inventory;
  const projectLogs = inventoryLogs.filter((l) => l.projectId === project.id);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshInventory(project);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyShare = async () => {
    const shareUrl = `${window.location.origin}/#project/${encodeURIComponent(project.slug)}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${project.name} (${project.community}, ${project.emirate}) — ${formatProjectPrice(
      project.startingPriceAed,
      currency
    )} via WHITE COLLAR REALTY: ${window.location.origin}/#project/${encodeURIComponent(project.slug)}`
  )}`;

  const emailShareUrl = `mailto:?subject=${encodeURIComponent(
    `WHITE COLLAR REALTY Dossier: ${project.name}`
  )}&body=${encodeURIComponent(
    `Explore ${project.name} by ${project.developerName} in ${project.community}, ${project.emirate}.\nStarting Price: ${formatProjectPrice(
      project.startingPriceAed,
      currency
    )}\nLink: ${window.location.origin}/#project/${encodeURIComponent(project.slug)}`
  )}`;

  return (
    <div className="bg-[#080808] text-[#F5F1E8] min-h-screen pb-24">
      {/* Top Breadcrumb Bar */}
      <div className="bg-[#121212] border-b border-[#D4AF72]/20">
        <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-[#F5F1E8] hover:text-[#D4AF72] flex items-center gap-2 transition-colors min-h-[36px]"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF72] shrink-0" />
            <span>Back to All UAE Projects</span>
          </button>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <button
              type="button"
              onClick={() => onToggleSave(project)}
              className={`h-9 px-3 sm:px-3.5 border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isSaved
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                  : 'bg-[#1B1B1B] border-[#D4AF72]/25 text-[#F5F1E8] hover:border-[#D4AF72]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save Favorite'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleCompare(project)}
              className={`h-9 px-3 sm:px-3.5 border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                isCompared
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                  : 'bg-[#1B1B1B] border-[#D4AF72]/25 text-[#F5F1E8] hover:border-[#D4AF72]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" />
              <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#34D399] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#6EE7B7] shrink-0" />
              <span className="hidden sm:inline">Share WhatsApp</span>
              <span className="sm:hidden">WhatsApp</span>
            </a>

            <a
              href={emailShareUrl}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Mail className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
              <span>Email</span>
            </a>

            <button
              type="button"
              onClick={() => exportSingleProjectToExcel(project, developer)}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#34D399] flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Download detailed Excel spreadsheet dossier"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#6EE7B7] shrink-0" />
              <span className="hidden xs:inline">Export Excel</span>
              <span className="xs:hidden">Excel</span>
            </button>

            <a
              href={
                project.brochureUrl ||
                `/api/projects/${encodeURIComponent(project.slug)}/brochure`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Download / Print Institutional PDF Dossier"
            >
              <Download className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
              <span>PDF Dossier</span>
            </a>

            <button
              type="button"
              onClick={handleCopyShare}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
              <span>{copiedLink ? 'Link Copied' : 'Copy URL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-[1440px] 2xl:max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8 sm:space-y-10">
        {/* Project Header & Hero Media Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          <div className="lg:col-span-7 min-w-0 flex flex-col gap-3">
            <div className="relative aspect-[16/10] w-full bg-[#121212] border border-[#D4AF72]/25 overflow-hidden">
              {activePhoto && !failedUrls.has(activePhoto) ? (
                <>
                  {!loadedUrls.has(activePhoto) && (
                    <LuxurySkeleton className="absolute inset-0 w-full h-full" />
                  )}
                  <img
                    src={activePhoto}
                    alt={activeMedia?.caption || project.name}
                    referrerPolicy="no-referrer"
                    onLoad={() => markUrlLoaded(activePhoto)}
                    onError={() => markUrlFailed(activePhoto)}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      loadedUrls.has(activePhoto) ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#121212] text-[#F5F1E8] p-6 sm:p-8 text-center">
                  <Camera className="w-9 h-9 sm:w-10 sm:h-10 text-[#D4AF72] mb-2.5 sm:mb-3" />
                  <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                    PROJECT PHOTOGRAPHS NOT AVAILABLE
                  </p>
                  <p className="font-display text-xl sm:text-2xl font-medium mt-2 break-words">
                    {displayName}
                  </p>
                  <p className="text-xs text-[#A5A19A] max-w-md mt-2 leading-relaxed">
                    White Collar Realty never substitutes photos from other developments. Official
                    site photographs or developer media for this project are pending verification.
                  </p>
                </div>
              )}
              {activeMedia && (
                <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 max-w-[calc(100%-1.25rem)] truncate px-2 sm:px-2.5 py-1 bg-[#080808]/90 border border-[#D4AF72]/30 text-[#F5F1E8] text-[10px] sm:text-[11px] font-semibold">
                  {MEDIA_CLASSIFICATION_LABELS[activeMedia.classification]} ·{' '}
                  {mediaDisplayLabels.get(activeMedia.id) || MEDIA_CATEGORY_LABELS[activeMedia.category]}
                </div>
              )}
              <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-4 sm:left-4 sm:right-4 flex items-center justify-end gap-2">
                {effectiveTourStatus === '360_available' ||
                effectiveTourStatus === '3d_available' ? (
                  <button
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="group px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-[#080808]/95 text-[#F5F1E8] text-[10px] sm:text-xs font-semibold hover:bg-[#D4AF72] hover:text-[#080808] transition-colors flex items-center gap-1.5 sm:gap-2 border border-[#D4AF72] shadow-lg cursor-pointer max-w-full"
                  >
                    <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D4AF72] group-hover:text-[#080808] transition-colors shrink-0" />
                    <span>EXPLORE 3D VIRTUAL TOUR</span>
                    {(project.virtualTour.tours || []).length > 1 && (
                      <span className="bg-[#D4AF72] text-[#080808] text-[10px] px-1.5 py-0.5 font-mono-tabular shrink-0">
                        {(project.virtualTour.tours || []).length} Tours
                      </span>
                    )}
                  </button>
                ) : effectiveTourStatus === 'video_available' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('project-video-showcase');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                      else onOpenVirtualTour(project);
                    }}
                    className="px-2.5 sm:px-4 py-1.5 sm:py-2.5 bg-[#064E3B]/95 text-[#ECFDF5] text-[10px] sm:text-xs font-semibold hover:bg-[#047857] transition-colors flex items-center gap-1.5 sm:gap-2 border border-[#34D399]/50 shadow-lg cursor-pointer max-w-full"
                  >
                    <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6EE7B7] shrink-0" />
                    <span>WATCH VIDEO WALKTHROUGH</span>
                    {(project.videoItems || []).length > 1 && (
                      <span className="bg-[#080808] text-[#F5F1E8] text-[10px] px-1.5 py-0.5 font-mono-tabular shrink-0">
                        {(project.videoItems || []).length} Videos
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 sm:gap-2 bg-[#080808]/90 backdrop-blur-sm p-1 sm:p-1.5 border border-[#D4AF72]/30 max-w-full">
                    <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#D4AF72] px-1.5 sm:px-2">
                      MEDIA NOT AVAILABLE
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenEnquiry('virtual_consultation', project)}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#D4AF72] text-[#080808] text-[10px] sm:text-[11px] font-semibold hover:bg-[#E6C77A] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span>Request Tour</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {activeMedia ? (
              <div className="bg-[#121212] border border-[#D4AF72]/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5A19A]">
                <span>
                  <strong className="text-[#F5F1E8]">{activeMedia.caption}</strong>
                </span>
                <span className="text-[11px] text-[#A5A19A]">
                  Source: {activeMedia.sourceName} ·{' '}
                  {activeMedia.verifiedProjectSpecific
                    ? 'Verified Project Asset'
                    : 'Awaiting Official Photo Verification'}
                </span>
              </div>
            ) : (
              <div className="bg-[#121212] border border-[#D4AF72]/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5A19A]">
                <span className="font-semibold text-[#F5F1E8]">
                  PROJECT PHOTOGRAPHS NOT AVAILABLE
                </span>
                <span className="text-[11px] text-[#A5A19A]">
                  Zero duplicate photo substitution policy active
                </span>
              </div>
            )}

            {/* Thumbnail Strip */}
            {projectMediaList.length > 0 && (
              <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 sm:gap-3">
                {projectMediaList.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePhoto(item.url)}
                    className={`relative aspect-[16/10] overflow-hidden border transition-colors bg-[#121212] ${
                      activePhoto === item.url
                        ? 'border-[#D4AF72] ring-1 ring-[#D4AF72]'
                        : 'border-[#D4AF72]/20 hover:border-[#D4AF72]/60'
                    }`}
                  >
                    {failedUrls.has(item.url) ? (
                      <div className="w-full h-full bg-[#121212] flex flex-col items-center justify-center gap-1">
                        <Camera className="w-4 h-4 text-[#D4AF72]/70" />
                        <span className="text-[9px] uppercase tracking-wider text-[#A5A19A]">
                          Unavailable
                        </span>
                      </div>
                    ) : (
                      <>
                        {!loadedUrls.has(item.url) && (
                          <LuxurySkeleton className="absolute inset-0 w-full h-full" />
                        )}
                        <img
                          src={item.url}
                          alt={item.caption}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onLoad={() => markUrlLoaded(item.url)}
                          onError={() => markUrlFailed(item.url)}
                          className={`w-full h-full object-cover transition-opacity duration-300 ${
                            loadedUrls.has(item.url) ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-[#080808]/85 text-[#F5F1E8] text-[10px] px-1.5 py-0.5 truncate text-left">
                      {mediaDisplayLabels.get(item.id) || MEDIA_CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Summary Dossier */}
          <div className="lg:col-span-5 min-w-0 bg-[#121212] border border-[#D4AF72]/25 p-5 sm:p-6 lg:p-8 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#A5A19A] mb-2">
                <span className="font-semibold text-[#D4AF72]">{project.category}</span>
                <span aria-hidden="true">·</span>
                <span>{project.emirate}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-[#6EE7B7] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {project.verified ? 'Verified Registry' : 'Pending Verification'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[11px] text-[#A5A19A]">
                  Verified{' '}
                  <span className="ltr-isolate">
                    {new Date(project.lastVerifiedAt || project.updatedAt).toLocaleDateString()}
                  </span>
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl font-medium text-[#F5F1E8] leading-tight break-words">
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs sm:text-sm text-[#A5A19A] flex items-start gap-1.5 min-w-0">
                  <MapPin className="w-4 h-4 text-[#D4AF72] shrink-0 mt-0.5" />
                  <span className="break-words">{formatCleanFullAddress(project)}</span>
                </p>
                <a
                  href={
                    project.googleMapsUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${project.coordinates.lat},${project.coordinates.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#D4AF72] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 my-6 py-5 border-y border-[#D4AF72]/20">
                <div className="min-w-0">
                  <p className="text-xs text-[#A5A19A]">Starting Price</p>
                  <p className="font-mono-tabular ltr-isolate text-lg sm:text-xl font-semibold text-[#F5F1E8] mt-0.5 break-words">
                    {formatProjectPrice(project.startingPriceAed, currency)}
                  </p>
                  {currency !== 'INR' && project.startingPriceAed > 0 && (
                    <p
                      className="text-xs font-mono-tabular ltr-isolate text-[#D4AF72] font-semibold mt-0.5"
                      title={formatInrTimestampNote()}
                    >
                      ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                    </p>
                  )}
                  {currency === 'INR' && project.startingPriceAed > 0 && (
                    <p
                      className="text-xs font-mono-tabular ltr-isolate text-[#D4AF72] font-semibold mt-0.5"
                      title={formatInrTimestampNote()}
                    >
                      ≈ AED {project.startingPriceAed.toLocaleString()}
                    </p>
                  )}
                  <p className="text-[10px] text-[#A5A19A] mt-0.5">{formatInrTimestampNote()}</p>
                  <p className="text-[11px] font-mono-tabular ltr-isolate text-[#A5A19A] mt-1">
                    {project.maxPriceAed > 0
                      ? `Up to ${formatProjectPrice(project.maxPriceAed, currency)}`
                      : 'Official developer pricing sheet on request'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[#A5A19A]">Booking Amount / Down Payment</p>
                  <p className="font-mono-tabular ltr-isolate text-lg sm:text-xl font-semibold text-[#6EE7B7] mt-0.5 break-words">
                    {project.bookingAmountAed
                      ? formatProjectPrice(project.bookingAmountAed, currency)
                      : `${project.downPaymentPct || 10}%`}
                  </p>
                  {currency !== 'INR' &&
                    Boolean(project.bookingAmountAed) &&
                    (project.bookingAmountAed ?? 0) > 0 && (
                      <p className="text-xs font-mono-tabular ltr-isolate text-[#D4AF72] font-semibold mt-0.5">
                        ≈ {formatCurrency(project.bookingAmountAed, 'INR')}
                      </p>
                    )}
                  <p className="text-[11px] text-[#A5A19A] mt-1">
                    <span className="ltr-isolate">{project.downPaymentPct || 10}%</span> initial booking allocation
                  </p>
                </div>
              </div>

              {/* Separate Property Details Strip: Bedrooms | Bathrooms | Area (sq ft) */}
              <div className="mb-5 pb-5 border-b border-[#D4AF72]/20 grid grid-cols-1 xs:grid-cols-3 gap-3 xs:gap-0 xs:divide-x xs:divide-[#D4AF72]/20">
                <div className="flex items-baseline justify-between gap-2 xs:block xs:pr-3 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#A5A19A]">Bedrooms</p>
                  <p className="text-sm font-semibold text-[#F5F1E8] mt-0.5 break-words ltr-isolate">
                    {formatPropertyBhk(project)}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-2 xs:block xs:px-3 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#A5A19A]">Bathrooms</p>
                  <p
                    className={`text-sm font-semibold mt-0.5 break-words ${
                      formatPropertyBathrooms(project) === 'Not Available'
                        ? 'text-[#A5A19A]'
                        : 'text-[#F5F1E8]'
                    }`}
                  >
                    {formatPropertyBathrooms(project)}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-2 xs:block xs:pl-3 min-w-0">
                  <p className="text-[11px] uppercase tracking-wider text-[#A5A19A]">Area</p>
                  <p
                    className={`text-sm font-mono-tabular ltr-isolate font-semibold mt-0.5 break-words ${
                      formatPropertyAreaSqFt(project) === 'Not Available'
                        ? 'text-[#A5A19A] font-sans'
                        : 'text-[#F5F1E8]'
                    }`}
                  >
                    {formatPropertyAreaSqFt(project)}
                  </p>
                </div>
              </div>

              {/* Key Project Specs Grid */}
              <dl className="grid grid-cols-1 xs:grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Master Developer</dt>
                  <dd className="font-semibold text-[#F5F1E8] mt-0.5 flex items-center gap-1 break-words">
                    <span>{project.developerName}</span>
                    {developer?.website && (
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF72] hover:text-[#E6C77A] shrink-0"
                        title="Official Developer Website"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">{regBadge.label}</dt>
                  <dd className="font-mono-tabular ltr-isolate font-semibold text-[#F5F1E8] mt-0.5 break-all">
                    {regBadge.value}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Construction Progress</dt>
                  <dd className="font-mono-tabular ltr-isolate font-semibold text-[#F5F1E8] mt-0.5">
                    {project.constructionPct}% ({project.status})
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Expected Handover</dt>
                  <dd className="font-mono-tabular ltr-isolate font-semibold text-[#F5F1E8] mt-0.5">
                    {project.handoverDate}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Payment Plan</dt>
                  <dd className="font-medium text-[#F5F1E8] mt-0.5 break-words">{project.paymentPlan}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Developer Sales Office</dt>
                  <dd className="text-[#F5F1E8] mt-0.5 text-[11px] leading-tight break-words">
                    {project.salesOfficeAddress ||
                      developer?.salesOfficeAddress ||
                      'Dubai Corporate Sales Gallery'}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[#A5A19A]">Verified Sales Hotline</dt>
                  <dd className="text-[#F5F1E8] font-semibold mt-0.5">
                    {(() => {
                      const hotline =
                        project.salesOfficePhone ||
                        developer?.salesOfficePhone ||
                        companyInfo.primaryPhone;
                      return (
                        <a
                          href={`tel:${hotline.replace(/\s+/g, '')}`}
                          className="hover:text-[#D4AF72] transition-colors font-mono-tabular ltr-isolate"
                        >
                          {hotline}
                        </a>
                      );
                    })()}
                  </dd>
                </div>
                {project.projectUrl && (
                  <div className="xs:col-span-2 pt-2 border-t border-[#D4AF72]/15 min-w-0">
                    <dt className="text-[#A5A19A]">Official Project Reference URL</dt>
                    <dd className="mt-0.5">
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF72] font-medium hover:underline inline-flex items-center gap-1 break-all"
                      >
                        <span>{project.projectUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Direct Customer Conversion Actions */}
            <div className="mt-6 pt-6 border-t border-[#D4AF72]/20 grid grid-cols-1 xs:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onOpenEnquiry('callback', project)}
                className="py-2.5 px-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Request Callback</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('whatsapp', project)}
                className="py-2.5 px-3 bg-[#065F46] text-[#ECFDF5] border border-[#34D399]/35 text-xs font-medium hover:bg-[#047857] transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Enquiry</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('visit', project)}
                className="py-2.5 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] transition-colors flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Schedule Visit</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('virtual_consultation', project)}
                className="py-2.5 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] transition-colors flex items-center justify-center gap-1.5"
              >
                <Video className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Virtual Consult</span>
              </button>
              <a
                href={
                  project.brochureUrl && project.brochureUrl.startsWith('http')
                    ? project.brochureUrl
                    : `/api/projects/${encodeURIComponent(project.slug)}/brochure`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>
                  {project.brochureUrl && project.brochureUrl.startsWith('http')
                    ? 'Official Brochure PDF'
                    : 'Download Dossier'}
                </span>
              </a>
              <button
                type="button"
                onClick={() => onOpenEnquiry('availability_alert', project)}
                className="py-2.5 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] transition-colors flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5 text-[#D4AF72]" />
                <span>Price &amp; Unit Alerts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated 360° Virtual Tour Section */}
        <section className="bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/35 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                  Dedicated Project Virtual Experience
                </span>
                <span aria-hidden="true" className="text-[#A5A19A]">
                  ·
                </span>
                <span className="font-semibold text-[#F5F1E8]">
                  Status: {TOUR_STATUS_LABELS[effectiveTourStatus]}
                </span>
                {effectiveTourStatus !== 'coming_soon' &&
                  (project.virtualTour.tours || []).length > 1 && (
                    <span className="bg-[#D4AF72] text-[#080808] text-[10px] font-mono-tabular font-semibold px-2 py-0.5">
                      {(project.virtualTour.tours || []).length} Verified Tours
                    </span>
                  )}
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-medium">
                {effectiveTourStatus === 'coming_soon'
                  ? 'Media Not Available'
                  : effectiveTourStatus === 'video_available'
                  ? `3D Virtual Tour Unavailable — Verified Video Walkthrough`
                  : `Interactive 3D & 360° Spatial Tour — ${project.name}`}
              </h2>

              <p className="text-xs sm:text-sm text-[#A5A19A] leading-relaxed">
                {effectiveTourStatus === '360_available'
                  ? `Explore ${project.virtualTour.rooms?.length || 0} true 360° panoramic scenes connected across floor levels, apartment interiors, exteriors, and amenities with interactive hotspots and floor-plan navigation.`
                  : effectiveTourStatus === '3d_available'
                  ? `Step inside an authorized ${project.virtualTour.provider || 'Matterport / 3D'} spatial twin bound specifically to ${project.name}. Source: ${project.virtualTour.directUrl || project.virtualTour.matterportUrl || 'Verified Developer Portal'}.`
                  : effectiveTourStatus === 'video_available'
                  ? `An official 3D virtual tour is not published for ${project.name}. Following our verified media priority (Independent Project Walkthrough → Independent Property Video → Official Developer Video), ${activeVideo ? `"${activeVideo.title}" by ${activeVideo.channelName}` : 'verified project video coverage'} is embedded below.`
                  : `In compliance with White Collar Realty's strict authenticity standards, we never use generic tours, ordinary photographs pretending to be 360°, cross-project media, or fabricated videos. Neither an official 3D virtual tour nor a project-verified video is currently published for ${project.name}.`}
              </p>

              {effectiveTourStatus !== 'coming_soon' &&
                (project.virtualTour.tours || []).length > 1 && (
                  <div className="pt-2">
                    <p className="text-[11px] text-[#D4AF72] font-semibold uppercase tracking-wider mb-2">
                      Available Verified Tours in Gallery:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(project.virtualTour.tours || []).map((t, idx) => (
                        <span
                          key={t.id || idx}
                          className="text-xs bg-[#1B1B1B] px-3 py-1 border border-[#D4AF72]/25 text-[#F5F1E8] flex items-center gap-1.5"
                        >
                          <Compass className="w-3.5 h-3.5 text-[#D4AF72]" />
                          <span>
                            {t.title} ({t.provider})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {effectiveTourStatus === '360_available' ||
              effectiveTourStatus === '3d_available' ? (
                <button
                  type="button"
                  onClick={() => onOpenVirtualTour(project)}
                  className="px-6 py-3.5 bg-[#D4AF72] text-[#080808] text-xs sm:text-sm font-semibold hover:bg-[#E6C77A] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>EXPLORE 3D VIRTUAL TOUR</span>
                </button>
              ) : effectiveTourStatus === 'video_available' ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('project-video-showcase');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-5 py-3 bg-[#065F46] text-[#ECFDF5] text-xs sm:text-sm font-semibold hover:bg-[#047857] transition-colors flex items-center justify-center gap-2 border border-[#34D399]/40 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Watch Video Alternative Below</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="px-4 py-3 bg-[#1B1B1B] border border-[#D4AF72]/35 text-[#F5F1E8] text-xs font-semibold hover:border-[#D4AF72] transition-colors cursor-pointer"
                  >
                    Fullscreen Player
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <span className="px-4 py-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-center text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                    Media Not Available
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEnquiry('virtual_consultation', project)}
                    className="px-5 py-3 bg-[#D4AF72] text-[#080808] text-xs sm:text-sm font-semibold hover:bg-[#E6C77A] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Request Live Video Tour</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {effectiveTourStatus === '360_available' &&
            (project.virtualTour.rooms || []).length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#D4AF72]/20 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(project.virtualTour.rooms || []).slice(0, 4).map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="text-left border border-[#D4AF72]/20 bg-[#1B1B1B] hover:border-[#D4AF72] p-3 transition-colors"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[#D4AF72] font-semibold">
                      {room.floorLevel} · {room.viewCategory.replace('_', ' ')}
                    </p>
                    <p className="text-xs font-semibold text-[#F5F1E8] mt-1 truncate">
                      {room.label}
                    </p>
                    <p className="text-[11px] text-[#A5A19A] mt-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#D4AF72]" />
                      <span>{(room.hotspots || []).length} hotspots</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
        </section>

        {/* Prioritized Independent Walkthrough & Property Video Alternative Section */}
        <section
          id="project-video-showcase"
          className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#D4AF72]/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                <span>
                  {activeVideo
                    ? activeVideo.priorityLevel === 1
                      ? 'Priority 1 · Independent Real Estate Creator Walkthrough'
                      : activeVideo.priorityLevel === 2
                      ? 'Priority 2 · Independent Construction & Location Video'
                      : 'Priority 4 · Official Developer Video'
                    : 'Verified Video Intelligence'}
                </span>
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8] mt-0.5">
                {activeVideo
                  ? 'Project Video Walkthrough & Independent Coverage'
                  : 'Project Video Coverage'}
              </h2>
              <p className="text-xs text-[#A5A19A] mt-1">
                Priority order: Official 3D Tour → Independent Project Walkthrough → Independent
                Property Video → Official Developer Video
              </p>
            </div>
            {activeVideo ? (
              <span
                className={`text-xs px-3 py-1.5 font-semibold flex items-center gap-1.5 border ${
                  activeVideo.priorityLevel === 1
                    ? 'bg-[#064E3B]/50 text-[#6EE7B7] border-[#34D399]/35'
                    : activeVideo.priorityLevel === 2
                    ? 'bg-[#1B1B1B] text-[#93C5FD] border-[#60A5FA]/35'
                    : 'bg-[#1B1B1B] text-[#D4AF72] border-[#D4AF72]/35'
                }`}
              >
                {activeVideo.priorityLevel <= 2 ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeVideo.channelType === 'independent_agent'
                    ? 'Independent Property Agent'
                    : activeVideo.channelType === 'independent_reviewer'
                    ? 'Independent Real Estate Reviewer'
                    : activeVideo.channelType === 'construction_monitor'
                    ? 'Independent Site Telemetry'
                    : 'Official Developer Channel'}
                </span>
              </span>
            ) : (
              <span className="text-xs bg-[#1B1B1B] text-[#A5A19A] border border-[#D4AF72]/20 px-3 py-1.5 font-semibold">
                Media Not Available
              </span>
            )}
          </div>

          {activeVideo || project.walkthroughVideoUrl ? (
            <div className="mt-6 space-y-5">
              {/* Multiple Verified Videos Selector Grid */}
              {(project.videoItems || []).length > 1 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A5A19A]">
                    Verified Project Videos ({(project.videoItems || []).length} sources — sorted
                    by independence &amp; recency)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(project.videoItems || []).map((vItem) => {
                      const isSelected = activeVideo?.id === vItem.id;
                      return (
                        <button
                          key={vItem.id}
                          type="button"
                          onClick={() => setSelectedVideoId(vItem.id)}
                          className={`text-left border p-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-[#D4AF72] bg-[#1B1B1B] ring-1 ring-[#D4AF72]/40'
                              : 'border-[#D4AF72]/15 bg-[#080808] hover:border-[#D4AF72]/60'
                          }`}
                        >
                          {vItem.thumbnailUrl && !failedUrls.has(vItem.thumbnailUrl) ? (
                            <img
                              src={vItem.thumbnailUrl}
                              alt={vItem.title}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() => markUrlFailed(vItem.thumbnailUrl)}
                              className="w-24 aspect-video object-cover bg-[#080808] shrink-0 border border-[#D4AF72]/20"
                            />
                          ) : (
                            <div className="w-24 aspect-video bg-[#080808] shrink-0 border border-[#D4AF72]/20 flex items-center justify-center">
                              <Video className="w-4 h-4 text-[#D4AF72]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <span
                              className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 ${
                                vItem.priorityLevel === 1
                                  ? 'bg-[#064E3B]/60 text-[#6EE7B7]'
                                  : vItem.priorityLevel === 2
                                  ? 'bg-[#1E3A8A]/45 text-[#93C5FD]'
                                  : 'bg-[#1B1B1B] text-[#D4AF72]'
                              }`}
                            >
                              {vItem.priorityLevel === 1
                                ? 'Independent Walkthrough'
                                : vItem.priorityLevel === 2
                                ? 'Construction / Location'
                                : 'Developer Video'}
                            </span>
                            <p className="text-xs font-semibold text-[#F5F1E8] line-clamp-2 leading-snug">
                              {vItem.title}
                            </p>
                            <p className="text-[11px] text-[#A5A19A] truncate">
                              {vItem.channelName}
                            </p>
                            <p className="text-[10px] font-mono-tabular text-[#A5A19A]">
                              Uploaded {vItem.publishedAt}
                              {vItem.duration ? ` · ${vItem.duration}` : ''}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Embedded Video Player */}
              <div className="relative aspect-[16/9] w-full bg-[#080808] border border-[#D4AF72]/25 overflow-hidden">
                <iframe
                  src={activeVideo?.embedUrl || project.walkthroughVideoUrl}
                  title={activeVideo?.title || `${project.name} Video Walkthrough`}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Active Video Metadata Card */}
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  {activeVideo?.thumbnailUrl && !failedUrls.has(activeVideo.thumbnailUrl) && (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => markUrlFailed(activeVideo.thumbnailUrl)}
                      className="w-24 aspect-video object-cover border border-[#D4AF72]/20 shrink-0 hidden sm:block"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-[#F5F1E8] leading-snug">
                      {activeVideo?.title || `${project.name} Walkthrough`}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A5A19A]">
                      <span>
                        <strong className="text-[#F5F1E8]">Channel:</strong>{' '}
                        {activeVideo?.channelName || project.developerName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#D4AF72]" />
                        <strong className="text-[#F5F1E8]">Upload Date:</strong>{' '}
                        {activeVideo?.publishedAt || 'Verified Recent'}
                      </span>
                      {activeVideo?.duration && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{activeVideo.duration}</span>
                        </>
                      )}
                      {Boolean(activeVideo?.viewCount) && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{activeVideo?.viewCount}</span>
                        </>
                      )}
                    </div>
                    {activeVideo?.notes && (
                      <p className="text-[11px] text-[#A5A19A]">{activeVideo.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeVideo?.sourceUrl && (
                    <a
                      href={activeVideo.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[#121212] border border-[#D4AF72]/30 hover:border-[#D4AF72] text-[#F5F1E8] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Original Source</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#D4AF72]" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenEnquiry('virtual_consultation', project)}
                    className="px-3.5 py-2 bg-[#D4AF72] text-[#080808] hover:bg-[#E6C77A] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Live Guided Tour</span>
                  </button>
                  <a
                    href={`https://wa.me/${(project.salesOfficeWhatsapp || '918810286629').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello White Collar Realty, I watched the video for ${project.name} and would like floor plans and current availability.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-[#065F46] text-[#ECFDF5] hover:bg-[#047857] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 border border-[#D4AF72]/20 bg-[#1B1B1B] p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-[#121212] border border-[#D4AF72]/25 flex items-center justify-center mx-auto text-[#D4AF72]">
                <Video className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#F5F1E8]">
                Media Not Available
              </p>
              <p className="text-xs text-[#A5A19A] max-w-xl mx-auto leading-relaxed">
                Neither an official 3D virtual tour nor a verified, project-specific video
                walkthrough or construction update could be confirmed for{' '}
                <strong className="text-[#F5F1E8]">{project.name}</strong> in {project.community}.
                Under our strict zero-fabrication standard, unrelated project footage is never
                substituted.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenEnquiry('virtual_consultation', project)}
                  className="px-4 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Video className="w-4 h-4" />
                  <span>Request Live On-Site Video Call</span>
                </button>
                <a
                  href={`https://wa.me/${(project.salesOfficeWhatsapp || '918810286629').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello White Collar Realty, please notify me when a genuine video or 3D tour for ${project.name} is published.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#065F46] text-[#ECFDF5] text-xs font-semibold hover:bg-[#047857] transition-colors flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Notify via WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </section>

        {/* Categorized Project Photography Gallery */}
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#D4AF72]/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>Verified Project-Specific Media Archive</span>
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8] mt-0.5">
                Project Photography, Renders &amp; Construction Progress
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMediaCategoryFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  mediaCategoryFilter === 'all'
                    ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                    : 'bg-[#1B1B1B] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                }`}
              >
                All ({projectMediaList.length})
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMediaCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                    mediaCategoryFilter === cat
                      ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                      : 'bg-[#1B1B1B] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                  }`}
                >
                  {MEDIA_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {filteredMedia.length === 0 ? (
            <div className="mt-6 border border-[#D4AF72]/20 bg-[#1B1B1B] p-8 text-center">
              <Camera className="w-8 h-8 text-[#D4AF72] mx-auto mb-2" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#F5F1E8]">
                PROJECT PHOTOGRAPHS NOT AVAILABLE
              </p>
              <p className="text-xs text-[#A5A19A] mt-1 max-w-lg mx-auto">
                No verified project-specific photographs are currently published for {project.name}.
                Administrators can retrieve official images from the Project URL or upload
                verified photographs in the Operations Console.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMedia.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePhoto(item.url);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`text-left border transition-colors bg-[#1B1B1B] overflow-hidden ${
                    activePhoto === item.url
                      ? 'border-[#D4AF72]'
                      : 'border-[#D4AF72]/20 hover:border-[#D4AF72]'
                  }`}
                >
                  <div className="relative aspect-[16/10] bg-[#080808] overflow-hidden">
                    {failedUrls.has(item.url) ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                        <Camera className="w-6 h-6 text-[#D4AF72]/70 mb-1" />
                        <span className="text-[10px] uppercase tracking-wider text-[#A5A19A]">
                          Image Unavailable
                        </span>
                      </div>
                    ) : (
                      <>
                        {!loadedUrls.has(item.url) && (
                          <LuxurySkeleton className="absolute inset-0 w-full h-full" />
                        )}
                        <img
                          src={item.url}
                          alt={item.caption}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onLoad={() => markUrlLoaded(item.url)}
                          onError={() => markUrlFailed(item.url)}
                          className={`w-full h-full object-cover transition-opacity duration-300 ${
                            loadedUrls.has(item.url) ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </>
                    )}
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#080808]/90 border border-[#D4AF72]/25 text-[#F5F1E8] text-[10px] font-semibold">
                      {MEDIA_CLASSIFICATION_LABELS[item.classification]}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#D4AF72]">
                      <span>{mediaDisplayLabels.get(item.id) || MEDIA_CATEGORY_LABELS[item.category]}</span>
                      {item.verifiedProjectSpecific && (
                        <span className="text-[#6EE7B7]">Verified Project Photo</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#F5F1E8] line-clamp-1">
                      {item.caption}
                    </p>
                    <p className="text-[11px] text-[#A5A19A] line-clamp-1">
                      Source: {item.sourceName} (Priority {item.sourcePriority})
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Overview Description & Amenities */}
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mb-3">
              Architectural Overview &amp; Master Plan
            </h2>
            <p className="text-sm text-[#A5A19A] leading-relaxed mb-4">{displayDesc}</p>
            <p className="text-xs text-[#A5A19A]">
              <strong className="text-[#F5F1E8]">Master Plan Notes:</strong>{' '}
              {project.masterPlanNotes.replace(/\bsq\.?\s*ft\.?/gi, 'sq ft')}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
              Project Amenities &amp; Specifications
            </h3>
            <ul className="space-y-2 text-sm text-[#F5F1E8]">
              {project.amenities.map((item) => (
                <li key={item} className="pb-2 border-b border-[#D4AF72]/15 text-xs">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Real-Time Project Inventory & Audit History */}
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#D4AF72]/20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                Audited Unit Ledger
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F5F1E8] mt-0.5">
                Real-Time Project Inventory &amp; Availability
              </h2>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="h-9 px-4 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-2 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#D4AF72] ${refreshing ? 'animate-spin' : ''}`}
              />
              <span>{refreshing ? 'Syncing Feed...' : 'Refresh Provider Sync'}</span>
            </button>
          </div>

          {inv.status === 'verified_live' && inv.availableUnits !== null ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Total Units</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#F5F1E8]">
                    {inv.totalRegisteredUnits}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Released</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#F5F1E8]">
                    {inv.releasedUnits ?? inv.totalRegisteredUnits}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Available</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#6EE7B7]">
                    {inv.availableUnits}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Reserved</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#D4AF72]">
                    {inv.reservedUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Sold</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#A5A19A]">
                    {inv.soldUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">On Hold</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#A5A19A]">
                    {inv.onHoldUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                  <span className="text-xs text-[#A5A19A] block">Availability %</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#D4AF72]">
                    {inv.availabilityPct ?? 0}%
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#A5A19A] bg-[#1B1B1B] border border-[#D4AF72]/20 px-4 py-3">
                <span>
                  <strong className="text-[#F5F1E8]">Data Source:</strong> {inv.dataSource}
                </span>
                <span className="font-mono-tabular">
                  Last Verified Update: {new Date(inv.lastUpdatedAt).toLocaleString()}
                </span>
              </div>

              {/* Floor Availability Table */}
              {project.floorAvailability.length > 0 && (
                <div className="overflow-x-auto">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
                    Floor-Level Availability Matrix
                  </h3>
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#D4AF72]/25 text-[#A5A19A]">
                        <th className="py-2.5 pr-4">Floor Band</th>
                        <th className="py-2.5 px-4">Unit Types</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-right">Available</th>
                        <th className="py-2.5 px-4 text-right">Reserved</th>
                        <th className="py-2.5 px-4 text-right">Sold</th>
                        <th className="py-2.5 pl-4 text-right">From Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D4AF72]/15 font-mono-tabular">
                      {project.floorAvailability.map((row) => (
                        <tr key={row.floor}>
                          <td className="py-2.5 pr-4 font-sans font-medium text-[#F5F1E8]">
                            {row.floor}
                          </td>
                          <td className="py-2.5 px-4 font-sans text-[#A5A19A]">{row.unitTypes}</td>
                          <td className="py-2.5 px-4 text-right text-[#F5F1E8]">
                            {row.totalUnits}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-[#6EE7B7]">
                            {row.availableUnits}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#D4AF72]">
                            {row.reservedUnits}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#A5A19A]">
                            {row.soldUnits}
                          </td>
                          <td className="py-2.5 pl-4 text-right font-semibold text-[#F5F1E8]">
                            {formatCurrency(row.minPriceAed, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 bg-[#1B1B1B] border border-[#D4AF72]/25 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-[#D4AF72]">
                    Developer Direct Availability Inquiry Required
                  </span>
                  <h3 className="text-lg font-semibold text-[#F5F1E8] mt-1">
                    Contact Developer for Latest Availability
                  </h3>
                  <p className="text-xs text-[#A5A19A] mt-1.5 leading-relaxed max-w-2xl">
                    {inv.totalRegisteredUnits
                      ? `Registry records ${inv.totalRegisteredUnits} registered units in ${project.name}, while live unit-by-unit availability is released directly via ${project.developerName}.`
                      : `Automated unit-by-unit counts are not published publicly for ${project.developerName}. Request the latest verified unit sheet & price list directly.`}{' '}
                    <span className="text-[#F5F1E8]">Source: {inv.dataSource}.</span>
                  </p>
                </div>
                <span className="font-mono-tabular text-[11px] text-[#A5A19A] bg-[#121212] border border-[#D4AF72]/20 px-3 py-1.5 shrink-0">
                  Last Verified: {new Date(inv.lastUpdatedAt || project.lastVerifiedAt || project.updatedAt).toLocaleString()}
                </span>
              </div>

              {/* Verified Configurations & Starting Prices even when unit-by-unit counts are off-feed */}
              <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 gap-3 text-xs border-y border-[#D4AF72]/15 py-4">
                <div>
                  <span className="text-[#A5A19A] block text-[11px]">Starting Price</span>
                  <span className="font-mono-tabular ltr-isolate font-semibold text-[#F5F1E8] text-sm">
                    {formatProjectPrice(project.startingPriceAed, currency)}
                  </span>
                  {currency !== 'INR' && project.startingPriceAed > 0 && (
                    <span className="block font-mono-tabular ltr-isolate text-[11px] text-[#D4AF72]">
                      ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[#A5A19A] block text-[11px]">Bedrooms</span>
                  <span className="font-semibold text-[#F5F1E8] ltr-isolate">
                    {formatPropertyBhk(project)}
                  </span>
                </div>
                <div>
                  <span className="text-[#A5A19A] block text-[11px]">Bathrooms</span>
                  <span className="font-semibold text-[#F5F1E8]">
                    {formatPropertyBathrooms(project)}
                  </span>
                </div>
                <div>
                  <span className="text-[#A5A19A] block text-[11px]">Area</span>
                  <span className="font-mono-tabular ltr-isolate text-[#F5F1E8]">
                    {formatPropertyAreaSqFt(project)}
                  </span>
                </div>
                <div>
                  <span className="text-[#A5A19A] block text-[11px]">Developer Sales Hotline</span>
                  <span className="font-mono-tabular ltr-isolate text-[#6EE7B7]">
                    {project.salesOfficePhone || developer?.contactPhone || companyInfo.primaryPhone}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenEnquiry('availability_alert', project, 'availability_sheet')}
                  className="px-4 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Request Verified Developer Availability Sheet</span>
                </button>
                <a
                  href={companyInfo.whatsappDeskUrl(
                    `Hello White Collar Realty Desk, please share the latest verified developer availability sheet for ${project.name} (${project.community}, ${project.emirate}).`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-[#065F46] text-[#ECFDF5] text-xs font-semibold hover:bg-[#047857] flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp Developer Desk</span>
                </a>
              </div>
            </div>
          )}

          {/* Inventory Update History */}
          {projectLogs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#D4AF72]/20">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
                Inventory Synchronization History
              </h3>
              <div className="space-y-2">
                {projectLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-b border-[#D4AF72]/15"
                  >
                    <div>
                      <span className="font-semibold text-[#F5F1E8]">
                        Available: {log.previousAvailable ?? 'N/A'} → {log.newAvailable ?? 'N/A'}
                      </span>
                      <span className="text-[#A5A19A] ml-2">
                        ({log.syncType} · {log.source})
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
          )}
        </section>

        {/* Floor Plans & Unit Types */}
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mb-4">
            Unit Configurations &amp; Floor Plans
          </h2>
          {project.floorPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {project.floorPlans.map((fp) => {
                const fpBhk = formatFloorPlanBhk(fp.bedrooms);
                const fpBathrooms = formatFloorPlanBathrooms(fp.bathrooms);
                const fpArea = formatFloorPlanAreaSqFt(fp.sizeSqFt);
                return (
                  <div
                    key={fp.id}
                    className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-4 flex flex-col justify-between hover:border-[#D4AF72] transition-colors"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <p className="text-xs font-semibold text-[#D4AF72] ltr-isolate">
                          Bedrooms: {fpBhk}
                        </p>
                        <span className="text-[11px] text-[#F5F1E8] font-medium bg-[#121212] px-2 py-0.5 border border-[#D4AF72]/20">
                          {fpBathrooms}
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-medium text-[#F5F1E8] mt-1.5 line-clamp-1">
                        {fp.name}
                      </h3>
                      <p className="text-xs text-[#A5A19A] mt-1">
                        {fp.floorRange} · {fp.exposure}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#D4AF72]/15 space-y-1.5 text-xs font-mono-tabular">
                      <div className="flex justify-between">
                        <span className="text-[#A5A19A]">Area</span>
                        <span className="font-semibold text-[#F5F1E8] ltr-isolate">{fpArea}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#A5A19A]">Starting Price</span>
                        <span className="font-semibold text-[#F5F1E8] ltr-isolate">
                          {formatProjectPrice(fp.priceAed, currency)}
                        </span>
                      </div>
                      {currency !== 'INR' && fp.priceAed > 0 && (
                        <div className="flex justify-between text-[#D4AF72] font-semibold text-[11px]">
                          <span>Approx. INR</span>
                          <span className="ltr-isolate">≈ {formatCurrency(fp.priceAed, 'INR')}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-[#A5A19A]">Availability</span>
                        <span className="font-semibold text-[#6EE7B7]">
                          {fp.availableCount !== null ? `${fp.availableCount} units` : 'Contact Developer'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenEnquiry('brochure', project)}
                        className="w-full mt-2.5 py-1.5 bg-[#D4AF72] text-[#080808] text-[11px] font-sans font-semibold hover:bg-[#E6C77A] transition-colors text-center"
                      >
                        Enquire Layout &amp; Availability
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#D4AF72]">
                  {formatPropertySpecsSummary(project)}
                </p>
                <p className="text-xs text-[#A5A19A] mt-1">
                  Individual floor plan layouts available via official developer brochure.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenEnquiry('brochure', project)}
                className="px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
              >
                Request Detailed Floor Plans
              </button>
            </div>
          )}
        </section>

        {/* Location Map & Nearby Landmarks + Developer Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <section className="lg:col-span-7 min-w-0 bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                  Verified Connectivity &amp; Proximity
                </p>
                <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mt-0.5">
                  Location &amp; Nearby Infrastructure
                </h2>
              </div>
              <a
                href={getGoogleMapsDirectionsUrl(project.coordinates, project.googleMapsUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#D4AF72] hover:underline flex items-center gap-1"
              >
                <span>Google Maps Directions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Location Verification & Area Search */}
            <form onSubmit={handleAreaSearch} className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#D4AF72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={areaSearch}
                  onChange={(e) => setAreaSearch(e.target.value)}
                  placeholder={`Check nearby landmark, metro, or address in ${project.emirate}...`}
                  className="w-full h-9 pl-9 pr-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
              <button
                type="submit"
                disabled={areaSearching || areaSearch.trim().length < 2}
                className="h-9 px-3.5 bg-[#1B1B1B] border border-[#D4AF72]/35 text-xs font-semibold text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {areaSearching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                <span>Locate Area</span>
              </button>
              {areaResult && (
                <button
                  type="button"
                  onClick={() => {
                    setAreaResult(null);
                    setAreaSearch('');
                    setMapFocusToken((n) => n + 1);
                  }}
                  className="h-9 px-2.5 border border-[#D4AF72]/25 text-xs text-[#A5A19A] hover:text-[#F5F1E8]"
                >
                  Reset Pin
                </button>
              )}
            </form>
            {areaError && <p className="text-[11px] text-[#FCA5A5] mb-2">{areaError}</p>}

            <div className="h-[280px] sm:h-[340px] lg:h-[380px] w-full border border-[#D4AF72]/25 bg-[#080808] mb-5 relative">
              {mapsLoading && !mapsApiKey ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-[#A5A19A]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D4AF72]" />
                  <span>Loading interactive property location map...</span>
                </div>
              ) : mapsApiKey && !mapErrorReason && isValidCoordinate(project.coordinates) ? (
                <APIProvider
                  key={`project-detail-map-${mapRetryToken}`}
                  apiKey={mapsApiKey}
                  libraries={['marker']}
                  language="en"
                  region="AE"
                >
                  <GoogleMapsGuard
                    loadingLabel={`Loading ${project.community} map tiles...`}
                    onStatusError={(reason) => setMapErrorReason(reason)}
                  >
                    <div className="w-full h-full relative">
                      <GoogleMap
                        defaultCenter={project.coordinates}
                        defaultZoom={14}
                        mapId="DEMO_MAP_ID"
                        colorScheme="DARK"
                        zoomControl={true}
                        mapTypeControl={true}
                        streetViewControl={true}
                        fullscreenControl={true}
                        gestureHandling="cooperative"
                        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <ProjectMapRecenter
                          target={
                            areaResult
                              ? { lat: areaResult.lat, lng: areaResult.lng }
                              : project.coordinates
                          }
                          zoom={areaResult ? 13 : 14}
                          token={mapFocusToken}
                        />
                        <ProjectPinWithPopup project={project} position={project.coordinates} />
                        {areaResult && (
                          <AdvancedMarker
                            position={{ lat: areaResult.lat, lng: areaResult.lng }}
                            title={areaResult.formattedAddress}
                            zIndex={500}
                          >
                            <div className="px-2.5 py-1 bg-[#F5F1E8] text-[#080808] text-[11px] font-semibold border border-[#D4AF72] shadow-lg whitespace-nowrap">
                              {areaResult.formattedAddress.split(',')[0]}
                            </div>
                          </AdvancedMarker>
                        )}
                      </GoogleMap>
                    </div>
                  </GoogleMapsGuard>
                </APIProvider>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#A5A19A] p-5 text-center bg-[#121212]">
                  {isValidCoordinate(project.coordinates) ? (
                    <>
                      <MapPin className="w-6 h-6 text-[#D4AF72] mb-2" />
                      <p className="font-semibold text-[#F5F1E8] ltr-isolate">
                        Verified GPS: {project.coordinates.lat.toFixed(5)}° N,{' '}
                        {project.coordinates.lng.toFixed(5)}° E
                      </p>
                      <p className="mt-1">
                        {formatCleanFullAddress(project)}
                      </p>
                      {mapErrorReason && (
                        <p className="text-[11px] text-[#FCA5A5] mt-2 max-w-sm">
                          {mapErrorReason === 'quota_exceeded'
                            ? 'Google Maps daily preview quota exceeded. Exact GPS directions remain active.'
                            : 'Unable to load Google Maps tiles for this view.'}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        {mapErrorReason && (
                          <button
                            type="button"
                            onClick={() => {
                              setMapErrorReason(null);
                              setMapRetryToken((n) => n + 1);
                              onRetryMapsConfig?.();
                            }}
                            className="px-3.5 py-2 border border-[#D4AF72]/40 text-xs font-semibold text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Retry Live Map</span>
                          </button>
                        )}
                        <a
                          href={getGoogleMapsDirectionsUrl(
                            project.coordinates,
                            project.googleMapsUrl
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] inline-flex items-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Open in Google Maps</span>
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-6 h-6 text-[#FCD34D] mb-2" />
                      <p className="font-semibold text-[#F5F1E8]">
                        Exact GPS coordinates are pending verification for this record
                      </p>
                      <p className="mt-1">
                        Community: {formatCleanFullAddress(project)}
                      </p>
                      {areaResult ? (
                        <p className="text-[#6EE7B7] font-mono-tabular mt-2">
                          Geocoded Search Result: {areaResult.formattedAddress} ({areaResult.lat.toFixed(5)},{' '}
                          {areaResult.lng.toFixed(5)})
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#A5A19A] mt-2">
                          Use the &ldquo;Locate Area&rdquo; search bar above to resolve exact coordinates.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {project.nearbyLandmarks.map((lm) => {
                const getIcon = () => {
                  switch (lm.category) {
                    case 'metro':
                      return <Train className="w-4 h-4 text-[#D4AF72]" />;
                    case 'school':
                      return <GraduationCap className="w-4 h-4 text-[#6EE7B7]" />;
                    case 'hospital':
                      return <HeartPulse className="w-4 h-4 text-[#F87171]" />;
                    case 'mall':
                      return <ShoppingBag className="w-4 h-4 text-[#93C5FD]" />;
                    default:
                      return <Landmark className="w-4 h-4 text-[#D4AF72]" />;
                  }
                };

                return (
                  <div
                    key={lm.name}
                    className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <div className="mt-0.5 shrink-0">{getIcon()}</div>
                      <div className="min-w-0">
                        <span className="uppercase text-[10px] font-semibold text-[#D4AF72] block">
                          {lm.category}
                        </span>
                        <p className="font-semibold text-[#F5F1E8] mt-0.5 truncate">{lm.name}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono-tabular text-[#A5A19A] shrink-0">
                      <span className="block font-semibold text-[#F5F1E8]">{lm.distanceKm} km</span>
                      <span>{lm.travelTimeMin} min</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Developer Profile */}
          <section className="lg:col-span-5 min-w-0 bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6 lg:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                Verified Master Developer
              </p>
              <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mt-1">
                {developer?.name || project.developerName}
              </h2>
              {developer && (
                <>
                  <p className="text-xs font-mono-tabular text-[#A5A19A] mt-1">
                    Reg: {developer.registrationId} · Est. {developer.foundedYear}
                  </p>
                  <p className="text-sm text-[#A5A19A] leading-relaxed mt-4">
                    {developer.history}
                  </p>
                  <div className="grid grid-cols-2 gap-3 my-5 py-4 border-y border-[#D4AF72]/20 text-xs font-mono-tabular">
                    <div>
                      <span className="text-[#A5A19A] block">Completed Projects</span>
                      <span className="text-lg font-semibold text-[#F5F1E8]">
                        {developer.completedProjects}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#A5A19A] block">Active Developments</span>
                      <span className="text-lg font-semibold text-[#F5F1E8]">
                        {developer.activeProjects}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs space-y-2 text-[#A5A19A]">
                    <div>
                      <span className="font-semibold text-[#F5F1E8] block">
                        Sales Office &amp; Experience Gallery:
                      </span>
                      <span className="text-xs text-[#A5A19A]">
                        {developer.salesOfficeAddress ||
                          project.salesOfficeAddress ||
                          'Dubai Corporate Gallery'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {(() => {
                        const hotline =
                          developer.salesOfficePhone ||
                          project.salesOfficePhone ||
                          companyInfo.primaryPhone;
                        const whatsapp =
                          developer.salesOfficeWhatsapp ||
                          project.salesOfficeWhatsapp ||
                          companyInfo.whatsappNumber;
                        return (
                          <>
                            <p>
                              Official Hotline:{' '}
                              <a
                                href={`tel:${hotline.replace(/\s+/g, '')}`}
                                className="text-[#F5F1E8] font-semibold font-mono-tabular ltr-isolate hover:text-[#D4AF72]"
                              >
                                {hotline}
                              </a>
                            </p>
                            <p>
                              WhatsApp:{' '}
                              <a
                                href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#6EE7B7] font-semibold font-mono-tabular ltr-isolate hover:underline"
                              >
                                {whatsapp}
                              </a>
                            </p>
                          </>
                        );
                      })()}
                    </div>
                    <div className="pt-1">
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#D4AF72] hover:underline font-semibold"
                      >
                        <span>Official Developer Portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>

            {otherDeveloperProjects.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#D4AF72]/20">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
                  Other Projects by {project.developerName}
                </h3>
                <div className="space-y-2">
                  {otherDeveloperProjects.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => onSelectProject(op)}
                      className="w-full text-left p-3 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] flex items-center justify-between text-xs transition-colors"
                    >
                      <span className="font-semibold text-[#F5F1E8]">{op.name}</span>
                      <span className="font-mono-tabular text-[#D4AF72]">
                        {formatProjectPrice(op.startingPriceAed, currency, true)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Historical Area Price Trends & Comparables */}
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div className="lg:col-span-7 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                Historical Transaction Benchmark
              </p>
              <h2 className="font-display text-xl sm:text-2xl font-medium text-[#F5F1E8] mt-0.5">
                {project.community} Price / sq ft Trajectory
              </h2>
              <p className="text-xs text-[#A5A19A] mt-1 mb-4">
                Source: {project.investment.dataCitation}
              </p>
              {project.investment.historicalTransactions.length > 0 ? (
                <div className="h-56 sm:h-60 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={project.investment.historicalTransactions}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 114, 0.14)" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: '#A5A19A' }} />
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
                          'Avg Price',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgPricePerSqFtAed"
                        stroke="#D4AF72"
                        fill="#D4AF72"
                        fillOpacity={0.22}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 border border-[#D4AF72]/20 bg-[#1B1B1B] flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-xs font-semibold text-[#F5F1E8]">
                    Historical DLD / ADM Transaction Series Available on Request
                  </p>
                  <p className="text-xs text-[#A5A19A] mt-1 max-w-md">
                    Request recent registered sale comparables and service-charge benchmarks for{' '}
                    {project.community}.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 min-w-0 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
                  Estimated Investment Indicators &amp; Service Charges
                </h3>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 mb-6 font-mono-tabular">
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">
                      Est. Gross Yield
                    </span>
                    <span className="text-xl font-semibold text-[#6EE7B7]">
                      {project.investment.grossYieldPct != null
                        ? `${project.investment.grossYieldPct}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">Est. Net Yield</span>
                    <span className="text-xl font-semibold text-[#D4AF72]">
                      {project.investment.netYieldPct != null
                        ? `${project.investment.netYieldPct}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">
                      Service Charge / sq ft
                    </span>
                    <span className="text-lg font-semibold text-[#F5F1E8]">
                      {project.investment.serviceChargePerSqFtAed != null
                        ? `AED ${project.investment.serviceChargePerSqFtAed}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">5-Yr Area Growth</span>
                    <span className="text-lg font-semibold text-[#F5F1E8]">
                      {project.investment.priceTrend5YrPct != null
                        ? `+${project.investment.priceTrend5YrPct}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {comparableProjects.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-2">
                    Comparable UAE Developments
                  </h3>
                  <div className="space-y-2">
                    {comparableProjects.slice(0, 3).map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => onSelectProject(comp)}
                        className="w-full text-left p-3 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] flex items-center justify-between gap-2 text-xs transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-[#F5F1E8] block truncate">
                            {comp.name}
                          </span>
                          <span className="text-[#A5A19A] block truncate">
                            {formatCleanLocation(comp.community, comp.emirate)}
                          </span>
                          <span className="text-[11px] text-[#D4AF72]/90 block truncate mt-0.5 ltr-isolate">
                            {formatPropertySpecsSummary(comp)}
                          </span>
                        </div>
                        <span className="font-mono-tabular ltr-isolate font-semibold text-[#D4AF72] shrink-0">
                          {formatProjectPrice(comp.startingPriceAed, currency, true)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Embedded Investment Calculator pre-loaded with project pricing */}
        <InvestmentCalculator
          currency={currency}
          initialPriceAed={project.startingPriceAed > 0 ? project.startingPriceAed : 2500000}
          initialServiceChargePerSqFt={project.investment.serviceChargePerSqFtAed || 18}
          initialSizeSqFt={project.minSizeSqFt > 0 ? project.minSizeSqFt : 1050}
          initialGrossYieldPct={project.investment.grossYieldPct || 6.8}
          projectName={project.name}
        />
      </div>
    </div>
  );
};
