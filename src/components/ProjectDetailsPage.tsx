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
  Building2,
  Calendar,
  Camera,
  Check,
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
  Printer,
  RefreshCw,
  Share2,
  ShieldCheck,
  ShoppingBag,
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
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import {
  getEffectiveTourStatus,
  MEDIA_CATEGORY_LABELS,
  MEDIA_CLASSIFICATION_LABELS,
  TOUR_STATUS_LABELS,
} from '../utils/mediaValidation.ts';
import { COMPANY_INFO } from '../data/companyInfo.ts';
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

  React.useEffect(() => {
    setActivePhoto(project.heroImage);
    setMediaCategoryFilter('all');
  }, [project.id, project.heroImage]);

  const displayName = language === 'ar' && project.nameAr ? project.nameAr : project.name;
  const displayDesc =
    language === 'ar' && project.descriptionAr ? project.descriptionAr : project.description;

  const effectiveTourStatus = getEffectiveTourStatus(project);

  const projectMediaList: ProjectMediaItem[] = React.useMemo(() => {
    const owned = (project.mediaItems || []).filter((m) => m.projectId === project.id && Boolean(m.url));
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
    <div className="bg-[#FAF9F6] min-h-screen pb-20">
      {/* Top Breadcrumb Bar */}
      <div className="bg-white border-b border-[#E5E2DC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-[#111827] hover:text-[#9A7B3C] flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All UAE Projects</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleSave(project)}
              className={`h-9 px-3.5 border text-xs font-medium flex items-center gap-1.5 ${
                isSaved
                  ? 'bg-[#111827] text-[#E6C77A] border-[#111827]'
                  : 'bg-white border-[#E5E2DC] text-[#111827] hover:border-[#9A7B3C]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save Favourite'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleCompare(project)}
              className={`h-9 px-3.5 border text-xs font-medium flex items-center gap-1.5 ${
                isCompared
                  ? 'bg-[#9A7B3C] text-white border-[#9A7B3C]'
                  : 'bg-white border-[#E5E2DC] text-[#111827] hover:border-[#9A7B3C]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>{isCompared ? 'In Comparison' : 'Compare'}</span>
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[#047857]" />
              <span>Share WhatsApp</span>
            </a>

            <a
              href={emailShareUrl}
              className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>

            <button
              type="button"
              onClick={() => exportSingleProjectToExcel(project, developer)}
              className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5"
              title="Download detailed Excel spreadsheet dossier"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#047857]" />
              <span>Export Excel</span>
            </button>

            <a
              href={project.brochureUrl || `/api/projects/${encodeURIComponent(project.slug)}/brochure`}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5"
              title="Download / Print Institutional PDF Dossier"
            >
              <Download className="w-3.5 h-3.5 text-[#9A7B3C]" />
              <span>PDF Dossier</span>
            </a>

            <button
              type="button"
              onClick={handleCopyShare}
              className="h-9 px-3 border border-[#E5E2DC] bg-white text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
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
            <div className="relative aspect-[16/10] w-full bg-[#EFECE6] border border-[#E5E2DC] overflow-hidden">
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt={activeMedia?.caption || project.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#181D27] text-white p-8 text-center">
                  <Camera className="w-10 h-10 text-[#E6C77A] mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E6C77A]">
                    PROJECT PHOTOGRAPHS NOT AVAILABLE
                  </p>
                  <p className="font-display text-2xl font-semibold mt-2">{displayName}</p>
                  <p className="text-xs text-white/70 max-w-md mt-2 leading-relaxed">
                    White Collar Realty never substitutes photos from other developments. Official site photographs or developer media for this project are pending verification.
                  </p>
                </div>
              )}
              {activeMedia && (
                <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#111827]/90 text-white text-[11px] font-semibold">
                  {MEDIA_CLASSIFICATION_LABELS[activeMedia.classification]} ·{' '}
                  {MEDIA_CATEGORY_LABELS[activeMedia.category]}
                </div>
              )}
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                {effectiveTourStatus !== 'coming_soon' ? (
                  <button
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="px-4 py-2.5 bg-[#111827]/95 text-white text-xs font-semibold hover:bg-[#9A7B3C] transition-colors flex items-center gap-2 border border-[#E6C77A]/50 shadow-lg cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-[#E6C77A]" />
                    <span>EXPLORE 360° VIRTUAL TOUR</span>
                    {(project.virtualTour.tours || []).length > 1 && (
                      <span className="bg-[#9A7B3C] text-white text-[10px] px-1.5 py-0.5 font-mono">
                        {(project.virtualTour.tours || []).length} Tours
                      </span>
                    )}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-black/85 backdrop-blur-sm p-1.5 border border-white/20">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E6C77A] px-2">
                      360° TOUR NOT AVAILABLE
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenEnquiry('virtual_consultation', project)}
                      className="px-3 py-1.5 bg-[#9A7B3C] text-white text-[11px] font-semibold hover:bg-[#7D622D] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Request Tour</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {activeMedia ? (
              <div className="bg-white border border-[#E5E2DC] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563]">
                <span>
                  <strong className="text-[#111827]">{activeMedia.caption}</strong>
                </span>
                <span className="text-[11px] text-[#6B7280]">
                  Source: {activeMedia.sourceName} ·{' '}
                  {activeMedia.verifiedProjectSpecific
                    ? 'Verified Project Asset'
                    : 'Awaiting Official Photo Verification'}
                </span>
              </div>
            ) : (
              <div className="bg-white border border-[#E5E2DC] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563]">
                <span className="font-semibold text-[#111827]">
                  PROJECT PHOTOGRAPHS NOT AVAILABLE
                </span>
                <span className="text-[11px] text-[#6B7280]">
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
                    className={`relative aspect-[16/10] overflow-hidden border ${
                      activePhoto === item.url
                        ? 'border-[#9A7B3C] ring-1 ring-[#9A7B3C]'
                        : 'border-[#E5E2DC]'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5 truncate text-left">
                      {MEDIA_CATEGORY_LABELS[item.category]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Summary Dossier */}
          <div className="lg:col-span-5 bg-white border border-[#E5E2DC] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563] mb-2">
                <span className="font-semibold text-[#9A7B3C]">{project.category}</span>
                <span aria-hidden="true">·</span>
                <span>{project.emirate}</span>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1 text-[#047857] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {project.verified ? 'Verified Registry' : 'Pending Verification'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[11px] text-[#6B7280]">
                  Verified {new Date(project.lastVerifiedAt || project.updatedAt).toLocaleDateString()}
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111827] leading-tight">
                {displayName}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#4B5563] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#9A7B3C] shrink-0" />
                  <span>
                    {project.fullAddress || `${project.buildingName}, ${project.neighbourhood}, ${project.community}, ${project.emirate}`}
                  </span>
                </p>
                <a
                  href={project.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${project.coordinates.lat},${project.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#9A7B3C] hover:underline flex items-center gap-1"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 my-6 py-5 border-y border-[#E5E2DC]">
                <div>
                  <p className="text-xs text-[#6B7280]">Starting Price</p>
                  <p className="font-mono-tabular text-xl font-semibold text-[#111827] mt-0.5">
                    {formatProjectPrice(project.startingPriceAed, currency)}
                  </p>
                  {currency !== 'INR' && project.startingPriceAed > 0 && (
                    <p className="text-xs font-mono-tabular text-[#9A7B3C] font-semibold mt-0.5">
                      ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                    </p>
                  )}
                  {currency === 'INR' && project.startingPriceAed > 0 && (
                    <p className="text-xs font-mono-tabular text-[#9A7B3C] font-semibold mt-0.5">
                      ≈ AED {project.startingPriceAed.toLocaleString()}
                    </p>
                  )}
                  <p className="text-[11px] font-mono-tabular text-[#6B7280] mt-1">
                    {project.maxPriceAed > 0
                      ? `Up to ${formatProjectPrice(project.maxPriceAed, currency)}`
                      : 'Official developer pricing sheet on request'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6B7280]">Booking Amount / Down Payment</p>
                  <p className="font-mono-tabular text-xl font-semibold text-[#047857] mt-0.5">
                    {project.bookingAmountAed
                      ? formatProjectPrice(project.bookingAmountAed, currency)
                      : `${project.downPaymentPct || 10}%`}
                  </p>
                  {currency !== 'INR' && project.bookingAmountAed && project.bookingAmountAed > 0 && (
                    <p className="text-xs font-mono-tabular text-[#9A7B3C] font-semibold mt-0.5">
                      ≈ {formatCurrency(project.bookingAmountAed, 'INR')}
                    </p>
                  )}
                  <p className="text-[11px] text-[#4B5563] mt-1">
                    {project.downPaymentPct || 10}% initial booking allocation
                  </p>
                </div>
              </div>

              {/* Key Project Specs Grid */}
              <dl className="grid grid-cols-2 gap-y-3.5 gap-x-4 text-xs">
                <div>
                  <dt className="text-[#6B7280]">Master Developer</dt>
                  <dd className="font-semibold text-[#111827] mt-0.5 flex items-center gap-1">
                    <span>{project.developerName}</span>
                    {developer?.website && (
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9A7B3C] hover:text-[#7D622D]"
                        title="Official Developer Website"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">RERA Registration No.</dt>
                  <dd className="font-mono-tabular font-semibold text-[#111827] mt-0.5">
                    {project.registrationNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Construction Progress</dt>
                  <dd className="font-mono-tabular font-semibold text-[#111827] mt-0.5">
                    {project.constructionPct}% ({project.status})
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Expected Handover</dt>
                  <dd className="font-mono-tabular font-semibold text-[#111827] mt-0.5">
                    {project.handoverDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Unit Configurations</dt>
                  <dd className="font-semibold text-[#111827] mt-0.5">
                    {project.propertyTypes.slice(0, 3).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Bathrooms</dt>
                  <dd className="font-semibold text-[#111827] mt-0.5">
                    {project.bathrooms || '1 - 3 Bathrooms'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Expected Rental ROI</dt>
                  <dd className="font-mono-tabular font-semibold text-[#047857] mt-0.5">
                    {project.investment.grossYieldPct
                      ? `${project.investment.grossYieldPct}% Gross / ${project.investment.netYieldPct}% Net`
                      : 'Estimate on request'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Payment Plan</dt>
                  <dd className="font-medium text-[#111827] mt-0.5">{project.paymentPlan}</dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Developer Sales Office</dt>
                  <dd className="text-[#111827] mt-0.5 text-[11px] leading-tight">
                    {project.salesOfficeAddress || developer?.salesOfficeAddress || 'Dubai Corporate Sales Gallery'}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#6B7280]">Verified Sales Hotline</dt>
                  <dd className="text-[#111827] font-semibold mt-0.5">
                    <a
                      href={`tel:${project.salesOfficePhone || developer?.salesOfficePhone || '+918810286629'}`}
                      className="hover:text-[#9A7B3C]"
                    >
                      {project.salesOfficePhone || developer?.salesOfficePhone || '+91 88102 86629'}
                    </a>
                  </dd>
                </div>
                {project.projectUrl && (
                  <div className="col-span-2 pt-2 border-t border-[#E5E2DC]">
                    <dt className="text-[#6B7280]">Official Project Reference URL</dt>
                    <dd className="mt-0.5">
                      <a
                        href={project.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#9A7B3C] font-medium hover:underline inline-flex items-center gap-1 break-all"
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
            <div className="mt-6 pt-6 border-t border-[#E5E2DC] grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onOpenEnquiry('callback', project)}
                className="py-2.5 px-3 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] transition-colors flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Request Callback</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('whatsapp', project)}
                className="py-2.5 px-3 bg-[#047857] text-white text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp Enquiry</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('visit', project)}
                className="py-2.5 px-3 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Visit</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenEnquiry('virtual_consultation', project)}
                className="py-2.5 px-3 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center justify-center gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
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
                className="py-2.5 px-3 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {project.brochureUrl && project.brochureUrl.startsWith('http')
                    ? 'Official Brochure PDF'
                    : 'Download Dossier'}
                </span>
              </a>
              <button
                type="button"
                onClick={() => onOpenEnquiry('availability_alert', project)}
                className="py-2.5 px-3 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Price & Unit Alerts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mandatory Dedicated 360° Virtual Tour Section */}
        <section className="bg-[#111827] text-white border border-[#111827] p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-semibold uppercase tracking-[0.18em] text-[#E6C77A]">
                  Dedicated Project Virtual Experience
                </span>
                <span aria-hidden="true" className="text-white/40">
                  ·
                </span>
                <span className="font-semibold text-white">
                  Status: {TOUR_STATUS_LABELS[effectiveTourStatus]}
                </span>
                {effectiveTourStatus !== 'coming_soon' && (project.virtualTour.tours || []).length > 1 && (
                  <span className="bg-[#9A7B3C] text-white text-[10px] font-mono px-2 py-0.5">
                    {(project.virtualTour.tours || []).length} Verified Tours
                  </span>
                )}
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-semibold">
                {effectiveTourStatus === 'coming_soon'
                  ? '360° TOUR NOT AVAILABLE'
                  : `Interactive 360° & Spatial Tour — ${project.name}`}
              </h2>

              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {effectiveTourStatus === '360_available'
                  ? `Explore ${project.virtualTour.rooms?.length || 0} true 360° panoramic scenes connected across floor levels, apartment interiors, exteriors, and amenities with interactive hotspots and floor-plan navigation.`
                  : effectiveTourStatus === '3d_available'
                  ? `Step inside an authorized ${project.virtualTour.provider || 'Matterport / 3D'} spatial twin bound specifically to ${project.name}. Source: ${project.virtualTour.directUrl || project.virtualTour.matterportUrl || 'Verified Developer Portal'}.`
                  : effectiveTourStatus === 'video_available'
                  ? `Watch the verified developer walkthrough video recorded on-site for ${project.name}.`
                  : `In compliance with White Collar Realty's strict authenticity standards, we never use generic tours, ordinary photographs pretending to be 360°, cross-project media, or unverified links. No genuine public 360° tour is currently available for this project. Request a guided live private virtual walkthrough with our RERA-licensed advisors.`}
              </p>

              {effectiveTourStatus !== 'coming_soon' && (project.virtualTour.tours || []).length > 1 && (
                <div className="pt-2">
                  <p className="text-[11px] text-[#E6C77A] font-semibold uppercase tracking-wider mb-2">
                    Available Verified Tours in Gallery:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(project.virtualTour.tours || []).map((t, idx) => (
                      <span
                        key={t.id || idx}
                        className="text-xs bg-white/10 px-3 py-1 border border-white/20 text-white flex items-center gap-1.5"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#E6C77A]" />
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
              {effectiveTourStatus !== 'coming_soon' ? (
                <button
                  type="button"
                  onClick={() => onOpenVirtualTour(project)}
                  className="px-6 py-3.5 bg-[#9A7B3C] text-white text-xs sm:text-sm font-semibold hover:bg-[#7D622D] transition-colors flex items-center gap-2 border border-[#E6C77A] cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-[#FAF9F6]" />
                  <span>EXPLORE 360° VIRTUAL TOUR</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <span className="px-4 py-3 bg-white/10 border border-white/20 text-center text-xs font-semibold uppercase tracking-wider text-[#E6C77A]">
                    360° TOUR NOT AVAILABLE
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenEnquiry('virtual_consultation', project)}
                    className="px-5 py-3 bg-[#9A7B3C] text-white text-xs sm:text-sm font-semibold hover:bg-[#7D622D] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Video className="w-4 h-4 text-white" />
                    <span>Request 360° Tour</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {effectiveTourStatus === '360_available' &&
            (project.virtualTour.rooms || []).length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(project.virtualTour.rooms || []).slice(0, 4).map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onOpenVirtualTour(project)}
                    className="text-left border border-white/15 bg-white/5 hover:border-[#E6C77A] p-3 transition-colors"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-[#E6C77A] font-semibold">
                      {room.floorLevel} · {room.viewCategory.replace('_', ' ')}
                    </p>
                    <p className="text-xs font-semibold mt-1 truncate">{room.label}</p>
                    <p className="text-[11px] text-white/60 mt-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>{(room.hotspots || []).length} hotspots</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
        </section>

        {/* Categorized Project Photography Gallery */}
        <section className="bg-white border border-[#E5E2DC] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-[#E5E2DC]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C] flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                <span>Verified Project-Specific Media Archive</span>
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827] mt-0.5">
                Project Photography, Renders & Construction Progress
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMediaCategoryFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium border ${
                  mediaCategoryFilter === 'all'
                    ? 'bg-[#111827] text-white border-[#111827]'
                    : 'bg-[#FAF9F6] text-[#4B5563] border-[#E5E2DC] hover:border-[#9A7B3C]'
                }`}
              >
                All ({projectMediaList.length})
              </button>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setMediaCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium border ${
                    mediaCategoryFilter === cat
                      ? 'bg-[#111827] text-white border-[#111827]'
                      : 'bg-[#FAF9F6] text-[#4B5563] border-[#E5E2DC] hover:border-[#9A7B3C]'
                  }`}
                >
                  {MEDIA_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {filteredMedia.length === 0 ? (
            <div className="mt-6 border border-[#E5E2DC] bg-[#FAF9F6] p-8 text-center">
              <Camera className="w-8 h-8 text-[#9A7B3C] mx-auto mb-2" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#111827]">
                PROJECT PHOTOGRAPHS NOT AVAILABLE
              </p>
              <p className="text-xs text-[#6B7280] mt-1 max-w-lg mx-auto">
                No verified project-specific photographs are currently published for {project.name}. Administrators can retrieve official images from the Project URL or upload verified photographs in the Operations Console.
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
                  className={`text-left border transition-colors bg-[#FAF9F6] overflow-hidden ${
                    activePhoto === item.url ? 'border-[#9A7B3C]' : 'border-[#E5E2DC] hover:border-[#9A7B3C]'
                  }`}
                >
                  <div className="relative aspect-[16/10] bg-[#EFECE6] overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-[#111827]/90 text-white text-[10px] font-semibold">
                      {MEDIA_CLASSIFICATION_LABELS[item.classification]}
                    </span>
                  </div>
                  <div className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#9A7B3C]">
                      <span>{MEDIA_CATEGORY_LABELS[item.category]}</span>
                      {item.verifiedProjectSpecific && (
                        <span className="text-[#047857]">Verified Project Photo</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#111827] line-clamp-1">{item.caption}</p>
                    <p className="text-[11px] text-[#6B7280] line-clamp-1">
                      Source: {item.sourceName} (Priority {item.sourcePriority})
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Overview Description & Amenities */}
        <section className="bg-white border border-[#E5E2DC] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-display text-2xl font-semibold text-[#111827] mb-3">
              Architectural Overview & Master Plan
            </h2>
            <p className="text-sm text-[#4B5563] leading-relaxed mb-4">{displayDesc}</p>
            <p className="text-xs text-[#6B7280]">
              <strong className="text-[#111827]">Master Plan Notes:</strong> {project.masterPlanNotes}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C] mb-3">
              Project Amenities & Specifications
            </h3>
            <ul className="space-y-2 text-sm text-[#111827]">
              {project.amenities.map((item) => (
                <li key={item} className="pb-2 border-b border-[#E5E2DC] text-xs">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Real-Time Project Inventory & Audit History */}
        <section className="bg-white border border-[#E5E2DC] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E5E2DC]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C]">
                Audited Unit Ledger
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111827] mt-0.5">
                Real-Time Project Inventory & Availability
              </h2>
            </div>
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="h-9 px-4 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing Feed...' : 'Refresh Provider Sync'}</span>
            </button>
          </div>

          {inv.status === 'verified_live' && inv.availableUnits !== null ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Total Units</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#111827]">
                    {inv.totalRegisteredUnits}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Released</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#111827]">
                    {inv.releasedUnits ?? inv.totalRegisteredUnits}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Available</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#047857]">
                    {inv.availableUnits}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Reserved</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#B45309]">
                    {inv.reservedUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Sold</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#4B5563]">
                    {inv.soldUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">On Hold</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#4B5563]">
                    {inv.onHoldUnits ?? 0}
                  </span>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                  <span className="text-xs text-[#6B7280] block">Availability %</span>
                  <span className="font-mono-tabular text-xl font-semibold text-[#9A7B3C]">
                    {inv.availabilityPct ?? 0}%
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563] bg-[#FAF9F6] border border-[#E5E2DC] px-4 py-3">
                <span>
                  <strong className="text-[#111827]">Data Source:</strong> {inv.dataSource}
                </span>
                <span className="font-mono-tabular">
                  Last Verified Update: {new Date(inv.lastUpdatedAt).toLocaleString()}
                </span>
              </div>

              {/* Floor Availability Table */}
              {project.floorAvailability.length > 0 && (
                <div className="overflow-x-auto">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] mb-3">
                    Floor-Level Availability Matrix
                  </h3>
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E2DC] text-[#6B7280]">
                        <th className="py-2.5 pr-4">Floor Band</th>
                        <th className="py-2.5 px-4">Unit Types</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-right">Available</th>
                        <th className="py-2.5 px-4 text-right">Reserved</th>
                        <th className="py-2.5 px-4 text-right">Sold</th>
                        <th className="py-2.5 pl-4 text-right">From Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2DC] font-mono-tabular">
                      {project.floorAvailability.map((row) => (
                        <tr key={row.floor}>
                          <td className="py-2.5 pr-4 font-sans font-medium text-[#111827]">
                            {row.floor}
                          </td>
                          <td className="py-2.5 px-4 font-sans text-[#4B5563]">{row.unitTypes}</td>
                          <td className="py-2.5 px-4 text-right">{row.totalUnits}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-[#047857]">
                            {row.availableUnits}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#B45309]">
                            {row.reservedUnits}
                          </td>
                          <td className="py-2.5 px-4 text-right text-[#4B5563]">{row.soldUnits}</td>
                          <td className="py-2.5 pl-4 text-right font-semibold">
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
            <div className="mt-6 bg-[#FAF9F6] border border-[#E5E2DC] p-6">
              <h3 className="text-base font-semibold text-[#111827]">
                Inventory update unavailable — Contact for latest availability
              </h3>
              <p className="text-xs text-[#4B5563] mt-1.5 leading-relaxed">
                {inv.totalRegisteredUnits
                  ? `Official registry records ${inv.totalRegisteredUnits} registered units in this project, however live unit-by-unit sales inventory is not published by an automated feed for this developer.`
                  : 'Live unit-by-unit sales inventory is not connected for this project.'}{' '}
                Source: {inv.dataSource}.
              </p>
              <button
                type="button"
                onClick={() => onOpenEnquiry('callback', project)}
                className="mt-4 px-4 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
              >
                Request Verified Developer Availability Sheet
              </button>
            </div>
          )}

          {/* Inventory Update History */}
          {projectLogs.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[#E5E2DC]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] mb-3">
                Inventory Synchronization History
              </h3>
              <div className="space-y-2">
                {projectLogs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs py-2 border-b border-[#E5E2DC]"
                  >
                    <div>
                      <span className="font-semibold text-[#111827]">
                        Available: {log.previousAvailable ?? 'N/A'} → {log.newAvailable ?? 'N/A'}
                      </span>
                      <span className="text-[#6B7280] ml-2">
                        ({log.syncType} · {log.source})
                      </span>
                      {log.notes && <p className="text-[#4B5563] mt-0.5">{log.notes}</p>}
                    </div>
                    <span className="font-mono-tabular text-[#6B7280]">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Floor Plans & Unit Types */}
        <section className="bg-white border border-[#E5E2DC] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-[#111827] mb-4">
            Unit Configurations & Floor Plans
          </h2>
          {project.floorPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {project.floorPlans.map((fp) => (
                <div key={fp.id} className="border border-[#E5E2DC] bg-[#FAF9F6] p-4 flex flex-col justify-between hover:border-[#9A7B3C] transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#9A7B3C]">{fp.bedrooms}</p>
                      {fp.bathrooms && (
                        <span className="text-[11px] text-[#4B5563] font-medium bg-white px-2 py-0.5 border border-[#E5E2DC]">
                          {fp.bathrooms}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#111827] mt-1.5 line-clamp-1">
                      {fp.name}
                    </h3>
                    <p className="text-xs text-[#4B5563] mt-1">
                      {fp.floorRange} · {fp.exposure}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#E5E2DC] space-y-1.5 text-xs font-mono-tabular">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Size</span>
                      <span className="font-semibold text-[#111827]">{fp.sizeSqFt.toLocaleString()} sq.ft</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Starting Price</span>
                      <span className="font-semibold text-[#111827]">{formatProjectPrice(fp.priceAed, currency)}</span>
                    </div>
                    {currency !== 'INR' && fp.priceAed > 0 && (
                      <div className="flex justify-between text-[#9A7B3C] font-semibold text-[11px]">
                        <span>Approx. INR</span>
                        <span>≈ {formatCurrency(fp.priceAed, 'INR')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Availability</span>
                      <span className="font-semibold text-[#047857]">
                        {fp.availableCount !== null ? `${fp.availableCount} units` : 'On Request'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEnquiry('brochure', project)}
                      className="w-full mt-2.5 py-1.5 bg-[#111827] text-white text-[11px] font-sans font-medium hover:bg-[#9A7B3C] transition-colors text-center"
                    >
                      Enquire Layout & Availability
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-[#E5E2DC] bg-[#FAF9F6] p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#9A7B3C]">
                  {project.propertyTypes.join(' · ')}
                </p>
                <p className="text-xs text-[#4B5563] mt-1 font-mono-tabular">
                  {project.minSizeSqFt > 0
                    ? `Unit Sizes: ${project.minSizeSqFt.toLocaleString()} – ${project.maxSizeSqFt.toLocaleString()} sq.ft`
                    : 'Unit sizes & individual floor plan layouts available via official developer brochure.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenEnquiry('brochure', project)}
                className="px-4 py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
              >
                Request Detailed Floor Plans
              </button>
            </div>
          )}
        </section>

        {/* Location Map & Nearby Landmarks + Developer Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-7 bg-white border border-[#E5E2DC] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C]">
                  Verified Connectivity & Proximity
                </p>
                <h2 className="font-display text-2xl font-semibold text-[#111827] mt-0.5">
                  Location & Nearby Infrastructure
                </h2>
              </div>
              <a
                href={project.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${project.coordinates.lat},${project.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#9A7B3C] hover:underline flex items-center gap-1"
              >
                <span>Google Maps Directions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="h-64 w-full border border-[#E5E2DC] bg-[#EFECE6] mb-5">
              {mapsApiKey ? (
                <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="AE">
                  <GoogleMap
                    defaultCenter={project.coordinates}
                    defaultZoom={13}
                    mapId="DEMO_MAP_ID"
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <AdvancedMarker position={project.coordinates} title={project.name}>
                      <div className="px-2.5 py-1 bg-[#111827] text-white text-xs font-semibold border border-[#9A7B3C]">
                        {project.name}
                      </div>
                    </AdvancedMarker>
                  </GoogleMap>
                </APIProvider>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#4B5563] p-4 text-center">
                  <MapPin className="w-6 h-6 text-[#9A7B3C] mb-2" />
                  <p className="font-semibold text-[#111827]">
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
                      return <Train className="w-4 h-4 text-[#9A7B3C]" />;
                    case 'school':
                      return <GraduationCap className="w-4 h-4 text-[#047857]" />;
                    case 'hospital':
                      return <HeartPulse className="w-4 h-4 text-[#DC2626]" />;
                    case 'mall':
                      return <ShoppingBag className="w-4 h-4 text-[#2563EB]" />;
                    default:
                      return <Landmark className="w-4 h-4 text-[#9A7B3C]" />;
                  }
                };

                return (
                  <div
                    key={lm.name}
                    className="border border-[#E5E2DC] bg-[#FAF9F6] p-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <div className="mt-0.5 shrink-0">{getIcon()}</div>
                      <div className="min-w-0">
                        <span className="uppercase text-[10px] font-semibold text-[#9A7B3C] block">
                          {lm.category}
                        </span>
                        <p className="font-semibold text-[#111827] mt-0.5 truncate">{lm.name}</p>
                      </div>
                    </div>
                    <div className="text-right font-mono-tabular text-[#4B5563] shrink-0">
                      <span className="block font-semibold text-[#111827]">{lm.distanceKm} km</span>
                      <span>{lm.travelTimeMin} min</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Developer Profile */}
          <section className="lg:col-span-5 bg-white border border-[#E5E2DC] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C]">
                Verified Master Developer
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#111827] mt-1">
                {developer?.name || project.developerName}
              </h2>
              {developer && (
                <>
                  <p className="text-xs font-mono-tabular text-[#4B5563] mt-1">
                    Reg: {developer.registrationId} · Est. {developer.foundedYear}
                  </p>
                  <p className="text-sm text-[#4B5563] leading-relaxed mt-4">{developer.history}</p>
                  <div className="grid grid-cols-2 gap-3 my-5 py-4 border-y border-[#E5E2DC] text-xs font-mono-tabular">
                    <div>
                      <span className="text-[#6B7280] block">Completed Projects</span>
                      <span className="text-lg font-semibold text-[#111827]">
                        {developer.completedProjects}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6B7280] block">Active Developments</span>
                      <span className="text-lg font-semibold text-[#111827]">
                        {developer.activeProjects}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs space-y-2 text-[#4B5563]">
                    <div>
                      <span className="font-semibold text-[#111827] block">Sales Office & Experience Gallery:</span>
                      <span className="text-xs text-[#4B5563]">
                        {developer.salesOfficeAddress || project.salesOfficeAddress || 'Dubai Corporate Gallery'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <p>
                        Official Hotline:{' '}
                        <a
                          href={`tel:${developer.salesOfficePhone || project.salesOfficePhone || '+918810286629'}`}
                          className="text-[#111827] font-semibold hover:text-[#9A7B3C]"
                        >
                          {developer.salesOfficePhone || project.salesOfficePhone || '+91 88102 86629'}
                        </a>
                      </p>
                      <p>
                        WhatsApp:{' '}
                        <a
                          href={`https://wa.me/${(developer.salesOfficeWhatsapp || project.salesOfficeWhatsapp || '918810286629').replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#047857] font-semibold hover:underline"
                        >
                          {developer.salesOfficeWhatsapp || project.salesOfficeWhatsapp || '+91 88102 86629'}
                        </a>
                      </p>
                    </div>
                    <div className="pt-1">
                      <a
                        href={developer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#9A7B3C] hover:underline font-semibold"
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
              <div className="mt-6 pt-5 border-t border-[#E5E2DC]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] mb-3">
                  Other Projects by {project.developerName}
                </h3>
                <div className="space-y-2">
                  {otherDeveloperProjects.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => onSelectProject(op)}
                      className="w-full text-left p-3 border border-[#E5E2DC] hover:border-[#9A7B3C] flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-[#111827]">{op.name}</span>
                      <span className="font-mono-tabular text-[#9A7B3C]">
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
        <section className="bg-white border border-[#E5E2DC] p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C]">
                Historical Transaction Benchmark
              </p>
              <h2 className="font-display text-2xl font-semibold text-[#111827] mt-0.5">
                {project.community} Price / Sq.Ft Trajectory
              </h2>
              <p className="text-xs text-[#6B7280] mt-1 mb-4">
                Source: {project.investment.dataCitation}
              </p>
              {project.investment.historicalTransactions.length > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={project.investment.historicalTransactions}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#4B5563' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#4B5563' }} />
                      <Tooltip
                        formatter={(value: unknown) => [
                          `AED ${Number(value).toLocaleString()} / sq.ft`,
                          'Avg Price',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgPricePerSqFtAed"
                        stroke="#9A7B3C"
                        fill="#9A7B3C"
                        fillOpacity={0.18}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-44 border border-[#E5E2DC] bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center">
                  <p className="text-xs font-semibold text-[#111827]">
                    Historical DLD / ADM Transaction Series Available on Request
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1 max-w-md">
                    Request recent registered sale comparables and service-charge benchmarks for {project.community}.
                  </p>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] mb-3">
                  Investment Indicators & Service Charges
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-6 font-mono-tabular">
                  <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                    <span className="text-xs font-sans text-[#6B7280] block">Est. Gross Yield</span>
                    <span className="text-xl font-semibold text-[#047857]">
                      {project.investment.grossYieldPct ?? 'N/A'}%
                    </span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                    <span className="text-xs font-sans text-[#6B7280] block">Est. Net Yield</span>
                    <span className="text-xl font-semibold text-[#9A7B3C]">
                      {project.investment.netYieldPct ?? 'N/A'}%
                    </span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                    <span className="text-xs font-sans text-[#6B7280] block">Service Charge / Sq.Ft</span>
                    <span className="text-lg font-semibold text-[#111827]">
                      AED {project.investment.serviceChargePerSqFtAed ?? 'N/A'}
                    </span>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3.5">
                    <span className="text-xs font-sans text-[#6B7280] block">5-Yr Area Growth</span>
                    <span className="text-lg font-semibold text-[#111827]">
                      +{project.investment.priceTrend5YrPct ?? 0}%
                    </span>
                  </div>
                </div>
              </div>

              {comparableProjects.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4B5563] mb-2">
                    Comparable UAE Developments
                  </h3>
                  <div className="space-y-2">
                    {comparableProjects.slice(0, 3).map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => onSelectProject(comp)}
                        className="w-full text-left p-3 border border-[#E5E2DC] hover:border-[#9A7B3C] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#111827] block">{comp.name}</span>
                          <span className="text-[#6B7280]">
                            {comp.community}, {comp.emirate}
                          </span>
                        </div>
                        <span className="font-mono-tabular font-semibold text-[#9A7B3C]">
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
