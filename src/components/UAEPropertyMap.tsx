import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Crosshair,
  ExternalLink,
  FileSpreadsheet,
  Layers,
  List,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Search,
  X,
} from 'lucide-react';
import { CurrencyCode, EmiratesName, Project } from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import {
  formatPropertyAreaSqFt,
  formatPropertyBhk,
} from '../utils/propertySpecs.ts';
import {
  clusterProjectsForMap,
  EMIRATE_MAP_CENTERS,
  haversineDistanceKm,
  isValidCoordinate,
  LatLng,
  ProjectMapCluster,
} from '../utils/coordinates.ts';
import { geocodeAddressOnServer, GeocodeResultItem } from '../services/apiClient.ts';
import { GoogleMapsGuard } from './GoogleMapsGuard.tsx';

interface UAEPropertyMapProps {
  projects: Project[];
  mapsApiKey: string;
  currency: CurrencyCode;
  onOpenProject: (project: Project) => void;
  onRequestAvailabilitySheet?: (project: Project) => void;
}

type AdvancedMarkerRefType = NonNullable<ReturnType<typeof useAdvancedMarkerRef>[1]>;

const MapViewportController: React.FC<{
  targetCenter: LatLng;
  targetZoom: number;
  targetToken: number;
  onZoomChange: (zoom: number) => void;
}> = ({ targetCenter, targetZoom, targetToken, onZoomChange }) => {
  const map = useMap();
  const lastTokenRef = useRef(-1);

  useEffect(() => {
    if (!map) return;
    if (lastTokenRef.current === targetToken) return;
    lastTokenRef.current = targetToken;
    map.panTo(targetCenter);
    map.setZoom(targetZoom);
  }, [map, targetCenter, targetZoom, targetToken]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('zoom_changed', () => {
      const z = map.getZoom();
      if (typeof z === 'number') onZoomChange(z);
    });
    return () => listener.remove();
  }, [map, onZoomChange]);

  return (
    <button
      type="button"
      onClick={() => {
        if (!map) return;
        map.panTo(targetCenter);
        map.setZoom(targetZoom);
      }}
      className="absolute bottom-3 left-3 z-10 h-9 px-3 bg-[#080808]/90 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer"
    >
      <Crosshair className="w-3.5 h-3.5 text-[#D4AF72]" />
      <span>Recenter View</span>
    </button>
  );
};

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
      zIndex={isSelected ? 1000 : 20}
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

