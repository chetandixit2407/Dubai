import React, { useCallback, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Layers, List, Map as MapIcon, Maximize2, Minimize2, Navigation } from 'lucide-react';
import { CurrencyCode, EmiratesName, Project } from '../types/realEstate.ts';
import { formatProjectPrice } from '../utils/currency.ts';

interface UAEPropertyMapProps {
  projects: Project[];
  mapsApiKey: string;
  currency: CurrencyCode;
  onOpenProject: (project: Project) => void;
}

const EMIRATE_CENTERS: Record<'All UAE' | EmiratesName, { lat: number; lng: number; zoom: number }> = {
  'All UAE': { lat: 25.05, lng: 55.35, zoom: 8 },
  Dubai: { lat: 25.18, lng: 55.28, zoom: 11 },
  'Abu Dhabi': { lat: 24.48, lng: 54.52, zoom: 11 },
  Sharjah: { lat: 25.31, lng: 55.55, zoom: 11 },
  Ajman: { lat: 25.42, lng: 55.48, zoom: 12 },
  'Ras Al Khaimah': { lat: 25.68, lng: 55.76, zoom: 11 },
  Fujairah: { lat: 25.13, lng: 56.34, zoom: 12 },
  'Umm Al Quwain': { lat: 25.58, lng: 55.60, zoom: 12 },
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
        className={`px-2.5 py-1 text-xs font-mono-tabular font-semibold border transition-transform shadow-sm cursor-pointer whitespace-nowrap ${
          isSelected
            ? 'bg-[#9A7B3C] text-white border-white scale-110'
            : 'bg-[#111827] text-white border-[#9A7B3C] hover:bg-[#9A7B3C]'
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
  const [maxBudgetAed, setMaxBudgetAed] = useState<number>(150000000);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeMarker, setActiveMarker] = useState<AdvancedMarkerRefType | null>(null);

  const camera = EMIRATE_CENTERS[selectedEmirate];

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedEmirate !== 'All UAE' && p.emirate !== selectedEmirate) return false;
      if (p.startingPriceAed > maxBudgetAed) return false;
      if (propertyTypeFilter !== 'All' && !p.propertyTypes.includes(propertyTypeFilter as never)) {
        return false;
      }
      return true;
    });
  }, [projects, selectedEmirate, maxBudgetAed, propertyTypeFilter]);

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
      className={`bg-white border border-[#E5E2DC] ${
        isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'relative'
      }`}
    >
      {/* Map Control & Filter Header */}
      <div className="p-4 border-b border-[#E5E2DC] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111827] uppercase tracking-wider">
            <Layers className="w-4 h-4 text-[#9A7B3C]" />
            <span>UAE Explorer ({filteredProjects.length})</span>
          </div>

          <select
            value={selectedEmirate}
            onChange={(e) => {
              setSelectedEmirate(e.target.value as 'All UAE' | EmiratesName);
              setActiveProject(null);
            }}
            aria-label="Zoom to Emirate"
            className="h-9 px-3 bg-white border border-[#E5E2DC] text-xs font-medium text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
          >
            {Object.keys(EMIRATE_CENTERS).map((em) => (
              <option key={em} value={em}>
                {em}
              </option>
            ))}
          </select>

          <select
            value={propertyTypeFilter}
            onChange={(e) => setPropertyTypeFilter(e.target.value)}
            aria-label="Filter map by property type"
            className="h-9 px-3 bg-white border border-[#E5E2DC] text-xs font-medium text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
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
            className="h-9 px-3 bg-white border border-[#E5E2DC] text-xs font-medium text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
          >
            <option value={150000000}>Any Budget</option>
            <option value={2000000}>Up to AED 2M</option>
            <option value={5000000}>Up to AED 5M</option>
            <option value={10000000}>Up to AED 10M</option>
            <option value={25000000}>Up to AED 25M</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex border border-[#E5E2DC] bg-white">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`h-9 px-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'map' ? 'bg-[#111827] text-white' : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Map View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`h-9 px-3 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap ${
                viewMode === 'list' ? 'bg-[#111827] text-white' : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="h-9 px-3 bg-white border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1.5 whitespace-nowrap"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      {viewMode === 'list' ? (
        <div className={`overflow-y-auto p-6 ${isFullscreen ? 'flex-1' : 'h-[560px]'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="border border-[#E5E2DC] p-4 bg-[#FAF9F6] flex flex-col justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-[#9A7B3C] font-medium">
                    {project.emirate} · {project.community}
                  </p>
                  <h4 className="font-display text-xl font-semibold text-[#111827] mt-1">
                    {project.name}
                  </h4>
                  <p className="text-xs text-[#4B5563] mt-1">{project.developerName}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#E5E2DC]">
                  <div>
                    <span className="block text-[11px] text-[#6B7280]">From</span>
                    <span className="font-mono-tabular text-sm font-semibold text-[#111827]">
                      {formatProjectPrice(project.startingPriceAed, currency)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProject(project)}
                    className="px-3 py-1.5 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] transition-colors"
                  >
                    Open Project
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`grid grid-cols-1 lg:grid-cols-4 ${isFullscreen ? 'flex-1 min-h-0' : 'h-[580px]'}`}>
          {/* Map Container */}
          <div className="lg:col-span-3 relative h-[420px] lg:h-full bg-[#EFECE6]">
            {mapsApiKey ? (
              <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en" region="AE">
                <GoogleMap
                  key={`${selectedEmirate}-${camera.zoom}`}
                  defaultCenter={{ lat: camera.lat, lng: camera.lng }}
                  defaultZoom={camera.zoom}
                  mapId="DEMO_MAP_ID"
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
                      <div className="p-2 max-w-[260px] text-[#111827]">
                        <p className="text-[11px] font-semibold text-[#9A7B3C] uppercase">
                          {activeProject.emirate} · {activeProject.community}
                        </p>
                        <h4 className="font-semibold text-sm mt-0.5">{activeProject.name}</h4>
                        <p className="text-xs text-[#4B5563] mt-0.5">{activeProject.developerName}</p>
                        <p className="font-mono-tabular text-xs font-semibold mt-2">
                          {activeProject.startingPriceAed > 0
                            ? `From ${formatProjectPrice(activeProject.startingPriceAed, currency)}`
                            : 'Price on Request'}
                        </p>
                        <p className="text-[11px] text-[#4B5563] mt-1">
                          {activeProject.inventory.status === 'verified_live' &&
                          activeProject.inventory.availableUnits !== null
                            ? `Available: ${activeProject.inventory.availableUnits} / ${activeProject.inventory.totalRegisteredUnits} units`
                            : 'Inventory update unavailable'}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenProject(activeProject)}
                            className="px-3 py-1.5 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C]"
                          >
                            View Full Project
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${activeProject.coordinates.lat},${activeProject.coordinates.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 border border-[#E5E2DC] text-xs text-[#111827] hover:border-[#9A7B3C] flex items-center gap-1"
                          >
                            <Navigation className="w-3 h-3" />
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
              <div className="w-full h-full flex flex-col justify-between p-6 bg-gradient-to-br from-[#F3F1EC] to-[#E5E2DC]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#9A7B3C] uppercase tracking-wider">
                      UAE Geospatial Project Explorer
                    </p>
                    <p className="text-xs text-[#4B5563] mt-0.5">
                      Select any Emirates pin below to inspect pricing, live inventory, or launch Google Maps directions.
                    </p>
                  </div>
                </div>
                <div className="relative flex-1 my-4 border border-[#D4CFC4] bg-white/80 overflow-hidden">
                  {filteredProjects.map((proj) => {
                    const leftPct = Math.min(90, Math.max(8, ((proj.coordinates.lng - 54.3) / 2.2) * 84 + 8));
                    const topPct = Math.min(88, Math.max(10, 90 - ((proj.coordinates.lat - 24.3) / 1.55) * 80));
                    const selected = activeProject?.id === proj.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setActiveProject(proj)}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-mono-tabular font-semibold border transition-transform ${
                          selected
                            ? 'bg-[#9A7B3C] text-white border-[#111827] z-20 scale-110'
                            : 'bg-[#111827] text-white border-[#9A7B3C] hover:bg-[#9A7B3C] z-10'
                        }`}
                      >
                        {proj.emirate.slice(0, 3).toUpperCase()} · {formatProjectPrice(proj.startingPriceAed, currency, true)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Nearby & Selected Project Sidebar */}
          <aside className="border-t lg:border-t-0 lg:border-l border-[#E5E2DC] bg-white overflow-y-auto p-4 flex flex-col gap-3">
            {activeProject ? (
              <div className="border border-[#9A7B3C] bg-[#FAF9F6] p-4">
                <p className="text-[11px] font-semibold text-[#9A7B3C] uppercase">
                  Selected Development
                </p>
                <h4 className="font-display text-xl font-semibold text-[#111827] mt-1">
                  {activeProject.name}
                </h4>
                <p className="text-xs text-[#4B5563] mt-0.5">
                  {activeProject.community}, {activeProject.emirate}
                </p>
                <p className="font-mono-tabular text-sm font-semibold text-[#111827] mt-3">
                  {formatProjectPrice(activeProject.startingPriceAed, currency)}
                </p>
                <p className="text-xs text-[#4B5563] mt-1">
                  {activeProject.inventory.status === 'verified_live'
                    ? `${activeProject.inventory.availableUnits} units available`
                    : 'Inventory update unavailable'}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProject(activeProject)}
                    className="w-full py-2 bg-[#111827] text-white text-xs font-medium hover:bg-[#9A7B3C] transition-colors"
                  >
                    Open Complete Project Page
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${activeProject.coordinates.lat},${activeProject.coordinates.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 border border-[#E5E2DC] text-xs font-medium text-[#111827] hover:border-[#9A7B3C] flex items-center justify-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Navigate via Google Maps</span>
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#6B7280]">
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
                      ? 'border-[#9A7B3C] bg-[#FAF9F6]'
                      : 'border-[#E5E2DC] hover:border-[#9A7B3C]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#111827] truncate">
                      {project.name}
                    </span>
                    <span className="font-mono-tabular text-xs font-medium text-[#9A7B3C] shrink-0">
                      {formatProjectPrice(project.startingPriceAed, currency, true)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
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
