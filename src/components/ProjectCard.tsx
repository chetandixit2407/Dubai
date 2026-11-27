import React, { useState } from 'react';
import { Bookmark, Building2, Compass, GitCompare, MapPin, Video } from 'lucide-react';
import { CurrencyCode, Language, Project } from '../types/realEstate.ts';
import {
  formatCurrency,
  formatInrTimestampNote,
  formatProjectPrice,
} from '../utils/currency.ts';
import { TRANSLATIONS } from '../i18n/translations.ts';
import {
  getEffectiveTourStatus,
  MEDIA_CLASSIFICATION_LABELS,
  TOUR_STATUS_LABELS,
} from '../utils/mediaValidation.ts';
import {
  formatCleanLocation,
  formatPropertyAreaSqFt,
  formatPropertyBhk,
  formatVerifiedLayoutsLabel,
} from '../utils/propertySpecs.ts';

interface ProjectCardProps {
  project: Project;
  currency: CurrencyCode;
  language: Language;
  isSaved: boolean;
  isCompared: boolean;
  onSelect: (project: Project) => void;
  onToggleSave: (project: Project, e: React.MouseEvent) => void;
  onToggleCompare: (project: Project, e: React.MouseEvent) => void;
  onRequestAvailabilitySheet?: (project: Project, e: React.MouseEvent) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  currency,
  language,
  isSaved,
  isCompared,
  onSelect,
  onToggleSave,
  onToggleCompare,
  onRequestAvailabilitySheet,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const t = TRANSLATIONS[language];
  const displayName = language === 'ar' && project.nameAr ? project.nameAr : project.name;
  const inv = project.inventory;
  const tourStatus = getEffectiveTourStatus(project);
  const tourLabel = TOUR_STATUS_LABELS[tourStatus];
  const mediaClassLabel =
    project.heroClassification && project.heroClassification !== 'actual_photograph'
      ? MEDIA_CLASSIFICATION_LABELS[project.heroClassification]
      : null;

  const bhkText = formatPropertyBhk(project);
  const areaSqFtText = formatPropertyAreaSqFt(project);
  const specsSummary = `${bhkText} | ${areaSqFtText}`;

