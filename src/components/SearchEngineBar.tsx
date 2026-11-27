import React, { useState } from 'react';
import { Bell, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import {
  Developer,
  Language,
  ProjectCategory,
  PropertyTypeOption,
  SearchFilters,
  SortOption,
} from '../types/realEstate.ts';
import { TRANSLATIONS } from '../i18n/translations.ts';

interface SearchEngineBarProps {
  filters: SearchFilters;
  developers: Developer[];
  communities: string[];
  availableEmirates?: string[];
  liveInventoryCount?: number;
  language: Language;
  resultCount: number;
  onChange: (next: SearchFilters) => void;
  onReset: () => void;
  onSaveSearch: () => void;
}

const EMIRATES = [
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

const PROPERTY_TYPES: PropertyTypeOption[] = [
  'Studio',
  '1 Bedroom',
  '2 Bedrooms',
  '3 Bedrooms',
  '4+ Bedrooms',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Mansion',
  'Commercial',
  'Office',
  'Retail',
  'Plot',
];

export const SearchEngineBar: React.FC<SearchEngineBarProps> = ({
  filters,
  developers,
  communities,
  availableEmirates,
  liveInventoryCount = 0,
  language,
  resultCount,
  onChange,
  onReset,
  onSaveSearch,
}) => {
  const [expanded, setExpanded] = useState(false);
  const t = TRANSLATIONS[language];
  const emirateOptions =
    availableEmirates && availableEmirates.length > 0 ? availableEmirates : EMIRATES;

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section
      aria-label={t.searchTitle}
      className="bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-5 lg:p-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-3xl font-medium text-[#F5F1E8] tracking-tight">
            {t.searchTitle}
          </h2>
          <p className="text-xs text-[#A5A19A] mt-1 tabular-nums">
            Showing <span className="text-[#D4AF72] font-semibold">{resultCount}</span> verified UAE{' '}
            {resultCount === 1 ? 'project' : 'projects'} with live registry metadata
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="h-9 px-3 sm:px-3.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
            <span className="sm:hidden">{expanded ? 'Hide Filters' : 'Advanced Filters'}</span>
            <span className="hidden sm:inline">
              {expanded ? 'Hide Bespoke Filters' : 'Size, Virtual Tours, Budget & Yield Filters'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSaveSearch}
            className="h-9 px-3.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200"
          >
            <Bell className="w-3.5 h-3.5 text-[#D4AF72]" />
            <span>{t.saveSearch}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="h-9 px-3 text-xs font-medium text-[#A5A19A] hover:text-[#F5F1E8] flex items-center gap-1 whitespace-nowrap transition-colors duration-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetFilters}</span>
          </button>
        </div>
      </div>

      {/* Core Search Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(200px,1.35fr)_minmax(178px,1.25fr)_minmax(148px,1.05fr)_minmax(130px,0.9fr)_minmax(125px,0.9fr)_minmax(168px,1.15fr)] gap-3">
        <div className="sm:col-span-2 md:col-span-2 xl:col-span-1 relative min-w-0">
          <Search className="w-4 h-4 text-[#A5A19A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update('query', e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full min-w-0 h-10 pl-9 pr-3 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
          />
        </div>

        <select
          value={filters.emirate}
          onChange={(e) => update('emirate', e.target.value)}
          aria-label="Filter by Emirate"
          className="w-full min-w-0 h-10 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
        >
          <option value="">All Active Emirates</option>
          {emirateOptions.map((em) => (
            <option key={em} value={em}>
              {em}
            </option>
          ))}
        </select>

        <select
          value={filters.propertyType}
          onChange={(e) => update('propertyType', e.target.value)}
          aria-label="Filter by Property Type"
          className="w-full min-w-0 h-10 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
        >
          <option value="">{t.allTypes}</option>
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))}
        </select>

        <select
          value={filters.bedroomCount}
          onChange={(e) => update('bedroomCount', e.target.value)}
          aria-label="Filter by Bedroom Configuration"
          className="w-full min-w-0 h-10 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
        >
          <option value="">Any Bedrooms</option>
          <option value="Studio">Studio</option>
          <option value="1 BR">1 BR</option>
          <option value="2 BR">2 BR</option>
          <option value="3 BR">3 BR</option>
          <option value="4+ BR">4+ BR</option>
          <option value="5+ BR">5+ BR</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => update('category', e.target.value)}
          aria-label="Filter by Construction Status"
          className="w-full min-w-0 h-10 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
        >
          <option value="">All Statuses</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => update('sortBy', e.target.value as SortOption)}
          aria-label={t.sortLabel}
          className="w-full min-w-0 h-10 px-2.5 bg-[#080808] border border-[#D4AF72]/45 text-sm font-medium text-[#D4AF72] focus:outline-none focus:border-[#D4AF72]"
        >
          <option value="featured">Sort: Featured</option>
          <option value="lowest_price">Sort: Lowest Price</option>
          <option value="highest_price">Sort: Highest Price</option>
          <option value="newest">Sort: Newest Projects</option>
          <option value="highest_availability">Sort: Highest Availability</option>
          <option value="nearest_handover">Sort: Nearest Handover</option>
          <option value="best_investment">Sort: Best Investment Potential</option>
        </select>
      </div>

      {/* Expanded Institutional Filter Matrix */}
      {expanded && (
        <div className="mt-5 pt-5 border-t border-[#D4AF72]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Budget Group */}
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
              Budget & Affordability (AED)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min AED"
                value={filters.minBudgetAed}
                onChange={(e) =>
                  update('minBudgetAed', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="number"
                placeholder="Max AED"
                value={filters.maxBudgetAed}
                onChange={(e) =>
                  update('maxBudgetAed', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min Area (sq ft)"
                value={filters.minSizeSqFt}
                onChange={(e) =>
                  update('minSizeSqFt', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="number"
                placeholder="Max Area (sq ft)"
                value={filters.maxSizeSqFt}
                onChange={(e) =>
                  update('maxSizeSqFt', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Max Monthly AED"
                value={filters.maxMonthlyPaymentAed}
                onChange={(e) =>
                  update(
                    'maxMonthlyPaymentAed',
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="number"
                placeholder="Max Down Pay %"
                value={filters.maxDownPaymentPct}
                onChange={(e) =>
                  update('maxDownPaymentPct', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          {/* Location & Landmarks */}
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
              Community & Proximity
            </p>
            <select
              value={filters.community}
              onChange={(e) => update('community', e.target.value)}
              className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            >
              <option value="">All Communities &amp; Neighbourhoods</option>
              {communities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <select
                value={filters.landmarkCategory}
                onChange={(e) => update('landmarkCategory', e.target.value)}
                className="w-full min-w-0 h-9 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              >
                <option value="">Near Any Landmark</option>
                <option value="metro">Metro Station</option>
                <option value="airport">Airport</option>
                <option value="school">School</option>
                <option value="mall">Shopping Centre</option>
                <option value="beach">Beachfront</option>
              </select>
              <input
                type="number"
                placeholder="Within km"
                value={filters.maxLandmarkDistanceKm}
                onChange={(e) =>
                  update(
                    'maxLandmarkDistanceKm',
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <select
              value={filters.tourFilter}
              onChange={(e) =>
                update('tourFilter', e.target.value as SearchFilters['tourFilter'])
              }
              aria-label="Filter by Virtual Tour Availability"
              className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            >
              <option value="">Virtual Tour & Media: Any</option>
              <option value="any_media">Verified 3D Tour or Video Available</option>
              <option value="3d_or_360">3D / 360° Virtual Tour Available</option>
              <option value="video_only">Verified Video Walkthrough Available</option>
            </select>
          </div>

          {/* Developer & Specs */}
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
              Developer, Handover & Specs
            </p>
            <select
              value={filters.developerId}
              onChange={(e) => update('developerId', e.target.value)}
              className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            >
              <option value="">{t.allDevelopers}</option>
              {developers.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <select
                value={filters.handoverYear}
                onChange={(e) => update('handoverYear', e.target.value)}
                className="w-full min-w-0 h-9 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              >
                <option value="">Any Handover Year</option>
                <option value="2024">Ready (2024–2025)</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
                <option value="2029">2029+</option>
              </select>
              <input
                type="number"
                placeholder="Min Constr. %"
                value={filters.minConstructionPct}
                onChange={(e) =>
                  update('minConstructionPct', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <select
              value={filters.minBathrooms}
              onChange={(e) =>
                update('minBathrooms', e.target.value === '' ? '' : Number(e.target.value))
              }
              aria-label="Filter by Verified Bathrooms"
              className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            >
              <option value="">Bathrooms: Any</option>
              <option value="1">1+ Bathroom</option>
              <option value="2">2+ Bathrooms</option>
              <option value="3">3+ Bathrooms</option>
              <option value="4">4+ Bathrooms</option>
              <option value="5">5+ Bathrooms</option>
            </select>
          </div>

          {/* Tenure, Yield & Live Inventory */}
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF72]">
              Tenure, Yield & Inventory
            </p>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <select
                value={filters.tenure}
                onChange={(e) => update('tenure', e.target.value)}
                className="w-full min-w-0 h-9 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              >
                <option value="">Freehold / Leasehold</option>
                <option value="Freehold">Freehold Only</option>
                <option value="Leasehold">Leasehold</option>
              </select>
              <select
                value={filters.furnished}
                onChange={(e) => update('furnished', e.target.value)}
                className="w-full min-w-0 h-9 px-2 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              >
                <option value="">Furnishing: Any</option>
                <option value="Furnished">Furnished</option>
                <option value="Semi-Furnished">Semi-Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
            </div>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                placeholder="Min Yield %"
                value={filters.minYieldPct}
                onChange={(e) =>
                  update('minYieldPct', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
              <input
                type="text"
                placeholder="Payment plan (e.g. 80/20)"
                value={filters.paymentPlanFilter}
                onChange={(e) => update('paymentPlanFilter', e.target.value)}
                className="w-full min-w-0 h-9 px-2.5 bg-[#1B1B1B] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          {/* Toggles Row */}
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium text-[#F5F1E8] cursor-pointer">
              <input
                type="checkbox"
                checked={filters.investmentOnly}
                onChange={(e) => update('investmentOnly', e.target.checked)}
                className="accent-[#D4AF72]"
              />
              <span>High-Yield Investment Opportunities (&ge; 7.0% Est. Gross Yield)</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[#F5F1E8] cursor-pointer">
              <input
                type="checkbox"
                checked={filters.waterfrontOnly}
                onChange={(e) => update('waterfrontOnly', e.target.checked)}
                className="accent-[#D4AF72]"
              />
              <span>Waterfront & Coastal Properties Only</span>
            </label>
            {liveInventoryCount > 0 && (
              <label className="flex items-center gap-2 text-xs font-medium text-[#F5F1E8] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verifiedAvailableOnly}
                  onChange={(e) => update('verifiedAvailableOnly', e.target.checked)}
                  className="accent-[#D4AF72]"
                />
                <span>Verified Live Available Units Only</span>
              </label>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
