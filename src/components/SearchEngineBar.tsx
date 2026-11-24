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
  language,
  resultCount,
  onChange,
  onReset,
  onSaveSearch,
}) => {
  const [expanded, setExpanded] = useState(false);
  const t = TRANSLATIONS[language];

  const update = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <section
      aria-label={t.searchTitle}
      className="bg-white border border-[#E5E2DC] p-5 lg:p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111827]">{t.searchTitle}</h2>
          <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
            Showing {resultCount} verified UAE {resultCount === 1 ? 'project' : 'projects'} updating live
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="h-9 px-3.5 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5 whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#9A7B3C]" />
            <span>{expanded ? 'Hide Advanced Filters' : 'All Budget, Landmark & Yield Filters'}</span>
          </button>

          <button
            type="button"
            onClick={onSaveSearch}
            className="h-9 px-3.5 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5 whitespace-nowrap"
          >
            <Bell className="w-3.5 h-3.5 text-[#9A7B3C]" />
            <span>{t.saveSearch}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="h-9 px-3 text-xs font-medium text-[#4B5563] hover:text-[#111827] flex items-center gap-1 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetFilters}</span>
          </button>
        </div>
      </div>

      {/* Core Search Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="sm:col-span-2 lg:col-span-2 relative">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => update('query', e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full h-10 pl-9 pr-3 border border-[#E5E2DC] text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
          />
        </div>

        <select
          value={filters.emirate}
          onChange={(e) => update('emirate', e.target.value)}
          aria-label="Filter by Emirate"
          className="lg:col-span-2 h-10 px-3 border border-[#E5E2DC] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
        >
          <option value="">{t.allEmirates}</option>
          {EMIRATES.map((em) => (
            <option key={em} value={em}>
              {em}
            </option>
          ))}
        </select>

        <select
          value={filters.propertyType}
          onChange={(e) => update('propertyType', e.target.value)}
          aria-label="Filter by Property Type"
          className="lg:col-span-2 h-10 px-3 border border-[#E5E2DC] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
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
          aria-label="Filter by Bedroom Count"
          className="lg:col-span-2 h-10 px-3 border border-[#E5E2DC] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
        >
          <option value="">Any Bedrooms</option>
          <option value="Studio">Studio</option>
          <option value="1 Bedroom">1 Bedroom</option>
          <option value="2 Bedrooms">2 Bedrooms</option>
          <option value="3 Bedrooms">3 Bedrooms</option>
          <option value="4+ Bedrooms">4+ Bedrooms</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => update('category', e.target.value)}
          aria-label="Filter by Construction Status"
          className="lg:col-span-2 h-10 px-3 border border-[#E5E2DC] bg-white text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
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
          className="lg:col-span-2 h-10 px-3 border border-[#E5E2DC] bg-[#FAF9F6] text-sm font-medium text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
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
        <div className="mt-4 pt-4 border-t border-[#E5E2DC] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Budget Group */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B3C]">
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
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
              <input
                type="number"
                placeholder="Max AED"
                value={filters.maxBudgetAed}
                onChange={(e) =>
                  update('maxBudgetAed', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
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
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
              <input
                type="number"
                placeholder="Max Down Pay %"
                value={filters.maxDownPaymentPct}
                onChange={(e) =>
                  update('maxDownPaymentPct', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
            </div>
          </div>

          {/* Location & Landmarks */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B3C]">
              Community & Proximity
            </p>
            <select
              value={filters.community}
              onChange={(e) => update('community', e.target.value)}
              className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white text-xs"
            >
              <option value="">All Communities & Neighbourhoods</option>
              {communities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.landmarkCategory}
                onChange={(e) => update('landmarkCategory', e.target.value)}
                className="h-9 px-2 border border-[#E5E2DC] bg-white text-xs"
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
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
            </div>
          </div>

          {/* Developer & Specs */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B3C]">
              Developer, Handover & Specs
            </p>
            <select
              value={filters.developerId}
              onChange={(e) => update('developerId', e.target.value)}
              className="w-full h-9 px-2.5 border border-[#E5E2DC] bg-white text-xs"
            >
              <option value="">{t.allDevelopers}</option>
              {developers.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.handoverYear}
                onChange={(e) => update('handoverYear', e.target.value)}
                className="h-9 px-2 border border-[#E5E2DC] bg-white text-xs"
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
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
            </div>
          </div>

          {/* Tenure, Yield & Live Inventory */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9A7B3C]">
              Tenure, Yield & Inventory
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.tenure}
                onChange={(e) => update('tenure', e.target.value)}
                className="h-9 px-2 border border-[#E5E2DC] bg-white text-xs"
              >
                <option value="">Freehold / Leasehold</option>
                <option value="Freehold">Freehold Only</option>
                <option value="Leasehold">Leasehold</option>
              </select>
              <select
                value={filters.furnished}
                onChange={(e) => update('furnished', e.target.value)}
                className="h-9 px-2 border border-[#E5E2DC] bg-white text-xs"
              >
                <option value="">Furnishing: Any</option>
                <option value="Furnished">Furnished</option>
                <option value="Semi-Furnished">Semi-Furnished</option>
                <option value="Unfurnished">Unfurnished</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.5"
                placeholder="Min Yield %"
                value={filters.minYieldPct}
                onChange={(e) =>
                  update('minYieldPct', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="h-9 px-2.5 border border-[#E5E2DC] font-mono-tabular text-xs"
              />
              <input
                type="text"
                placeholder="Payment plan (e.g. 80/20)"
                value={filters.paymentPlanFilter}
                onChange={(e) => update('paymentPlanFilter', e.target.value)}
                className="h-9 px-2.5 border border-[#E5E2DC] text-xs"
              />
            </div>
          </div>

          {/* Toggles Row */}
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                checked={filters.waterfrontOnly}
                onChange={(e) => update('waterfrontOnly', e.target.checked)}
                className="accent-[#9A7B3C]"
              />
              <span>Waterfront & Coastal Properties Only</span>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-[#111827] cursor-pointer">
              <input
                type="checkbox"
                checked={filters.verifiedAvailableOnly}
                onChange={(e) => update('verifiedAvailableOnly', e.target.checked)}
                className="accent-[#9A7B3C]"
              />
              <span>Verified Live Available Units Only</span>
            </label>
          </div>
        </div>
      )}
    </section>
  );
};