  const lastCheckedIso = inv.lastUpdatedAt || project.lastVerifiedAt || project.updatedAt;
  const verifiedDateLabel = lastCheckedIso
    ? new Date(lastCheckedIso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <article
      onClick={() => onSelect(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(project);
        }
      }}
      className="group bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] hover:shadow-[0_18px_46px_-18px_rgba(212,175,114,0.28)] transition-all duration-300 cursor-pointer flex flex-col focus-visible:outline-2 focus-visible:outline-[#D4AF72]"
    >
      {/* Visual Media Slot */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#121212]">
        {!imgFailed && project.heroImage ? (
          <img
            src={project.heroImage}
            alt={`${project.name} in ${project.community}, ${project.emirate}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#121212] text-[#F5F1E8] p-6 text-center">
            <Building2 className="w-8 h-8 mb-2.5 text-[#D4AF72]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
              PROJECT PHOTOGRAPHS NOT AVAILABLE
            </span>
            <span className="font-display text-lg font-medium text-[#F5F1E8] mt-1 line-clamp-2">
              {displayName}
            </span>
            <span className="text-[11px] text-[#A5A19A] mt-1">
              Unique project photography pending verification
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/90 via-[#080808]/25 to-transparent pointer-events-none" />

        {/* Top Overlay Row: Classification Badge + Action Affordances */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
          {!imgFailed && project.heroImage && mediaClassLabel ? (
            <div className="pointer-events-auto bg-[#080808]/85 border border-[#D4AF72]/30 text-[#F5F1E8] px-2 py-1 text-[10px] sm:text-[11px] font-medium truncate min-w-0 max-w-[52%]">
              {mediaClassLabel}
            </div>
          ) : (
            <span />
          )}

          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => onToggleCompare(project, e)}
              title={isCompared ? t.comparingBtn : t.compareBtn}
              className={`h-9 px-2.5 sm:px-3 text-xs font-medium flex items-center gap-1.5 transition-colors duration-200 whitespace-nowrap shrink-0 border ${
                isCompared
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                  : 'bg-[#080808]/85 text-[#F5F1E8] border-[#D4AF72]/35 hover:border-[#D4AF72] hover:text-[#D4AF72]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xs:inline">{isCompared ? t.comparingBtn : t.compareBtn}</span>
            </button>
            <button
              type="button"
              onClick={(e) => onToggleSave(project, e)}
              aria-label={isSaved ? t.savedBtn : t.saveBtn}
              className={`w-9 h-9 flex items-center justify-center transition-colors duration-200 border shrink-0 ${
                isSaved
                  ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                  : 'bg-[#080808]/85 text-[#F5F1E8] border-[#D4AF72]/35 hover:border-[#D4AF72] hover:text-[#D4AF72]'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Bottom Scrim Location & Section 8 Media Availability Badge */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap xs:flex-nowrap items-end justify-between gap-2 text-[#F5F1E8]">
          <p className="text-xs text-[#F5F1E8]/90 flex items-center gap-1.5 min-w-0 flex-1">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#D4AF72]" />
            <span className="truncate">
              {formatCleanLocation(project.community, project.emirate)}
            </span>
          </p>
          <div className="flex items-center gap-1.5 shrink-0 max-w-full">
            {tourStatus === '3d_available' || tourStatus === '360_available' ? (
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#080808] bg-[#D4AF72] px-2 sm:px-2.5 py-0.5 flex items-center gap-1 whitespace-nowrap shadow-sm">
                <Compass className="w-3 h-3 shrink-0" />
                <span className="truncate">{tourLabel}</span>
              </span>
            ) : tourStatus === 'video_available' ? (
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#ECFDF5] bg-[#064E3B]/95 border border-[#34D399]/45 px-2 sm:px-2.5 py-0.5 flex items-center gap-1 whitespace-nowrap shadow-sm">
                <Video className="w-3 h-3 text-[#6EE7B7] shrink-0" />
                <span className="truncate">{tourLabel}</span>
              </span>
            ) : (
              <span className="text-[10px] sm:text-[11px] font-medium text-[#A5A19A] bg-[#080808]/85 border border-[#D4AF72]/20 px-2 sm:px-2.5 py-0.5 flex items-center gap-1 whitespace-nowrap">
                <Compass className="w-3 h-3 text-[#A5A19A] shrink-0" />
                <span className="truncate">{tourLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between min-w-0">
        <div className="min-w-0">
          {/* Clean Unboxed Metadata */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#A5A19A] mb-2">
            <span className="font-medium text-[#D4AF72]">{project.category}</span>
            <span aria-hidden="true">·</span>
            <span className="break-words">{project.developerName}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums ltr-isolate">{project.handoverDate}</span>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-medium text-[#F5F1E8] leading-snug mb-1.5 group-hover:text-[#D4AF72] transition-colors duration-200 break-words">
            {displayName}
          </h3>

          <p className="text-xs text-[#A5A19A] mb-3.5 truncate ltr-isolate" title={specsSummary}>
            {specsSummary}
          </p>

          {/* Starting Price + Separate Bedrooms / Area (sq ft) Details */}
          <div className="py-3 border-y border-[#D4AF72]/15 mb-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 min-w-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#A5A19A]">
                  Starting Price
                </p>
                <p className="font-mono-tabular text-sm sm:text-base font-semibold text-[#F5F1E8] break-words ltr-isolate">
                  {formatProjectPrice(project.startingPriceAed, currency)}
                </p>
              </div>
              {currency !== 'INR' && project.startingPriceAed > 0 && (
                <p
                  className="text-[11px] font-mono-tabular text-[#D4AF72] font-medium truncate ltr-isolate"
                  title={formatInrTimestampNote()}
                >
                  ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                </p>
              )}
              {currency === 'INR' && project.startingPriceAed > 0 && (
                <p
                  className="text-[11px] font-mono-tabular text-[#D4AF72] font-medium truncate ltr-isolate"
                  title={formatInrTimestampNote()}
                >
                  ≈ AED {project.startingPriceAed.toLocaleString()}
                </p>
              )}
            </div>

            <div className="pt-2.5 border-t border-[#D4AF72]/10 grid grid-cols-1 xs:grid-cols-2 gap-2 xs:gap-0 xs:divide-x xs:divide-[#D4AF72]/15">
              <div className="flex items-baseline justify-between gap-2 xs:block xs:pr-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#A5A19A]">Bedrooms</p>
                <p className="text-xs font-semibold text-[#F5F1E8] leading-snug break-words ltr-isolate">
                  {bhkText}
                </p>
              </div>
              <div className="flex items-baseline justify-between gap-2 xs:block xs:pl-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-[#A5A19A]">Area</p>
                <p
                  className={`text-xs font-mono-tabular font-semibold leading-snug break-words ltr-isolate ${
                    areaSqFtText === 'Not Available' ? 'text-[#A5A19A] font-sans' : 'text-[#F5F1E8]'
                  }`}
                >
                  {areaSqFtText}
                </p>
              </div>
            </div>
          </div>

          {/* Real-Time Inventory Truthfulness Block */}
          <div className="mb-4">
            {inv.status === 'verified_live' && inv.availableUnits !== null ? (
              <div className="bg-[#121212] border border-[#D4AF72]/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1.5">
                  <span className="font-semibold text-[#6EE7B7]">Verified Live Inventory</span>
                  <span className="font-mono-tabular text-[#A5A19A]">
                    {inv.availabilityPct !== null ? `${inv.availabilityPct}% Available` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 text-xs font-mono-tabular">
                  <div className="min-w-0">
                    <span className="block text-[11px] text-[#A5A19A]">Total</span>
                    <span className="font-semibold text-[#F5F1E8] ltr-isolate">{inv.totalRegisteredUnits ?? 'Verified'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] text-[#A5A19A]">Available</span>
                    <span className="font-semibold text-[#6EE7B7] ltr-isolate">{inv.availableUnits}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] text-[#A5A19A]">Reserved</span>
                    <span className="font-semibold text-[#D4AF72] ltr-isolate">{inv.reservedUnits ?? 0}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[11px] text-[#A5A19A]">Sold</span>
                    <span className="font-semibold text-[#A5A19A] ltr-isolate">{inv.soldUnits ?? 0}</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#A5A19A] mt-2 truncate" title={inv.dataSource}>
                  Source: {inv.dataSource}
                  {verifiedDateLabel ? ` · Updated ${verifiedDateLabel}` : ''}
                </p>
              </div>
            ) : (
              <div className="bg-[#121212] border border-[#D4AF72]/15 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#D4AF72]">{t.inventoryUnavailable}</p>
                  {verifiedDateLabel && (
                    <span className="text-[10px] font-mono-tabular text-[#A5A19A] shrink-0 ltr-isolate">
                      {verifiedDateLabel}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#A5A19A] truncate">
                  {project.floorPlans.length > 0
                    ? `${formatVerifiedLayoutsLabel(project.floorPlans.length)} · ${project.propertyTypes.slice(0, 2).join(', ')}`
                    : `Configs: ${project.propertyTypes.slice(0, 3).join(', ')}`}
                </p>
                {onRequestAvailabilitySheet && (
                  <button
                    type="button"
                    onClick={(e) => onRequestAvailabilitySheet(project, e)}
                    className="w-full py-1.5 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/35 hover:border-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] text-[11px] font-semibold text-[#F5F1E8] transition-colors text-center"
                  >
                    Request Availability Sheet
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Construction & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-[#D4AF72]/10 text-xs font-medium">
          <span className="text-[#A5A19A] tabular-nums truncate pr-2">
            Construction {project.constructionPct}% · {project.status}
          </span>
          <span className="text-[#D4AF72] group-hover:underline whitespace-nowrap shrink-0">
            {t.viewDetails} →
          </span>
        </div>
      </div>
    </article>
  );
};