const ClusterAdvancedMarker: React.FC<{
  cluster: ProjectMapCluster;
  currency: CurrencyCode;
  onExpand: (cluster: ProjectMapCluster) => void;
}> = ({ cluster, currency, onExpand }) => {
  return (
    <AdvancedMarker
      position={cluster.center}
      title={`${cluster.projects.length} developments in area`}
      zIndex={15}
      onClick={() => onExpand(cluster)}
    >
      <div className="px-2.5 py-1.5 bg-[#121212]/95 border-2 border-[#D4AF72] text-[#F5F1E8] shadow-xl cursor-pointer hover:bg-[#D4AF72] hover:text-[#080808] transition-colors flex items-center gap-1.5 whitespace-nowrap">
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 bg-[#D4AF72] text-[#080808] text-[11px] font-mono-tabular font-bold">
          {cluster.projects.length}
        </span>
        <span className="text-[11px] font-mono-tabular font-semibold">
          {cluster.minPriceAed > 0
            ? `From ${formatProjectPrice(cluster.minPriceAed, currency, true)}`
            : 'Projects'}
        </span>
      </div>
    </AdvancedMarker>
  );
};

export const UAEPropertyMap: React.FC<UAEPropertyMapProps> = ({
  projects,
  mapsApiKey,
  currency,
  onOpenProject,
  onRequestAvailabilitySheet,
}) => {
  const [selectedEmirate, setSelectedEmirate] = useState<'All UAE' | EmiratesName>('All UAE');
  const [selectedCommunity, setSelectedCommunity] = useState<string>('All');
  const [maxBudgetAed, setMaxBudgetAed] = useState<number>(150000000);
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [locationQuery, setLocationQuery] = useState('');
  const [geocodingBusy, setGeocodingBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [searchedLocation, setSearchedLocation] = useState<GeocodeResultItem | null>(null);

  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(EMIRATE_MAP_CENTERS['All UAE'].zoom);
  const [cameraCommand, setCameraCommand] = useState<{
    center: LatLng;
    zoom: number;
    token: number;
  }>({
    center: { lat: EMIRATE_MAP_CENTERS['All UAE'].lat, lng: EMIRATE_MAP_CENTERS['All UAE'].lng },
    zoom: EMIRATE_MAP_CENTERS['All UAE'].zoom,
    token: 0,
  });

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeMarker, setActiveMarker] = useState<AdvancedMarkerRefType | null>(null);

  const panToCamera = useCallback((center: LatLng, zoom: number) => {
    setCurrentZoom(zoom);
    setCameraCommand((prev) => ({ center, zoom, token: prev.token + 1 }));
  }, []);

  const availableCommunities = useMemo(() => {
    const base =
      selectedEmirate === 'All UAE'
        ? projects
        : projects.filter((p) => p.emirate === selectedEmirate);
    return Array.from(new Set(base.map((p) => p.community).filter(Boolean))).sort();
  }, [projects, selectedEmirate]);

  const filteredProjects = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (selectedEmirate !== 'All UAE' && p.emirate !== selectedEmirate) return false;
      if (selectedCommunity !== 'All' && p.community !== selectedCommunity) return false;
      if (p.startingPriceAed > maxBudgetAed) return false;
      if (propertyTypeFilter !== 'All' && !p.propertyTypes.includes(propertyTypeFilter as never)) {
        return false;
      }
      // Filter by text only when not actively using a geocode coordinate focus
      if (q && !searchedLocation) {
        const hay = `${p.name} ${p.community} ${p.neighbourhood || ''} ${p.emirate} ${p.developerName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (searchedLocation) {
      return [...list].sort((a, b) => {
        const da = isValidCoordinate(a.coordinates)
          ? haversineDistanceKm(searchedLocation, a.coordinates)
          : 99999;
        const db = isValidCoordinate(b.coordinates)
          ? haversineDistanceKm(searchedLocation, b.coordinates)
          : 99999;
        return da - db;
      });
    }
    return list;
  }, [
    projects,
    selectedEmirate,
    selectedCommunity,
    maxBudgetAed,
    propertyTypeFilter,
    locationQuery,
    searchedLocation,
  ]);

  const mappableProjects = useMemo(
    () => filteredProjects.filter((p) => isValidCoordinate(p.coordinates)),
    [filteredProjects]
  );
  const missingCoordCount = filteredProjects.length - mappableProjects.length;

  const mapClusters = useMemo(
    () => clusterProjectsForMap(mappableProjects, currentZoom),
    [mappableProjects, currentZoom]
  );

  const handleEmirateChange = (nextEmirate: 'All UAE' | EmiratesName) => {
    setSelectedEmirate(nextEmirate);
    setSelectedCommunity('All');
    setSearchedLocation(null);
    setGeocodeError(null);
    setActiveProject(null);
    setActiveMarker(null);
    const preset = EMIRATE_MAP_CENTERS[nextEmirate];
    panToCamera({ lat: preset.lat, lng: preset.lng }, preset.zoom);
  };

  const handleCommunityChange = (nextCommunity: string) => {
    setSelectedCommunity(nextCommunity);
    setSearchedLocation(null);
    setGeocodeError(null);
    setActiveProject(null);
    setActiveMarker(null);
    if (nextCommunity === 'All') {
      const preset = EMIRATE_MAP_CENTERS[selectedEmirate];
      panToCamera({ lat: preset.lat, lng: preset.lng }, preset.zoom);
      return;
    }
    const matching = projects.filter(
      (p) =>
        (selectedEmirate === 'All UAE' || p.emirate === selectedEmirate) &&
        p.community === nextCommunity &&
        isValidCoordinate(p.coordinates)
    );
    if (matching.length > 0) {
      const avgLat = matching.reduce((s, p) => s + p.coordinates.lat, 0) / matching.length;
      const avgLng = matching.reduce((s, p) => s + p.coordinates.lng, 0) / matching.length;
      panToCamera({ lat: avgLat, lng: avgLng }, 13);
    }
  };

  const handleGeocodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = locationQuery.trim();
    if (q.length < 2) return;
    setGeocodeError(null);
    setGeocodingBusy(true);
    try {
      const res = await geocodeAddressOnServer(q, 'ae');
      setSearchedLocation(res.primary);
      setActiveProject(null);
      setActiveMarker(null);
      panToCamera({ lat: res.primary.lat, lng: res.primary.lng }, 13);
    } catch (err) {
      // Fall back to centroid of matching projects if geocoding fails or quota exceeded
      const localMatch = projects.filter(
        (p) =>
          isValidCoordinate(p.coordinates) &&
          `${p.name} ${p.community} ${p.emirate}`.toLowerCase().includes(q.toLowerCase())
      );
      if (localMatch.length > 0) {
        const target = localMatch[0];
        setActiveProject(target);
        panToCamera(target.coordinates, 13);
        setGeocodeError(null);
      } else {
        setGeocodeError(
          err instanceof Error ? err.message : 'Unable to locate this UAE area or address.'
        );
      }
    } finally {
      setGeocodingBusy(false);
    }
  };

  const handleMarkerSelect = useCallback(
    (project: Project, marker: AdvancedMarkerRefType) => {
      setActiveProject(project);
      setActiveMarker(marker);
    },
    []
  );

  const handleClusterExpand = useCallback(
    (cluster: ProjectMapCluster) => {
      const nextZoom = Math.min(15, Math.max(currentZoom + 3, 12));
      panToCamera(cluster.center, nextZoom);
    },
    [currentZoom, panToCamera]
  );

  const handleSelectProjectFromSidebar = (project: Project) => {
    setActiveProject(project);
    setActiveMarker(null);
    if (isValidCoordinate(project.coordinates)) {
      panToCamera(project.coordinates, 14);
    }
  };

  const handleCloseInfo = useCallback(() => {
    setActiveProject(null);
    setActiveMarker(null);
  }, []);

  const renderAvailabilitySummary = (proj: Project) => {
    if (proj.inventory.status === 'verified_live' && proj.inventory.availableUnits !== null) {
      return (
        <span className="text-[#6EE7B7] font-semibold">
          {proj.inventory.availableUnits} / {proj.inventory.totalRegisteredUnits ?? 'Verified'} units
          available
        </span>
      );
    }
    return (
      <span className="text-[#D4AF72] font-medium">
        Contact Developer for Latest Availability
      </span>
    );
  };

  return (
    <div
      className={`bg-[#121212] border border-[#D4AF72]/25 ${
        isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'relative'
      }`}
    >
      {/* Map Control & Filter Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#D4AF72]/20 bg-[#1B1B1B] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="xs:col-span-2 sm:col-span-1 flex items-center gap-1.5 text-xs font-semibold text-[#F5F1E8] uppercase tracking-wider">
              <Layers className="w-4 h-4 text-[#D4AF72] shrink-0" />
              <span>UAE Explorer ({filteredProjects.length})</span>
            </div>

            <select
              value={selectedEmirate}
              onChange={(e) => handleEmirateChange(e.target.value as 'All UAE' | EmiratesName)}
              aria-label="Zoom to Emirate"
              className="w-full sm:w-auto min-w-0 h-9 px-3 bg-[#121212] border border-[#D4AF72]/25 text-xs font-medium text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            >
              {Object.keys(EMIRATE_MAP_CENTERS).map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))}
            </select>

            <select
              value={selectedCommunity}
              onChange={(e) => handleCommunityChange(e.target.value)}
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

        {/* Location Search & Geocoding Row */}
        <form
          onSubmit={handleGeocodeSearch}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-[#D4AF72]/15"
        >
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-[#D4AF72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value);
                if (!e.target.value.trim()) {
                  setSearchedLocation(null);
                  setGeocodeError(null);
                }
              }}
              placeholder="Search UAE address, landmark, community, or project (e.g. Dubai Marina, Yas Island)..."
              aria-label="Search UAE property location or address"
              className="w-full h-9 pl-9 pr-8 bg-[#121212] border border-[#D4AF72]/25 text-xs text-[#F5F1E8] placeholder:text-[#A5A19A]/70 focus:outline-none focus:border-[#D4AF72]"
            />
            {locationQuery && (
              <button
                type="button"
                aria-label="Clear location search"
                onClick={() => {
                  setLocationQuery('');
                  setSearchedLocation(null);
                  setGeocodeError(null);
                  const preset = EMIRATE_MAP_CENTERS[selectedEmirate];
                  panToCamera({ lat: preset.lat, lng: preset.lng }, preset.zoom);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A5A19A] hover:text-[#F5F1E8]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={geocodingBusy || locationQuery.trim().length < 2}
            className="h-9 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {geocodingBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MapPin className="w-3.5 h-3.5" />
            )}
            <span>Locate Area</span>
          </button>
          {searchedLocation && (
            <span className="text-[11px] text-[#6EE7B7] font-medium truncate max-w-xs">
              Focused: {searchedLocation.formattedAddress}
            </span>
          )}
          {geocodeError && (
            <span className="text-[11px] text-[#FCA5A5] font-medium">{geocodeError}</span>
          )}
          {missingCoordCount > 0 && (
            <span className="text-[11px] text-[#FCD34D] flex items-center gap-1 shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{missingCoordCount} missing GPS</span>
            </span>
          )}
        </form>
      </div>

      {/* Main Viewport */}
      {viewMode === 'list' ? (
        <div
          className={`overflow-y-auto p-4 sm:p-6 bg-[#080808] ${isFullscreen ? 'flex-1' : 'h-[580px]'}`}
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
                  <p className="text-[11px] mt-2">{renderAvailabilitySummary(project)}</p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#D4AF72]/15">
                  <div>
                    <span className="block text-[11px] text-[#A5A19A]">From</span>
                    <span className="font-mono-tabular text-sm font-semibold text-[#F5F1E8]">
                      {formatProjectPrice(project.startingPriceAed, currency)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onRequestAvailabilitySheet && project.inventory.status !== 'verified_live' && (
                      <button
                        type="button"
                        onClick={() => onRequestAvailabilitySheet(project)}
                        className="px-2.5 py-1.5 border border-[#D4AF72]/35 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72]"
                      >
                        Sheet
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenProject(project)}
                      className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
                    >
                      Open Project
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 lg:grid-cols-4 ${
            isFullscreen ? 'flex-1 min-h-0' : 'h-auto lg:h-[620px]'
          }`}
        >
          {/* Map Container */}
          <div
            className={`lg:col-span-3 relative min-w-0 bg-[#080808] ${
              isFullscreen ? 'h-[48dvh] lg:h-full' : 'h-[340px] sm:h-[440px] lg:h-full'
            }`}
          >
            {mapsApiKey && !mapUnavailable ? (
              <APIProvider apiKey={mapsApiKey} libraries={['marker']} language="en">
                <GoogleMapsGuard onStatusError={() => setMapUnavailable(true)}>
                  <div className="w-full h-full relative">
                    <GoogleMap
                      defaultCenter={cameraCommand.center}
                      defaultZoom={cameraCommand.zoom}
                      mapId="DEMO_MAP_ID"
                      colorScheme="DARK"
                      zoomControl={true}
                      mapTypeControl={true}
                      streetViewControl={true}
                      fullscreenControl={false}
                      gestureHandling="greedy"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <MapViewportController
                        targetCenter={cameraCommand.center}
                        targetZoom={cameraCommand.zoom}
                        targetToken={cameraCommand.token}
                        onZoomChange={setCurrentZoom}
                      />

                      {searchedLocation && (
                        <AdvancedMarker
                          position={{ lat: searchedLocation.lat, lng: searchedLocation.lng }}
                          title={searchedLocation.formattedAddress}
                          zIndex={1500}
                        >
                          <div className="px-2.5 py-1 bg-[#F5F1E8] text-[#080808] text-[11px] font-semibold border-2 border-[#D4AF72] shadow-xl flex items-center gap-1 whitespace-nowrap">
                            <MapPin className="w-3 h-3 text-[#080808]" />
                            <span>Search Area</span>
                          </div>
                        </AdvancedMarker>
                      )}

                      {mapClusters.map((cluster) =>
                        cluster.projects.length === 1 ? (
                          <ProjectAdvancedMarker
                            key={cluster.projects[0].id}
                            project={cluster.projects[0]}
                            currency={currency}
                            isSelected={activeProject?.id === cluster.projects[0].id}
                            onSelect={handleMarkerSelect}
                          />
                        ) : (
                          <ClusterAdvancedMarker
                            key={cluster.id}
                            cluster={cluster}
                            currency={currency}
                            onExpand={handleClusterExpand}
                          />
                        )
                      )}

                      {activeProject && activeMarker && isValidCoordinate(activeProject.coordinates) && (
                        <InfoWindow anchor={activeMarker} onCloseClick={handleCloseInfo}>
                          <div className="p-3 max-w-[280px] bg-[#121212] text-[#F5F1E8]">
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
                            <p className="text-[11px] text-[#D4AF72]/90 mt-1 break-words">
                              {formatPropertyBhk(activeProject)} | {formatPropertyAreaSqFt(activeProject)}
                            </p>
                            <p className="text-[11px] mt-1">{renderAvailabilitySummary(activeProject)}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onOpenProject(activeProject)}
                                className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A]"
                              >
                                View Full Project
                              </button>
                              {onRequestAvailabilitySheet &&
                                activeProject.inventory.status !== 'verified_live' && (
                                  <button
                                    type="button"
                                    onClick={() => onRequestAvailabilitySheet(activeProject)}
                                    className="px-2.5 py-1.5 border border-[#D4AF72]/40 text-xs text-[#F5F1E8] hover:border-[#D4AF72]"
                                  >
                                    Sheet
                                  </button>
                                )}
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
                  </div>
                </GoogleMapsGuard>
              </APIProvider>
            ) : (
              /* Full-UAE Geographic Coordinate Fallback when Maps key is absent or quota exceeded */
              <div className="w-full h-full flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-br from-[#080808] to-[#121212]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#D4AF72] uppercase tracking-[0.18em]">
                      UAE Geospatial Coordinate Mode ({mappableProjects.length} Pins)
                    </p>
                    <p className="text-xs text-[#A5A19A] mt-0.5">
                      Interactive coordinates across all 7 Emirates. Select any pin to inspect live
                      availability or launch turn-by-turn Google Maps routes.
                    </p>
                  </div>
                </div>
                <div className="relative flex-1 my-3 border border-[#D4AF72]/25 bg-[#121212] overflow-hidden min-h-[200px]">
                  {mappableProjects.slice(0, 80).map((proj) => {
                    // Full UAE bounding projection: lng 51.5..56.5, lat 22.8..26.2
                    const leftPct = Math.min(
                      94,
                      Math.max(6, ((proj.coordinates.lng - 51.5) / 5.0) * 88 + 6)
                    );
                    const topPct = Math.min(
                      92,
                      Math.max(8, 92 - ((proj.coordinates.lat - 22.8) / 3.4) * 84)
                    );
                    const selected = activeProject?.id === proj.id;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => setActiveProject(proj)}
                        style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-mono-tabular font-semibold border transition-transform ${
                          selected
                            ? 'bg-[#D4AF72] text-[#080808] border-[#F5F1E8] z-20 scale-110'
                            : 'bg-[#080808]/90 text-[#F5F1E8] border-[#D4AF72]/60 hover:bg-[#D4AF72] hover:text-[#080808] z-10'
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
          <aside className="border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#121212] overflow-y-auto p-4 flex flex-col gap-3 max-h-[360px] lg:max-h-none lg:h-full min-w-0">
            {activeProject ? (
              <div className="border border-[#D4AF72]/50 bg-[#1B1B1B] p-4 space-y-2">
                {activeProject.heroImage && (
                  <img
                    src={activeProject.heroImage}
                    alt={activeProject.name}
                    className="w-full h-28 object-cover mb-2 border border-[#D4AF72]/20"
                  />
                )}
                <p className="text-[11px] font-semibold text-[#D4AF72] uppercase tracking-wider">
                  Selected Development
                </p>
                <h4 className="font-display text-xl font-medium text-[#F5F1E8]">
                  {activeProject.name}
                </h4>
                <p className="text-xs text-[#A5A19A]">
                  {activeProject.community}, {activeProject.emirate}
                </p>
                {isValidCoordinate(activeProject.coordinates) ? (
                  <p className="text-[10px] font-mono-tabular text-[#A5A19A]">
                    GPS: {activeProject.coordinates.lat.toFixed(4)}° N,{' '}
                    {activeProject.coordinates.lng.toFixed(4)}° E
                  </p>
                ) : (
                  <p className="text-[11px] text-[#FCA5A5]">GPS coordinates missing</p>
                )}
                <p className="font-mono-tabular text-sm font-semibold text-[#F5F1E8] pt-1">
                  {formatProjectPrice(activeProject.startingPriceAed, currency)}
                </p>
                {currency !== 'INR' && activeProject.startingPriceAed > 0 && (
                  <p className="font-mono-tabular text-[11px] text-[#D4AF72]">
                    ≈ {formatCurrency(activeProject.startingPriceAed, 'INR')}
                  </p>
                )}
                <p className="text-[11px] text-[#A5A19A]">
                  {formatPropertyBhk(activeProject)} | {formatPropertyAreaSqFt(activeProject)}
                </p>
                <p className="text-xs pt-0.5">{renderAvailabilitySummary(activeProject)}</p>
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProject(activeProject)}
                    className="w-full py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
                  >
                    Open Complete Project Page
                  </button>
                  {onRequestAvailabilitySheet &&
                    activeProject.inventory.status !== 'verified_live' && (
                      <button
                        type="button"
                        onClick={() => onRequestAvailabilitySheet(activeProject)}
                        className="w-full py-2 bg-[#121212] border border-[#D4AF72]/40 text-xs font-semibold text-[#F5F1E8] hover:border-[#D4AF72] flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#D4AF72]" />
                        <span>Request Availability Sheet</span>
                      </button>
                    )}
                  {isValidCoordinate(activeProject.coordinates) && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${activeProject.coordinates.lat},${activeProject.coordinates.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 border border-[#D4AF72]/30 text-xs font-medium text-[#F5F1E8] hover:border-[#D4AF72] flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#D4AF72]" />
                      <span>Navigate via Google Maps</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#A5A19A]">
                Click any map cluster or pin to inspect pricing, unit configurations, availability,
                and route directions.
              </p>
            )}

            <div className="space-y-2">
              {filteredProjects.map((project) => {
                const distKm =
                  searchedLocation && isValidCoordinate(project.coordinates)
                    ? haversineDistanceKm(searchedLocation, project.coordinates)
                    : null;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelectProjectFromSidebar(project)}
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
                    <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-[#A5A19A]">
                      <span className="truncate">
                        {project.emirate} · {project.community}
                      </span>
                      {distKm !== null && (
                        <span className="font-mono-tabular text-[#6EE7B7] shrink-0">
                          {distKm.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#D4AF72]/80 mt-1 truncate">
                      {formatPropertyBhk(project)} · {formatPropertyAreaSqFt(project)}
                    </p>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
