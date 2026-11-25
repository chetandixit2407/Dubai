import React, { useCallback, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import {
  ExternalLink,
  Layers,
  List,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Navigation,
} from 'lucide-react';
import { CurrencyCode, EmiratesName, Project } from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';

interface UAEPropertyMapProps {
  projects: Project[];
  mapsApiKey: string;
  currency: CurrencyCode;
  onOpenProject: (project: Project) => void;
}

const EMIRATE_CENTERS: Record<'All UAE' | EmiratesName, { lat: number; lng: number; zoom: number }> =
  {
    'All UAE': { lat: 25.05, lng: 55.35, zoom: 8 },
    Dubai: { lat: 25.18, lng: 55.28, zoom: 11 },
    'Abu Dhabi': { lat: 24.48, lng: 54.52, zoom: 11 },
    Sharjah: { lat: 25.31, lng: 55.55, zoom: 11 },
    Ajman: { lat: 25.42, lng: 55.48, zoom: 12 },
    'Ras Al Khaimah': { lat: 25.68, lng: 55.76, zoom: 11 },
    Fujairah: { lat: 25.13, lng: 56.34, zoom: 12 },
    'Umm Al Quwain': { lat: 25.58, lng: 55.6, zoom: 12 },
  };

type AdvancedMarkerRefType = NonNullable<ReturnType<typeof useAdvancedMarkerRef>[1]>;

interface MarkerItemProps {
  project: Project;
  currency: CurrencyCode;
  isSelected: boolean;
  onSelect: (project: Project, marker: AdvancedMarkerRefType) => void;
}

const ProjectAdvancedMarker: React.FC<MarkerItemProps> = ({
  project,
  currency,
  isSelected,
  onSelect,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={project.coordinates}
      title={project.name}
      zIndex={isSelected ? 1000 : 10}
      onClick={() => {
        if (marker) {
          onSelect(project, marker);
        }
      }}
    >
      <div
        className={`px-2.5 py-1 text-xs font-mono-tabular font-semibold border transition-transform duration-200 shadow-lg cursor-pointer whitespace-nowrap ${
          isSelected
            ? 'bg-[#D4AF72] text-[#080808] border-[#F5F1E8] scale-110'
            : 'bg-[#080808]/95 text-[#F5F1E8] border-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808]'
        }`}
      >
        {formatProjectPrice(project.startingPriceAed, currency, true)}
      </div>
    </AdvancedMarker>
  );
};

export const UAEPropertyMap: React.FC<UAEPropertyMapProps> = ({
  projects,
  mapsApiKey,
  currency,
  onOpenProject,
}) => {
  const [selectedEmirate, setSelectedEmirate] = useState<'All UAE' | EmiratesName>('All UAE');
  const [selectedCommunity, setSelectedCommunity] = useState<string>('All');
  const [maxBudgetAed, setMaxBudgetAed] = useState<number>(150000000);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeMarker, setActiveMarker] = useState<AdvancedMarkerRefType | null>(null);

  const camera = EMIRATE_CENTERS[selectedEmirate];

  const availableCommunities = useMemo(() => {
    const base =
      selectedEmirate === 'All UAE'
        ? projects
        : projects.filter((p) => p.emirate === selectedEmirate);
    return Array.from(new Set(base.map((p) => p.community).filter(Boolean))).sort();
  }, [projects, selectedEmirate]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedEmirate !== 'All UAE' && p.emirate !== selectedEmirate) return false;
      if (selectedCommunity !== 'All' && p.community !== selectedCommunity) return false;
      if (p.startingPriceAed > maxBudgetAed) return false;
      if (propertyTypeFilter !== 'All' && !p.propertyTypes.includes(propertyTypeFilter as never)) {
        return false;
      }
      return true;
    });
  }, [projects, selectedEmirate, selectedCommunity, maxBudgetAed, propertyTypeFilter]);

  const handleMarkerSelect = useCallback(
    (project: Project, marker: AdvancedMarkerRefType) => {
      setActiveProject(project);
      setActiveMarker(marker);
    },
    []
  );

  const handleCloseInfo = useCallback(() => {
    setActiveProject(null);
    setActiveMarker(null);
  }, []);

  return (
    <div
      className={`bg-[#121212] border border-[#D4AF72]/25 ${
        isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'relative'
      }`}
    >
      {/* Map Control & Filter Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#D4AF72]/20 bg-[#1B1B1B] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="xs:col-span-2 sm:col-span-1 flex items-center gap-1.5 text-xs font-semibold text-[#F5F1E8] uppercase tracking-wider">
            <Layers className="w-4 h-4 text-[#D4AF72] shrink-0" />
            <span>UAE Explorer ({filteredProjects.length})</span>
          </div>

          <select
            value={selectedEmirate}
            onChange={(e) => {
              setSelectedEmirate(e.target.value as 'All UAE' | EmiratesName);
              setSelectedCommunity('All');
              setActiveProject(null);
            }}
            aria-label="Zoom to Emirate"
            className="w-full sm:w-auto min-w-0 h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
          >
            {Object.keys(EMIRATE_CENTERS).map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>

          <select
            value={selectedCommunity}
            onChange={(e) => {
              setSelectedCommunity(e.target.value);
              setActiveProject(null);
            }}
            aria-label="Filter map by community"
            className="w-full sm:w-auto sm:max-w-[200px] min-w-0 h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
          >
            <option value="All">All Communities</option>
            {availableCommunities.map((comm) => (
              <option key={comm} value={comm}>
                {comm}
              </option>
            ))}
          </select>

          <select
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
            aria-label="Filter map by property type"
            className="w-full sm:w-auto min-w-0 h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
          >
            <option value="All">All Property Types</option>
            <option value="Studio">Studio</option>
            <option value="1 Bedroom">1 Bedroom</option>
            <option value="2 Bedrooms">2 Bedrooms</option>
            <option value="3 Bedrooms">3 Bedrooms</option>
            <option value="4+ Bedrooms">4+ Bedrooms</option>
            <option value="Villa">Villa</option>
            <option value="Townhouse">Townhouse</option>
            <option value="Penthouse">Penthouse</option>
            <option value="Commercial">Commercial / Office</option>
          </select>

          <select
            value={maxBudgetAed}
            onChange={(e) => setMaxBudgetAed(Number(e.target.value))}
            aria-label="Filter map by maximum budget"
            className="w-full sm:w-auto min-w-0 h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
          >
            <option value={150000000}>Any Budget</option>
            <option value={2000000}>Up to AED 2M</option>
            <option value={5000000}>Up to AED 5M</option>
            <option value={10000000}>Up to AED 10M</option>
            <option value={25000000}>Up to AED 25M</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex border border-[#D4AF72]/25 bg-[#121212]">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`h-9 px-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'map'
                  ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                  : 'text-[#A5A19A] hover:text-[#F5F1E8]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`h-9 px-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                viewMode === 'list'
                  ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                  : 'text-[#A5A19A] hover:text-[#F5F1E8]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === 'list' ? (
        <div
          className={`overflow-y-auto p-6 bg-[#080808] ${isFullscreen ? 'flex-1' : 'h-[580px]'}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="border border-[#D4AF72]/20 p-4 bg-[#1B1B1B] flex flex-col justify-between gap-3 hover:border-[#D4AF72] transition-colors"
              >
                <div>
                  <p className="text-xs text-[#D4AF72] font-medium">
                    {project.emirate} · {project.community}
                  </p>
                  <h4 className="font-display text-xl font-medium text-[#F5F1E8] mt-1">
                    {project.name}
                  </h4>
                  <p className="text-xs text-[#A5A19A] mt-1">{project.developerName}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#D4AF72]/15">
                  <div>
                    <span className="block text-[11px] text-[#A5A19A]">From</span>
                    <span className="font-mono-tabular text-sm font-semibold text-[#F5F1E8]">
                      {formatProjectPrice(project.startingPriceAed, currency)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProject(project)}
                    className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
                  >
                    Open Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 lg:grid-cols-4 ${
            isFullscreen ? 'flex-1 min-h-0' : 'h-auto lg:h-[600px]'
          }`}
        >
          {/* Map Container */}
          <div
            className={`lg:col-span-3 relative min-w-0 bg-[#080808] ${
              isFullscreen ? 'h-[48dvh] lg:h-full' : 'h-[340px] sm:h-[420px] lg:h-full'
            }`}
          >
            {mapsApiKey ? (
              <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="AE">
                <GoogleMap
                  key={`${selectedEmirate}-${camera.zoom}`}
                  defaultCenter={{ lat: camera.lat, lng: camera.lng }}
                  defaultZoom={camera.zoom}
                  mapId="DEMO_MAP_ID"
                  colorScheme="DARK"
                  gestureHandling="greedy"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%' }}
                >
                  {filteredProjects.map((project) => (
                    <ProjectAdvancedMarker
                      key={project.id}
                      project={project}
                      currency={currency}
                      isSelected={activeProject?.id === project.id}
                      onSelect={handleMarkerSelect}
                    />
                  ))}

                  {activeProject && activeMarker && (
                    <InfoWindow anchor={activeMarker} onCloseClick={handleCloseInfo}>
                      <div className="p-2 max-w-[270px] bg-[#121212] text-[#F5F1E8]">
                        {activeProject.heroImage && (
                          <img
                            src={activeProject.heroImage}
                            alt={activeProject.name}
                            className="w-full h-24 object-cover mb-2 border border-[#D4AF72]/25"
                          />
                        )}
                        <p className="text-[11px] font-semibold text-[#D4AF72] uppercase">
                          {activeProject.emirate} · {activeProject.community}
                        </p>
                        <h4 className="font-display font-medium text-base text-[#F5F1E8] mt-0.5">
                          {activeProject.name}
                        </h4>
                        <p className="text-xs text-[#A5A19A] mt-0.5">
                          {activeProject.developerName}
                        </p>
                        <p className="font-mono-tabular text-xs font-semibold text-[#F5F1E8] mt-2">
                          {activeProject.startingPriceAed > 0
                            ? `From ${formatProjectPrice(activeProject.startingPriceAed, currency)}`
                            : 'Price on Request'}
                        </p>
                        <p className="text-[11px] text-[#A5A19A] mt-1">
                          {activeProject.inventory.status === 'verified_live' &&
                          activeProject.inventory.availableUnits !== null
                            ? `Available: ${activeProject.inventory.availableUnits} / ${activeProject.inventory.totalRegisteredUnits} units`
                            : 'Inventory update unavailable'}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenProject(activeProject)}
                            className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                          >
                            View Full Project
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${activeProject.coordinates.lat},${activeProject.coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 border border-[#D4AF72]/35 text-xs text-[#F5F1E8] hover:border-[#D4AF72] flex items-center gap-1"
                          >
                            <Navigation className="w-3 h-3 text-[#D4AF72]" />
                            <span>Route</span>
                          </a>
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            ) : (
              /* Interactive Geographic UAE Coordinate Grid Fallback if Maps key is absent in local dev */
              <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-br from-[#080808] to-[#121212]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#D4AF72] uppercase tracking-[0.18em]">
                      UAE Geospatial Project Explorer
                    </p>
                    <p className="text-xs text-[#A5A19A] mt-0.5">
                      Select any Emirates pin below to inspect pricing, live inventory, or launch
                      Google Maps directions.
                    </p>
                  </div>
                </div>
                <div className="relative flex-1 my-4 border border-[#D4AF72]/25 bg-[#121212] overflow-hidden">
                  {filteredProjects.map((proj) => {
                    const leftPct = Math.min(
                      90,
                      Math.max(8, ((proj.coordinates.lng - 54.3) / 2.2) * 84 + 8)
                    );
                    const topPct = Math.min(
                      88,
                      Math.max(10, 90 - ((proj.coordinates.lat - 24.3) / 1.55) * 80)
                    );
                    const selected = activeProject?.id === proj.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setActiveProject(proj)}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-mono-tabular font-semibold border transition-transform ${
                          selected
                            ? 'bg-[#D4AF72] text-[#080808] border-[#F5F1E8] z-20 scale-110'
                            : 'bg-[#080808] text-[#F5F1E8] border-[#D4AF72]/60 hover:bg-[#D4AF72] hover:text-[#080808] z-10'
                        }`}
                      >
                        {proj.emirate.slice(0, 3).toUpperCase()} ·{' '}
                        {formatProjectPrice(proj.startingPriceAed, currency, true)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Nearby & Selected Project Sidebar */}
          <aside className="border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#121212] overflow-y-auto p-4 flex flex-col gap-3 max-h-[340px] lg:max-h-none lg:h-full min-w-0">
            {activeProject ? (
              <div className="border border-[#D4AF72]/50 bg-[#1B1B1B] p-4">
                {activeProject.heroImage && (
                  <img
                    src={activeProject.heroImage}
                    alt={activeProject.name}
                    className="w-full h-28 object-cover mb-3 border border-[#D4AF72]/20"
                  />
                )}
                <p className="text-[11px] font-semibold text-[#D4AF72] uppercase tracking-wider">
                  Selected Development
                </p>
                <h4 className="font-display text-xl font-medium text-[#F5F1E8] mt-1">
                  {activeProject.name}
                </h4>
                <p className="text-xs text-[#A5A19A] mt-0.5">
                  {activeProject.community}, {activeProject.emirate}
                </p>
                <p className="font-mono-tabular text-sm font-semibold text-[#F5F1E8] mt-3">
                  {formatProjectPrice(activeProject.startingPriceAed, currency)}
                </p>
                {currency !== 'INR' && activeProject.startingPriceAed > 0 && (
                  <p className="font-mono-tabular text-[11px] text-[#D4AF72] mt-0.5">
                    ≈ {formatCurrency(activeProject.startingPriceAed, 'INR')}
                  </p>
                )}
                <p className="text-xs text-[#A5A19A] mt-1.5">
                  {activeProject.inventory.status === 'verified_live'
                    ? `${activeProject.inventory.availableUnits} units available`
                    : 'Inventory update unavailable'}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProject(activeProject)}
                    className="w-full py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
                  >
                    Open Complete Project Page
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeProject.coordinates.lat},${activeProject.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 border border-[#D4AF72]/30 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#D4AF72]" />
                    <span>Navigate via Google Maps</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#A5A19A]">
                Click any map pin or project card below to inspect live availability and navigate.
              </p>
            )}

            <div className="space-y-2">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setActiveProject(project)}
                  className={`w-full text-left p-3 border transition-colors ${
                    activeProject?.id === project.id
                      ? 'border-[#D4AF72] bg-[#1B1B1B]'
                      : 'border-[#D4AF72]/15 bg-[#080808]/60 hover:border-[#D4AF72]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#F5F1E8] truncate">
                      {project.name}
                    </span>
                    <span className="font-mono-tabular text-xs font-medium text-[#D4AF72] shrink-0">
                      {formatProjectPrice(project.startingPriceAed, currency, true)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A5A19A] mt-0.5 truncate">
                    {project.emirate} · {project.community}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
