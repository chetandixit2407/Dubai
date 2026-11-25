import React, { useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
} from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  Calendar,
  Camera,
  Compass,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GitCompare,
  GraduationCap,
  HeartPulse,
  Landmark,
  Layers,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
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
import { InvestmentCalculator } from './InvestmentCalculator.tsx';

interface ProjectDetailsPageProps {
  project: Project;
  developer?: Developer;
  otherDeveloperProjects: Project[];
  comparableProjects: Project[];
  inventoryLogs: InventoryLog[];
  mapsApiKey: string;
  currency: CurrencyCode;
  language: Language;
  isSaved: boolean;
  isCompared: boolean;
  onBack: () => void;
  onSelectProject: (project: Project) => void;
  onToggleSave: (project: Project) => void;
  onToggleCompare: (project: Project) => void;
  onOpenVirtualTour: (project: Project) => void;
  onOpenEnquiry: (type: EnquiryType, project: Project) => void;
  onRefreshInventory: (project: Project) => Promise<void>;
}

export const ProjectDetailsPage: React.FC<ProjectDetailsPageProps> = ({
  project,
  developer,
  otherDeveloperProjects,
  comparableProjects,
  inventoryLogs,
  mapsApiKey,
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
}) => {
  const [activePhoto, setActivePhoto] = useState(project.heroImage);
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<MediaCategory | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [selectedVideoId, setSelectedVideoId] = useState<string>(
    () => project.primaryVideo?.id || project.videoItems?.[0]?.id || ''
  );

  React.useEffect(() => {
    setActivePhoto(project.heroImage);
    setMediaCategoryFilter('all');
    setSelectedVideoId(project.primaryVideo?.id || project.videoItems?.[0]?.id || '');
  }, [project.id, project.heroImage, project.primaryVideo?.id]);

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

  const filteredMedia = React.useMemo(
    () =>
      mediaCategoryFilter === 'all'
        ? projectMediaList
        : projectMediaList.filter((m) => m.category === mediaCategoryFilter),
    [projectMediaList, mediaCategoryFilter]
  );

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

  const handleCopyShare = () => {
    const shareUrl = `${window.location.origin}/#project/${project.slug}`;
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${project.name} (${project.community}, ${project.emirate}) — ${formatProjectPrice(
      project.startingPriceAed,
      currency
    )} via WHITE COLLAR REALTY: ${window.location.origin}/#project/${project.slug}`
  )}`;

  const emailShareUrl = `mailto:?subject=${encodeURIComponent(
    `WHITE COLLAR REALTY Dossier: ${project.name}`
  )}&body=${encodeURIComponent(
    `Explore ${project.name} by ${project.developerName} in ${project.community}, ${project.emirate}.\nStarting Price: ${formatProjectPrice(
      project.startingPriceAed,
      currency
    )}\nLink: ${window.location.origin}/#project/${project.slug}`
  )}`;

  return (
    <div className="bg-[#080808] text-[#F5F1E8] min-h-screen pb-24">
      {/* Top Breadcrumb Bar */}
      <div className="bg-[#121212] border-b border-[#D4AF72]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-[#F5F1E8] hover:text-[#D4AF72] flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#D4AF72]" />
            <span>Back to All UAE Projects</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleSave(project)}
              className={`h-9 px-3.5 border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isSaved
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                  : 'bg-[#1B1B1B] border-[#D4AF72]/25 text-[#F5F1E8] hover:border-[#D4AF72]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save Favourite'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleCompare(project)}
              className={`h-9 px-3.5 border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isCompared
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                  : 'bg-[#1B1B1B] border-[#D4AF72]/25 text-[#F5F1E8] hover:border-[#D4AF72]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#34D399] flex items-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#6EE7B7]" />
              <span>Share WhatsApp</span>
            </a>

            <a
              href={emailShareUrl}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-[#D4AF72]" />
              <span>Email</span>
            </a>

            <button
              type="button"
              onClick={() => exportSingleProjectToExcel(project, developer)}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#34D399] flex items-center gap-1.5 transition-colors"
              title="Download detailed Excel spreadsheet dossier"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#6EE7B7]" />
              <span>Export Excel</span>
            </button>

            <a
              href={
                project.brochureUrl ||
                `/api/projects/${encodeURIComponent(project.slug)}/brochure`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors"
              title="Download / Print Institutional PDF Dossier"
            >
              <Download className="w-3.5 h-3.5 text-[#D4AF72]" />
              <span>PDF Dossier</span>
            </a>

            <button
              type="button"
              onClick={handleCopyShare}
              className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-[#D4AF72]" />
              <span>{copiedLink ? 'Link Copied' : 'Copy URL'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        {/* Project Header & Hero Media Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="relative aspect-[16/10] w-full bg-[#121212] border border-[#D4AF72]/25 overflow-hidden">
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt={activeMedia?.caption || project.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#121212] text-[#F5F1E8] p-8 text-center">
                  <Camera className="w-10 h-10 text-[#D4AF72] mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72]">
                    PROJECT PHOTOGRAPHS NOT AVAILABLE
                  </p>
                  <p className="font-display text-2xl font-medium mt-2">{displayName}</p>
                  <p className="text-xs text-[#A5A19A] max-w-md mt-2 leading-relaxed">
                    White Collar Realty never substitutes photos from other developments. Official
                    site photographs or developer media for this project are pending verification.
                  </p>
                </div>
              )}
              {activeMedia && (
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#080808]/90 border border-[#D4AF72]/30 text-[#F5F1E8] text-[11px] font-semibold">
                  {MEDIA_CLASSIFICATION_LABELS[activeMedia.classification]} ·{' '}
                  {MEDIA_CATEGORY_LABELS[activeMedia.category]}
                </div>
              )}
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                {effectiveTourStatus === '360_available' ||
                effectiveTourStatus === '3d_available' ? (
                  <button
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="px-4 py-2.5 bg-[#080808]/95 text-[#F5F1E8] text-xs font-semibold hover:bg-[#D4AF72] hover:text-[#080808] transition-colors flex items-center gap-2 border border-[#D4AF72] shadow-lg cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-[#D4AF72] group-hover:text-current" />
                    <span>EXPLORE 3D VIRTUAL TOUR</span>
                    {(project.virtualTour.tours || []).length > 1 && (
                      <span className="bg-[#D4AF72] text-[#080808] text-[10px] px-1.5 py-0.5 font-mono-tabular">
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
                    className="px-4 py-2.5 bg-[#064E3B]/95 text-[#ECFDF5] text-xs font-semibold hover:bg-[#047857] transition-colors flex items-center gap-2 border border-[#34D399]/50 shadow-lg cursor-pointer"
                  >
                    <Video className="w-4 h-4 text-[#6EE7B7]" />
                    <span>WATCH VIDEO WALKTHROUGH</span>
                    {(project.videoItems || []).length > 1 && (
                      <span className="bg-[#080808] text-[#F5F1E8] text-[10px] px-1.5 py-0.5 font-mono-tabular">
                        {(project.videoItems || []).length} Videos
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-[#080808]/90 backdrop-blur-sm p-1.5 border border-[#D4AF72]/30">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF72] px-2">
                      MEDIA NOT AVAILABLE
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenEnquiry('virtual_consultation', project)}
                      className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-[11px] font-semibold hover:bg-[#E6C77A] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
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
              <div className="grid grid-cols-4 gap-3">
                {projectMediaList.slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePhoto(item.url)}
                    className={`relative aspect-[16/10] overflow-hidden border transition-colors ${
                      activePhoto === item.url
                        ? 'border-[#D4AF72] ring-1 ring-[#D4AF72]'
                        : 'border-[#D4AF72]/20 hover:border-[#D4AF72]/60'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.caption}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-[#080808]/85 text-[#F5F1E8] text-[10px] px-1.5 py-0.5 truncate text-left">
                      {MEDIA_CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Summary Dossier */}
          <div className="lg:col-span-5 bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8 flex flex-col justify-between">
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
                  {new Date(project.lastVerifiedAt || project.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-medium text-[#F5F1E8] leading-tight">
                {displayName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#A5A19A] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#D4AF72] shrink-0" />
                  <span>
                    {project.fullAddress ||
                      `${project.buildingName}, ${project.neighbourhood}, ${project.community}, ${project.emirate}`}
                  </span>
                </p>
                <a
                  href={
                    project.googleMapsUrl ||
                    `https://www.google.com/maps/search/?api=1&query=${project.coordinates.lat},${project.coordinates.lng}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#D4AF72] hover:underline flex items-center gap-1"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 my-6 py-5 border-y border-[#D4AF72]/20">
                <div>
                  <p className="text-xs text-[#A5A19A]">Starting Price</p>
                  <p className="font-mono-tabular text-xl font-semibold text-[#F5F1E8] mt-0.5">
                    {formatProjectPrice(project.startingPriceAed, currency)}
                  </p>
                  {currency !== 'INR' && project.startingPriceAed > 0 && (
                    <p
                      className="text-xs font-mono-tabular text-[#D4AF72] font-semibold mt-0.5"
                      title={formatInrTimestampNote()}
                    >
                      ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                    </p>
                  )}
                  {currency === 'INR' && project.startingPriceAed > 0 && (
                    <p
                      className="text-xs font-mono-tabular text-[#D4AF72] font-semibold mt-0.5"
                      title={formatInrTimestampNote()}
                    >
                      ≈ AED {project.startingPriceAed.toLocaleString()}
                    </p>
                  )}
                  <p className="text-[10px] text-[#A5A19A] mt-0.5">{formatInrTimestampNote()}</p>
                  <p className="text-[11px] font-mono-tabular text-[#A5A19A] mt-1">
                    {project.maxPriceAed > 0
                      ? `Up to ${formatProjectPrice(project.maxPriceAed, currency)}`
                      : 'Official developer pricing sheet on request'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#A5A19A]">Booking Amount / Down Payment</p>
                  <p className="font-mono-tabular text-xl font-semibold text-[#6EE7B7] mt-0.5">
                    {project.bookingAmountAed
                      ? formatProjectPrice(project.bookingAmountAed, currency)
                      : `${project.downPaymentPct || 10}%`}
                  </p>
                  {currency !== 'INR' &&
                    project.bookingAmountAed &&
                    project.bookingAmountAed > 0 && (
                      <p className="text-xs font-mono-tabular text-[#D4AF72] font-semibold mt-0.5">
                        ≈ {formatCurrency(project.bookingAmountAed, 'INR')}
                      </p>
                    )}
                  <p className="text-[11px] text-[#A5A19A] mt-1">
                    {project.downPaymentPct || 10}% initial booking allocation
                  </p>
                </div>
              </div>

              {/* Key Project Specs Grid */}
              <dl className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <dt className="text-[#A5A19A]">Master Developer</dt>
                  <dd className="font-semibold text-[#F5F1E8] mt-0.5 flex items-center gap-1">
                    <span>{project.developerName}</span>
                    {developer?.website && (
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#D4AF72] hover:text-[#E6C77A]"
                        title="Official Developer Website"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">RERA Registration No.</dt>
                  <dd className="font-mono-tabular font-semibold text-[#F5F1E8] mt-0.5">
                    {project.registrationNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Construction Progress</dt>
                  <dd className="font-mono-tabular font-semibold text-[#F5F1E8] mt-0.5">
                    {project.constructionPct}% ({project.status})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Expected Handover</dt>
                  <dd className="font-mono-tabular font-semibold text-[#F5F1E8] mt-0.5">
                    {project.handoverDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Unit Configurations</dt>
                  <dd className="font-semibold text-[#F5F1E8] mt-0.5">
                    {project.propertyTypes.slice(0, 3).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Bathrooms</dt>
                  <dd className="font-semibold text-[#F5F1E8] mt-0.5">
                    {project.bathrooms || '1 - 3 Bathrooms'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Estimated Rental ROI</dt>
                  <dd className="font-mono-tabular font-semibold text-[#6EE7B7] mt-0.5">
                    {project.investment.grossYieldPct
                      ? `${project.investment.grossYieldPct}% Est. Gross / ${project.investment.netYieldPct}% Est. Net`
                      : 'Estimate on request'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Payment Plan</dt>
                  <dd className="font-medium text-[#F5F1E8] mt-0.5">{project.paymentPlan}</dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Developer Sales Office</dt>
                  <dd className="text-[#F5F1E8] mt-0.5 text-[11px] leading-tight">
                    {project.salesOfficeAddress ||
                      developer?.salesOfficeAddress ||
                      'Dubai Corporate Sales Gallery'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#A5A19A]">Verified Sales Hotline</dt>
                  <dd className="text-[#F5F1E8] font-semibold mt-0.5">
                    <a
                      href={`tel:${project.salesOfficePhone || developer?.salesOfficePhone || '+918810286629'}`}
                      className="hover:text-[#D4AF72] transition-colors"
                    >
                      {project.salesOfficePhone ||
                        developer?.salesOfficePhone ||
                        '+91 88102 86629'}
                    </a>
                  </dd>
                </div>
                {project.projectUrl && (
                  <div className="col-span-2 pt-2 border-t border-[#D4AF72]/15">
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
            <div className="mt-6 pt-6 border-t border-[#D4AF72]/20 grid grid-cols-2 gap-2.5">
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
                          <img
                            src={vItem.thumbnailUrl}
                            alt={vItem.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-24 aspect-video object-cover bg-[#080808] shrink-0 border border-[#D4AF72]/20"
                          />
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
                  {activeVideo?.thumbnailUrl && (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt={activeVideo.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
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
                      {activeVideo?.viewCount && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{activeVideo.viewCount}</span>
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
                    <img
                      src={item.url}
                      alt={item.caption}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#080808]/90 border border-[#D4AF72]/25 text-[#F5F1E8] text-[10px] font-semibold">
                      {MEDIA_CLASSIFICATION_LABELS[item.classification]}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#D4AF72]">
                      <span>{MEDIA_CATEGORY_LABELS[item.category]}</span>
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
              {project.masterPlanNotes}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
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
            <div className="mt-6 bg-[#1B1B1B] border border-[#D4AF72]/20 p-6">
              <h3 className="text-base font-semibold text-[#F5F1E8]">
                Inventory update unavailable — Contact for latest availability
              </h3>
              <p className="text-xs text-[#A5A19A] mt-1.5 leading-relaxed">
                {inv.totalRegisteredUnits
                  ? `Official registry records ${inv.totalRegisteredUnits} registered units in this project, however live unit-by-unit sales inventory is not published by an automated feed for this developer.`
                  : 'Live unit-by-unit sales inventory is not connected for this project.'}{' '}
                Source: {inv.dataSource}.
              </p>
              <button
                type="button"
                onClick={() => onOpenEnquiry('callback', project)}
                className="mt-4 px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
              >
                Request Verified Developer Availability Sheet
              </button>
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
              {project.floorPlans.map((fp) => (
                <div
                  key={fp.id}
                  className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-4 flex flex-col justify-between hover:border-[#D4AF72] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#D4AF72]">{fp.bedrooms}</p>
                      {fp.bathrooms && (
                        <span className="text-[11px] text-[#F5F1E8] font-medium bg-[#121212] px-2 py-0.5 border border-[#D4AF72]/20">
                          {fp.bathrooms}
                        </span>
                      )}
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
                      <span className="text-[#A5A19A]">Size</span>
                      <span className="font-semibold text-[#F5F1E8]">
                        {fp.sizeSqFt.toLocaleString()} sq.ft
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A5A19A]">Starting Price</span>
                      <span className="font-semibold text-[#F5F1E8]">
                        {formatProjectPrice(fp.priceAed, currency)}
                      </span>
                    </div>
                    {currency !== 'INR' && fp.priceAed > 0 && (
                      <div className="flex justify-between text-[#D4AF72] font-semibold text-[11px]">
                        <span>Approx. INR</span>
                        <span>≈ {formatCurrency(fp.priceAed, 'INR')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#A5A19A]">Availability</span>
                      <span className="font-semibold text-[#6EE7B7]">
                        {fp.availableCount !== null ? `${fp.availableCount} units` : 'On Request'}
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
              ))}
            </div>
          ) : (
            <div className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#D4AF72]">
                  {project.propertyTypes.join(' · ')}
                </p>
                <p className="text-xs text-[#A5A19A] mt-1 font-mono-tabular">
                  {project.minSizeSqFt > 0
                    ? `Unit Sizes: ${project.minSizeSqFt.toLocaleString()} – ${project.maxSizeSqFt.toLocaleString()} sq.ft`
                    : 'Unit sizes & individual floor plan layouts available via official developer brochure.'}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                  Verified Connectivity &amp; Proximity
                </p>
                <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mt-0.5">
                  Location &amp; Nearby Infrastructure
                </h2>
              </div>
              <a
                href={
                  project.googleMapsUrl ||
                  `https://www.google.com/maps/dir/?api=1&destination=${project.coordinates.lat},${project.coordinates.lng}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#D4AF72] hover:underline flex items-center gap-1"
              >
                <span>Google Maps Directions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="h-64 w-full border border-[#D4AF72]/25 bg-[#080808] mb-5">
              {mapsApiKey ? (
                <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="AE">
                  <GoogleMap
                    defaultCenter={project.coordinates}
                    defaultZoom={13}
                    mapId="DEMO_MAP_ID"
                    colorScheme="DARK"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <AdvancedMarker position={project.coordinates} title={project.name}>
                      <div className="px-2.5 py-1 bg-[#080808] text-[#F5F1E8] text-xs font-semibold border border-[#D4AF72]">
                        {project.name}
                      </div>
                    </AdvancedMarker>
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#A5A19A] p-4 text-center">
                  <MapPin className="w-6 h-6 text-[#D4AF72] mb-2" />
                  <p className="font-semibold text-[#F5F1E8]">
                    Coordinates: {project.coordinates.lat.toFixed(4)}° N,{' '}
                    {project.coordinates.lng.toFixed(4)}° E
                  </p>
                  <p className="mt-1">
                    {project.fullAddress || `${project.community}, ${project.emirate}`}
                  </p>
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
          <section className="lg:col-span-5 bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8 flex flex-col justify-between">
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
                      <p>
                        Official Hotline:{' '}
                        <a
                          href={`tel:${developer.salesOfficePhone || project.salesOfficePhone || '+918810286629'}`}
                          className="text-[#F5F1E8] font-semibold hover:text-[#D4AF72]"
                        >
                          {developer.salesOfficePhone ||
                            project.salesOfficePhone ||
                            '+91 88102 86629'}
                        </a>
                      </p>
                      <p>
                        WhatsApp:{' '}
                        <a
                          href={`https://wa.me/${(developer.salesOfficeWhatsapp || project.salesOfficeWhatsapp || '918810286629').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6EE7B7] font-semibold hover:underline"
                        >
                          {developer.salesOfficeWhatsapp ||
                            project.salesOfficeWhatsapp ||
                            '+91 88102 86629'}
                        </a>
                      </p>
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
        <section className="bg-[#121212] border border-[#D4AF72]/25 p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                Historical Transaction Benchmark
              </p>
              <h2 className="font-display text-2xl font-medium text-[#F5F1E8] mt-0.5">
                {project.community} Price / Sq.Ft Trajectory
              </h2>
              <p className="text-xs text-[#A5A19A] mt-1 mb-4">
                Source: {project.investment.dataCitation}
              </p>
              {project.investment.historicalTransactions.length > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={project.investment.historicalTransactions}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 114, 0.14)" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#A5A19A' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#A5A19A' }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#121212',
                          borderColor: 'rgba(212, 175, 114, 0.45)',
                          color: '#F5F1E8',
                          fontSize: '12px',
                        }}
                        formatter={(value: unknown) => [
                          `AED ${Number(value).toLocaleString()} / sq.ft`,
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

            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] mb-3">
                  Estimated Investment Indicators &amp; Service Charges
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6 font-mono-tabular">
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">
                      Est. Gross Yield
                    </span>
                    <span className="text-xl font-semibold text-[#6EE7B7]">
                      {project.investment.grossYieldPct ?? 'N/A'}%
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">Est. Net Yield</span>
                    <span className="text-xl font-semibold text-[#D4AF72]">
                      {project.investment.netYieldPct ?? 'N/A'}%
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">
                      Service Charge / Sq.Ft
                    </span>
                    <span className="text-lg font-semibold text-[#F5F1E8]">
                      AED {project.investment.serviceChargePerSqFtAed ?? 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5">
                    <span className="text-xs font-sans text-[#A5A19A] block">5-Yr Area Growth</span>
                    <span className="text-lg font-semibold text-[#F5F1E8]">
                      +{project.investment.priceTrend5YrPct ?? 0}%
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
                        className="w-full text-left p-3 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-[#F5F1E8] block">{comp.name}</span>
                          <span className="text-[#A5A19A]">
                            {comp.community}, {comp.emirate}
                          </span>
                        </div>
                        <span className="font-mono-tabular font-semibold text-[#D4AF72]">
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
