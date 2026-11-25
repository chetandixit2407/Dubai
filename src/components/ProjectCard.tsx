import React, { useState } from 'react';
import { Bookmark, Building2, Compass, GitCompare, MapPin } from 'lucide-react';
import { CurrencyCode, Language, Project } from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import { TRANSLATIONS } from '../i18n/translations.ts';
import {
  getEffectiveTourStatus,
  MEDIA_CLASSIFICATION_LABELS,
  TOUR_STATUS_LABELS,
} from '../utils/mediaValidation.ts';

interface ProjectCardProps {
  project: Project;
  currency: CurrencyCode;
  language: Language;
  isSaved: boolean;
  isCompared: boolean;
  onSelect: (project: Project) => void;
  onToggleSave: (project: Project, e: React.MouseEvent) => void;
  onToggleCompare: (project: Project, e: React.MouseEvent) => void;
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
      className="group bg-white border border-[#E5E2DC] hover:border-[#9A7B3C] transition-colors duration-200 cursor-pointer flex flex-col focus-visible:outline-2 focus-visible:outline-[#9A7B3C]"
    >
      {/* Visual Media Slot */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F3F1EC]">
        {!imgFailed && project.heroImage ? (
          <img
            src={project.heroImage}
            alt={`${project.name} in ${project.community}, ${project.emirate}`}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#181D27] text-white p-6 text-center">
            <Building2 className="w-8 h-8 mb-2.5 text-[#E6C77A]" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E6C77A]">
              PROJECT PHOTOGRAPHS NOT AVAILABLE
            </span>
            <span className="font-display text-lg font-semibold text-white mt-1 line-clamp-2">
              {displayName}
            </span>
            <span className="text-[11px] text-white/65 mt-1">
              Unique project photography pending verification
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Honest Media Classification Label (Top Left — Clean Scrim Text) */}
        {!imgFailed && project.heroImage && mediaClassLabel && (
          <div className="absolute top-3 left-3 bg-black/70 text-white/95 px-2.5 py-1 text-[11px] font-medium">
            {mediaClassLabel}
          </div>
        )}

        {/* Action Affordances (Top Right) */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={(e) => onToggleCompare(project, e)}
            title={isCompared ? t.comparingBtn : t.compareBtn}
            className={`h-9 px-3 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isCompared
                ? 'bg-[#9A7B3C] text-white'
                : 'bg-white/95 text-[#111827] hover:bg-white'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{isCompared ? t.comparingBtn : t.compareBtn}</span>
          </button>
          <button
            type="button"
            onClick={(e) => onToggleSave(project, e)}
            aria-label={isSaved ? t.savedBtn : t.saveBtn}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${
              isSaved
                ? 'bg-[#111827] text-[#E6C77A]'
                : 'bg-white/95 text-[#111827] hover:bg-white'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Scrim Location & Tour Status */}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2 text-white">
          <p className="text-xs text-white/90 flex items-center gap-1.5 min-w-0 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {project.community} · {project.emirate}
            </span>
          </p>
          <span
            className={`text-[11px] font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
              tourStatus !== 'coming_soon' ? 'text-[#E6C77A]' : 'text-white/80'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{tourLabel}</span>
          </span>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Clean Unboxed Metadata */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B5563] mb-2">
            <span className="font-medium text-[#9A7B3C]">{project.category}</span>
            <span aria-hidden="true">·</span>
            <span>{project.developerName}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{project.handoverDate}</span>
          </div>

          <h3 className="font-display text-2xl font-semibold text-[#111827] leading-snug mb-1.5 group-hover:text-[#9A7B3C] transition-colors">
            {displayName}
          </h3>

          <p className="text-xs text-[#4B5563] mb-3 truncate">
            {project.propertyTypes.slice(0, 4).join(' · ')}
          </p>

          {/* Pricing & Yield Row */}
          <div className="grid grid-cols-2 gap-4 py-3 border-y border-[#E5E2DC] mb-4">
            <div>
              <p className="text-xs text-[#6B7280] mb-0.5">Starting Price</p>
              <p className="font-mono-tabular text-base font-semibold text-[#111827]">
                {formatProjectPrice(project.startingPriceAed, currency)}
              </p>
              {currency !== 'INR' && project.startingPriceAed > 0 && (
                <p className="text-[11px] font-mono-tabular text-[#9A7B3C] font-medium mt-0.5">
                  ≈ {formatCurrency(project.startingPriceAed, 'INR')}
                </p>
              )}
              {currency === 'INR' && project.startingPriceAed > 0 && (
                <p className="text-[11px] font-mono-tabular text-[#9A7B3C] font-medium mt-0.5">
                  ≈ AED {project.startingPriceAed.toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-[#6B7280] mb-0.5">Est. Gross ROI / Bathrooms</p>
              <p className="font-mono-tabular text-sm font-semibold text-[#047857]">
                {project.investment.grossYieldPct
                  ? `${project.investment.grossYieldPct.toFixed(1)}% Gross Yield`
                  : 'Yield on Request'}
              </p>
              <p className="text-[11px] text-[#4B5563] mt-0.5 truncate">
                {project.bathrooms || '1 - 3 Bathrooms'}
              </p>
            </div>
          </div>

          {/* Real-Time Inventory Truthfulness Block */}
          <div className="mb-4">
            {inv.status === 'verified_live' && inv.availableUnits !== null ? (
              <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[#047857]">Verified Live Inventory</span>
                  <span className="font-mono-tabular text-[#4B5563]">
                    {inv.availabilityPct !== null ? `${inv.availabilityPct}% Available` : ''}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono-tabular">
                  <div>
                    <span className="block text-[11px] text-[#6B7280]">Total</span>
                    <span className="font-semibold text-[#111827]">{inv.totalRegisteredUnits}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6B7280]">Available</span>
                    <span className="font-semibold text-[#047857]">{inv.availableUnits}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6B7280]">Reserved</span>
                    <span className="font-semibold text-[#B45309]">{inv.reservedUnits ?? 0}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[#6B7280]">Sold</span>
                    <span className="font-semibold text-[#4B5563]">{inv.soldUnits ?? 0}</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#6B7280] mt-2 truncate" title={inv.dataSource}>
                  Source: {inv.dataSource}
                </p>
              </div>
            ) : (
              <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-3">
                <p className="text-xs font-medium text-[#4B5563] mb-1">{t.inventoryUnavailable}</p>
                <p className="text-[11px] text-[#6B7280] truncate" title={inv.dataSource}>
                  Registry: {inv.dataSource}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Construction & Action */}
        <div className="flex items-center justify-between pt-2 text-xs font-medium">
          <span className="text-[#4B5563] tabular-nums truncate pr-2">
            Construction {project.constructionPct}% · {project.status}
          </span>
          <span className="text-[#9A7B3C] group-hover:underline whitespace-nowrap shrink-0">
            {t.viewDetails} →
          </span>
        </div>
      </div>
    </article>
  );
};
