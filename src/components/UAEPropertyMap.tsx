import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Minus,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { CurrencyCode, EmiratesName, Project } from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';
import {
  formatCleanLocation,
  formatPropertyAreaSqFt,
  formatPropertyBhk,
} from '../utils/propertySpecs.ts';
import {
  clusterProjectsForMap,
  EMIRATE_MAP_CENTERS,
  getGoogleMapsDirectionsUrl,
  haversineDistanceKm,
  isValidCoordinate,
  LatLng,
  projectLatLngToGeoSvg,
  ProjectMapCluster,
  UAE_ALL_EMIRATES,
  UAE_EMIRATE_BORDER_LINES,
  UAE_GEO_SVG_BOUNDS,
  UAE_LANDMASS_OUTLINE_COORDS,
  UAE_METRO_BOUNDS,
} from '../utils/coordinates.ts';
import { geocodeAddressOnServer, GeocodeResultItem } from '../services/apiClient.ts';
import { GoogleMapsGuard, MapsErrorReason } from './GoogleMapsGuard.tsx';

interface UAEPropertyMapProps {
  projects: Project[];
  mapsApiKey: string;
  mapsLoading?: boolean;
  currency: CurrencyCode;
  onOpenProject: (project: Project) => void;
  onRequestAvailabilitySheet?: (project: Project) => void;
  onRetryMapsConfig?: () => void;
}

type AdvancedMarkerRefType = NonNullable<ReturnType<typeof useAdvancedMarkerRef>[1]>;

interface CameraCommand {
  mode: 'bounds' | 'point';
  bounds?: { south: number; west: number; north: number; east: number };
  center: LatLng;
  zoom: number;
  token: number;
}

const MapViewportController: React.FC<{
  cameraCommand: CameraCommand;
  currentZoom: number;
  onZoomChange: (zoom: number) => void;
  onResetAllUae: () => void;
}> = ({ cameraCommand, currentZoom, onZoomChange, onResetAllUae }) => {
  const map = useMap();
  const lastTokenRef = useRef(-1);

  useEffect(() => {
    if (!map) return;
    if (lastTokenRef.current === cameraCommand.token) return;
    lastTokenRef.current = cameraCommand.token;

    if (cameraCommand.mode === 'bounds' && cameraCommand.bounds) {
      map.fitBounds(cameraCommand.bounds, { top: 44, right: 32, bottom: 44, left: 32 });
    } else {
      map.panTo(cameraCommand.center);
      map.setZoom(cameraCommand.zoom);
    }
  }, [map, cameraCommand]);

  useEffect(() => {
    if (!map) return;
    const idleListener = map.addListener('idle', () => {
      const z = map.getZoom();
      if (typeof z === 'number') onZoomChange(z);
    });
    return () => idleListener.remove();
  }, [map, onZoomChange]);

  const handleZoomStep = (delta: number) => {
    if (!map) return;
    const z = map.getZoom() ?? currentZoom;
    const next = Math.max(6, Math.min(19, Math.round(z) + delta));
    map.setZoom(next);
  };

  const handleRecenter = () => {
    if (!map) return;
    if (cameraCommand.mode === 'bounds' && cameraCommand.bounds) {
      map.fitBounds(cameraCommand.bounds, { top: 44, right: 32, bottom: 44, left: 32 });
    } else {
      map.panTo(cameraCommand.center);
      map.setZoom(cameraCommand.zoom);
    }
  };

  return (
    <div className="absolute bottom-7 left-2.5 max-w-[calc(100%-20px)] z-10 flex flex-wrap items-center gap-1.5">
      <div className="flex items-center border border-[#D4AF72]/45 bg-[#080808]/95 shadow-lg">
        <button
          type="button"
          onClick={() => handleZoomStep(1)}
          aria-label="Zoom in map"
          title="Zoom in"
          className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-[#F5F1E8] hover:bg-[#D4AF72] hover:text-[#080808] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 h-8 sm:h-9 flex items-center text-[11px] font-mono-tabular text-[#D4AF72] border-x border-[#D4AF72]/25 select-none">
          Z{Math.round(currentZoom)}
        </span>
        <button
          type="button"
          onClick={() => handleZoomStep(-1)}
          aria-label="Zoom out map"
          title="Zoom out"
          className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-[#F5F1E8] hover:bg-[#D4AF72] hover:text-[#080808] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onResetAllUae}
        className="h-8 sm:h-9 px-2.5 sm:px-3 bg-[#080808]/95 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
      >
        <MapIcon className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
        <span>All Active Emirates</span>
      </button>

      <button
        type="button"
        onClick={handleRecenter}
        className="h-8 sm:h-9 px-2.5 sm:px-3 bg-[#080808]/95 border border-[#D4AF72]/45 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 shadow-lg cursor-pointer whitespace-nowrap"
      >
        <Crosshair className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
        <span className="hidden xs:inline">Recenter</span>
      </button>
    </div>
  );
};

interface MarkerItemProps {
  project: Project;
  currency: CurrencyCode;
  isSelected: boolean;
  onSelect: (project: Project, marker: AdvancedMarkerRefType) => void;
  onMountRef: (projectId: string, marker: AdvancedMarkerRefType | null) => void;
}

const ProjectAdvancedMarker: React.FC<MarkerItemProps> = ({
  project,
  currency,
  isSelected,
  onSelect,
  onMountRef,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  useEffect(() => {
    onMountRef(project.id, marker);
    return () => {
      onMountRef(project.id, null);
    };
  }, [project.id, marker, onMountRef]);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={project.coordinates}
      title={`${project.name} · ${formatCleanLocation(project.community, project.emirate)}`}
      zIndex={isSelected ? 1200 : 25}
      collisionBehavior={
        isSelected
          ? CollisionBehavior.REQUIRED
          : CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY
      }
      onClick={() => {
        if (marker) {
          onSelect(project, marker);
        }
      }}
    >
      <div
        className={`px-2.5 py-1 text-[11px] font-mono-tabular font-semibold border transition-transform duration-150 shadow-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5 ltr-isolate ${
          isSelected
            ? 'bg-[#D4AF72] text-[#080808] border-[#F5F1E8] scale-110'
            : 'bg-[#080808]/95 text-[#F5F1E8] border-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808]'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            isSelected ? 'bg-[#080808]' : 'bg-[#D4AF72]'
          }`}
        />
        <span>{formatProjectPrice(project.startingPriceAed, currency, true)}</span>
      </div>
    </AdvancedMarker>
  );
};

const ClusterAdvancedMarker: React.FC<{
  cluster: ProjectMapCluster;
  currency: CurrencyCode;
  isActive: boolean;
  onExpand: (cluster: ProjectMapCluster, marker: AdvancedMarkerRefType) => void;
}> = ({ cluster, currency, isActive, onExpand }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      position={cluster.center}
      title={`${cluster.projects.length} developments in area — click to zoom or inspect`}
      zIndex={isActive ? 1100 : 40}
      collisionBehavior={CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL}
      onClick={() => {
        if (marker) {
          onExpand(cluster, marker);
        }
      }}
    >
      <div
        className={`px-2.5 py-1.5 border-2 shadow-xl cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
          isActive
            ? 'bg-[#D4AF72] border-[#F5F1E8] text-[#080808]'
            : 'bg-[#121212]/95 border-[#D4AF72] text-[#F5F1E8] hover:bg-[#D4AF72] hover:text-[#080808]'
        }`}
      >
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 bg-[#D4AF72] text-[#080808] text-[11px] font-mono-tabular font-bold border border-[#080808]/20">
          {cluster.projects.length}
        </span>
        <span className="text-[11px] font-mono-tabular font-semibold">
          {cluster.minPriceAed > 0
            ? `From ${formatProjectPrice(cluster.minPriceAed, currency, true)}`
            : `${cluster.projects.length} Projects`}
        </span>
      </div>
    </AdvancedMarker>
  );
};

const MAP_ERROR_COPY: Record<MapsErrorReason, { title: string; detail: string }> = {
  auth_failure: {
    title: 'Google Maps key authentication or referrer check failed',
    detail:
      'Live Google Maps tiles could not be authorized for this origin. Interactive UAE vector map & GPS routing remain active below.',
  },
  quota_exceeded: {
    title: 'Google Maps daily tile quota limit reached',
    detail:
      'Live tile rendering paused cleanly at the API quota threshold. Interactive UAE vector map & exact Google Maps Directions remain active.',
  },
  failed: {
    title: 'Unable to load Google Maps JavaScript SDK tiles',
    detail:
      'Network or script delivery failed while fetching map tiles. Check connectivity or click Retry Live Map.',
  },
};

export const UAEPropertyMap: React.FC<UAEPropertyMapProps> = ({
  projects,
  mapsApiKey,
  mapsLoading = false,
  currency,
  onOpenProject,
  onRequestAvailabilitySheet,
  onRetryMapsConfig,
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

  const [mapErrorReason, setMapErrorReason] = useState<MapsErrorReason | null>(null);
  const [mapRetryToken, setMapRetryToken] = useState(0);
  const [currentZoom, setCurrentZoom] = useState<number>(EMIRATE_MAP_CENTERS['All UAE'].zoom);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({
    mode: 'bounds',
    bounds: UAE_METRO_BOUNDS,
    center: { lat: EMIRATE_MAP_CENTERS['All UAE'].lat, lng: EMIRATE_MAP_CENTERS['All UAE'].lng },
    zoom: EMIRATE_MAP_CENTERS['All UAE'].zoom,
    token: 0,
  });

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeMarker, setActiveMarker] = useState<AdvancedMarkerRefType | null>(null);
  const [activeClusterState, setActiveClusterState] = useState<{
    cluster: ProjectMapCluster;
    anchor: AdvancedMarkerRefType;
  } | null>(null);

  // Vector fallback pan/zoom controls when Google Maps tiles fail or quota runs out
  const [fallbackZoomLevel, setFallbackZoomLevel] = useState<number>(1);
  const [fallbackFocus, setFallbackFocus] = useState<{ x: number; y: number }>({
    x: UAE_GEO_SVG_BOUNDS.width * 0.62,
    y: UAE_GEO_SVG_BOUNDS.height * 0.42,
  });
  const [activeFallbackCluster, setActiveFallbackCluster] = useState<ProjectMapCluster | null>(null);

  const [failedImgUrls, setFailedImgUrls] = useState<Set<string>>(() => new Set());
  const markersByIdRef = useRef<Record<string, AdvancedMarkerRefType | null>>({});
  const activeProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeProjectIdRef.current = activeProject?.id ?? null;
  }, [activeProject]);

  const markImgFailed = useCallback((url: string) => {
    setFailedImgUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const handleMarkerMount = useCallback((projectId: string, marker: AdvancedMarkerRefType | null) => {
    if (marker) {
      markersByIdRef.current[projectId] = marker;
      if (activeProjectIdRef.current === projectId) {
        setActiveMarker(marker);
      }
    } else {
      delete markersByIdRef.current[projectId];
    }
  }, []);

  const panToCamera = useCallback((center: LatLng, zoom: number) => {
    setCurrentZoom(zoom);
    setCameraCommand((prev) => ({
      mode: 'point',
      center,
      zoom,
      token: prev.token + 1,
    }));
  }, []);

  const fitBoundsCamera = useCallback(
    (bounds: { south: number; west: number; north: number; east: number }, approxZoom: number) => {
      setCurrentZoom(approxZoom);
      setCameraCommand((prev) => ({
        mode: 'bounds',
        bounds,
        center: {
          lat: (bounds.north + bounds.south) / 2,
          lng: (bounds.east + bounds.west) / 2,
        },
        zoom: approxZoom,
        token: prev.token + 1,
      }));
    },
    []
  );

  // Per-Emirate catalog counts across all 7 UAE Emirates (authentic counts only)
  const emirateCounts = useMemo(() => {
    const counts: Record<EmiratesName, number> = {
      'Abu Dhabi': 0,
      Dubai: 0,
      Sharjah: 0,
      Ajman: 0,
      'Umm Al Quwain': 0,
      'Ras Al Khaimah': 0,
      Fujairah: 0,
    };
    for (const p of projects) {
      if (p.emirate in counts) {
        counts[p.emirate] += 1;
      }
    }
    return counts;
  }, [projects]);

  const activeEmirates = useMemo(
    () => UAE_ALL_EMIRATES.filter((em) => (emirateCounts[em] ?? 0) > 0),
    [emirateCounts]
  );

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

  // Sync InfoWindow anchor whenever zooming un-clusters the selected sidebar project
  useEffect(() => {
    if (!activeProject) return;
    const mountedMarker = markersByIdRef.current[activeProject.id];
    if (mountedMarker && mountedMarker !== activeMarker) {
      setActiveMarker(mountedMarker);
    }
  }, [activeProject, activeMarker, mapClusters]);

  const handleEmirateChange = useCallback(
    (nextEmirate: 'All UAE' | EmiratesName) => {
      setSelectedEmirate(nextEmirate);
      setSelectedCommunity('All');
      setSearchedLocation(null);
      setGeocodeError(null);
      setActiveProject(null);
      setActiveMarker(null);
      setActiveClusterState(null);
      setActiveFallbackCluster(null);

      if (nextEmirate === 'All UAE') {
        fitBoundsCamera(UAE_METRO_BOUNDS, EMIRATE_MAP_CENTERS['All UAE'].zoom);
        setFallbackZoomLevel(1);
        setFallbackFocus({
          x: UAE_GEO_SVG_BOUNDS.width * 0.62,
          y: UAE_GEO_SVG_BOUNDS.height * 0.42,
        });
      } else {
        const preset = EMIRATE_MAP_CENTERS[nextEmirate];
        panToCamera({ lat: preset.lat, lng: preset.lng }, preset.zoom);
        const svgPt = projectLatLngToGeoSvg(preset);
        setFallbackFocus(svgPt);
        setFallbackZoomLevel(2.2);
      }
    },
    [fitBoundsCamera, panToCamera]
  );

  const handleCommunityChange = (nextCommunity: string) => {
    setSelectedCommunity(nextCommunity);
    setSearchedLocation(null);
    setGeocodeError(null);
    setActiveProject(null);
    setActiveMarker(null);
    setActiveClusterState(null);
    setActiveFallbackCluster(null);

    if (nextCommunity === 'All') {
      handleEmirateChange(selectedEmirate);
      return;
    }

    const matching = projects.filter(
      (p) =>
        (selectedEmirate === 'All UAE' || p.emirate === selectedEmirate) &&
        p.community === nextCommunity &&
        isValidCoordinate(p.coordinates)
    );
    if (matching.length === 1) {
      panToCamera(matching[0].coordinates, 15);
    } else if (matching.length > 1) {
      const lats = matching.map((p) => p.coordinates.lat);
      const lngs = matching.map((p) => p.coordinates.lng);
      fitBoundsCamera(
        {
          south: Math.min(...lats),
          north: Math.max(...lats),
          west: Math.min(...lngs),
          east: Math.max(...lngs),
        },
        14
      );
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
      setActiveClusterState(null);
      panToCamera({ lat: res.primary.lat, lng: res.primary.lng }, 13);
    } catch (err) {
      const localMatch = projects.filter(
        (p) =>
          isValidCoordinate(p.coordinates) &&
          `${p.name} ${p.community} ${p.emirate}`.toLowerCase().includes(q.toLowerCase())
      );
      if (localMatch.length > 0) {
        const target = localMatch[0];
        setActiveProject(target);
        panToCamera(target.coordinates, 15);
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
      setActiveClusterState(null);
      setActiveProject(project);
      setActiveMarker(marker);
    },
    []
  );

  const handleClusterExpand = useCallback(
    (cluster: ProjectMapCluster, clusterMarker: AdvancedMarkerRefType) => {
      setActiveProject(null);
      setActiveMarker(null);

      const lats = cluster.projects.map((p) => p.coordinates.lat);
      const lngs = cluster.projects.map((p) => p.coordinates.lng);
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      const west = Math.min(...lngs);
      const east = Math.max(...lngs);
      const spanDeg = Math.max(north - south, east - west);

      if (spanDeg > 0.0005 && currentZoom < 16) {
        setActiveClusterState(null);
        if (currentZoom < 13) {
          fitBoundsCamera({ south, west, north, east }, Math.min(16, Math.max(currentZoom + 3, 12)));
        } else {
          panToCamera(cluster.center, Math.min(17, currentZoom + 2));
        }
      } else {
        setActiveClusterState({ cluster, anchor: clusterMarker });
      }
    },
    [currentZoom, fitBoundsCamera, panToCamera]
  );

  const handleSelectProjectFromSidebar = (project: Project) => {
    setActiveClusterState(null);
    setActiveFallbackCluster(null);
    setActiveProject(project);
    if (isValidCoordinate(project.coordinates)) {
      const targetZoom = Math.max(currentZoom, 16);
      panToCamera(project.coordinates, targetZoom);
      const mountedMarker = markersByIdRef.current[project.id];
      setActiveMarker(mountedMarker || null);
      const svgPt = projectLatLngToGeoSvg(project.coordinates);
      setFallbackFocus(svgPt);
      setFallbackZoomLevel(2.8);
    }
  };

  const handleCloseInfo = useCallback(() => {
    setActiveProject(null);
    setActiveMarker(null);
    setActiveClusterState(null);
  }, []);

  const handleRetryLiveMap = () => {
    setMapErrorReason(null);
    setMapRetryToken((n) => n + 1);
    onRetryMapsConfig?.();
  };

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

  // Fallback SVG clusters computed from fallback zoom level
  const fallbackEffectiveZoom = Math.min(15, Math.max(8, Math.round(7 + fallbackZoomLevel * 2.2)));
  const fallbackClusters = useMemo(
    () => clusterProjectsForMap(mappableProjects, fallbackEffectiveZoom),
    [mappableProjects, fallbackEffectiveZoom]
  );

  const uaePolygonPoints = useMemo(
    () =>
      UAE_LANDMASS_OUTLINE_COORDS.map((c) => {
        const pt = projectLatLngToGeoSvg(c);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      }).join(' '),
    []
  );

  const svgViewBox = useMemo(() => {
    const w = UAE_GEO_SVG_BOUNDS.width / fallbackZoomLevel;
    const h = UAE_GEO_SVG_BOUNDS.height / fallbackZoomLevel;
    const x = Math.max(0, Math.min(UAE_GEO_SVG_BOUNDS.width - w, fallbackFocus.x - w / 2));
    const y = Math.max(0, Math.min(UAE_GEO_SVG_BOUNDS.height - h, fallbackFocus.y - h / 2));
    return `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }, [fallbackZoomLevel, fallbackFocus]);

  return (
    <div
      className={`bg-[#121212] border border-[#D4AF72]/25 ${
        isFullscreen ? 'fixed inset-0 z-50 flex flex-col' : 'relative'
      }`}
    >
      {/* Map Control & Filter Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#D4AF72]/20 bg-[#1B1B1B] space-y-3">
        {/* Active Emirates Geographic Quick-Select Strip */}
        <div
          aria-label="Filter and focus by UAE Emirate"
          className="flex flex-nowrap overflow-x-auto no-scrollbar sm:flex-wrap items-center gap-1.5 pb-2 border-b border-[#D4AF72]/15"
        >
          <button
            type="button"
            onClick={() => handleEmirateChange('All UAE')}
            className={`px-2.5 py-1.5 text-[11px] font-medium border whitespace-nowrap transition-colors shrink-0 ${
              selectedEmirate === 'All UAE'
                ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                : 'bg-[#121212] text-[#F5F1E8] border-[#D4AF72]/25 hover:border-[#D4AF72]'
            }`}
          >
            All Active Emirates (<span className="ltr-isolate">{projects.length}</span>)
          </button>
          {activeEmirates.map((em) => {
            const active = selectedEmirate === em;
            const count = emirateCounts[em] ?? 0;
            return (
              <button
                key={em}
                type="button"
                onClick={() => handleEmirateChange(em)}
                className={`px-2.5 py-1.5 text-[11px] font-medium border whitespace-nowrap transition-colors shrink-0 ${
                  active
                    ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72] font-semibold'
                    : 'bg-[#121212] text-[#A5A19A] border-[#D4AF72]/20 hover:border-[#D4AF72] hover:text-[#F5F1E8]'
                }`}
              >
                {em} (<span className="ltr-isolate">{count}</span>)
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="xs:col-span-2 sm:col-span-1 flex items-center gap-1.5 text-xs font-semibold text-[#F5F1E8] uppercase tracking-wider">
              <Layers className="w-4 h-4 text-[#D4AF72] shrink-0" />
              <span>UAE Explorer ({filteredProjects.length})</span>
            </div>

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
                  handleEmirateChange(selectedEmirate);
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
                    {formatCleanLocation(project.community, project.emirate)}
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
                    <span className="font-mono-tabular text-sm font-semibold text-[#F5F1E8] ltr-isolate">
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
              isFullscreen ? 'h-[50dvh] lg:h-full' : 'h-[380px] sm:h-[460px] lg:h-full'
            }`}
          >
            {mapsLoading && !mapsApiKey ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-[#080808] text-xs text-[#A5A19A]">
                <Loader2 className="w-6 h-6 animate-spin text-[#D4AF72]" />
                <span>Initializing interactive UAE Google Maps explorer...</span>
              </div>
            ) : mapsApiKey && !mapErrorReason ? (
              <APIProvider
                key={`uae-map-provider-${mapRetryToken}`}
                apiKey={mapsApiKey}
                libraries={['marker']}
                language="en"
                region="AE"
              >
                <GoogleMapsGuard
                  loadingLabel="Loading interactive UAE & Dubai map tiles..."
                  onStatusError={(reason) => setMapErrorReason(reason)}
                >
                  <div className="w-full h-full relative">
                    <GoogleMap
                      defaultCenter={cameraCommand.center}
                      defaultZoom={cameraCommand.zoom}
                      mapId="DEMO_MAP_ID"
                      colorScheme="DARK"
                      zoomControl={false}
                      mapTypeControl={true}
                      streetViewControl={false}
                      fullscreenControl={false}
                      gestureHandling="greedy"
                      onClick={handleCloseInfo}
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <MapViewportController
                        cameraCommand={cameraCommand}
                        currentZoom={currentZoom}
                        onZoomChange={setCurrentZoom}
                        onResetAllUae={() => handleEmirateChange('All UAE')}
                      />

                      {/* Regional labels across active Emirates when viewing full UAE */}
                      {selectedEmirate === 'All UAE' &&
                        currentZoom <= 10 &&
                        activeEmirates.map((em) => {
                          const center = EMIRATE_MAP_CENTERS[em];
                          const count = emirateCounts[em] ?? 0;
                          return (
                            <AdvancedMarker
                              key={`emirate-label-${em}`}
                              position={{ lat: center.lat, lng: center.lng }}
                              title={`${em} (${count} projects) — click to zoom`}
                              zIndex={5}
                              collisionBehavior={CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
                              onClick={() => handleEmirateChange(em)}
                            >
                              <div className="px-2 py-0.5 bg-[#1B1B1B]/85 border border-[#D4AF72]/45 text-[10px] font-semibold uppercase tracking-wider text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] shadow cursor-pointer whitespace-nowrap ltr-isolate">
                                {em} · {count}
                              </div>
                            </AdvancedMarker>
                          );
                        })}

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
                            onMountRef={handleMarkerMount}
                          />
                        ) : (
                          <ClusterAdvancedMarker
                            key={cluster.id}
                            cluster={cluster}
                            currency={currency}
                            isActive={activeClusterState?.cluster.id === cluster.id}
                            onExpand={handleClusterExpand}
                          />
                        )
                      )}

                      {/* Single Property Detail InfoWindow */}
                      {activeProject &&
                        activeMarker &&
                        isValidCoordinate(activeProject.coordinates) && (
                          <InfoWindow anchor={activeMarker} onCloseClick={handleCloseInfo}>
                            <div className="p-2.5 sm:p-3 w-[min(265px,calc(100vw-64px))] bg-[#121212] text-[#F5F1E8]">
                              {activeProject.heroImage &&
                                !failedImgUrls.has(activeProject.heroImage) && (
                                  <img
                                    src={activeProject.heroImage}
                                    alt={activeProject.name}
                                    referrerPolicy="no-referrer"
                                    onError={() => markImgFailed(activeProject.heroImage)}
                                    className="w-full h-24 object-cover mb-2 border border-[#D4AF72]/25"
                                  />
                                )}
                              <p className="text-[11px] font-semibold text-[#D4AF72] uppercase">
                                {formatCleanLocation(activeProject.community, activeProject.emirate)}
                              </p>
                              <h4 className="font-display font-medium text-base text-[#F5F1E8] mt-0.5">
                                {activeProject.name}
                              </h4>
                              <p className="text-xs text-[#A5A19A] mt-0.5">
                                {activeProject.developerName}
                              </p>
                              <p className="font-mono-tabular text-xs font-semibold text-[#F5F1E8] mt-2 ltr-isolate">
                                {activeProject.startingPriceAed > 0
                                  ? `From ${formatProjectPrice(activeProject.startingPriceAed, currency)}`
                                  : 'Price on Request'}
                              </p>
                              <p className="text-[11px] text-[#D4AF72]/90 mt-1 break-words ltr-isolate">
                                {formatPropertyBhk(activeProject)} |{' '}
                                {formatPropertyAreaSqFt(activeProject)}
                              </p>
                              <p className="text-[11px] mt-1">
                                {renderAvailabilitySummary(activeProject)}
                              </p>
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
                                  href={getGoogleMapsDirectionsUrl(
                                    activeProject.coordinates,
                                    activeProject.googleMapsUrl
                                  )}
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

                      {/* Cluster Picker InfoWindow for tightly grouped developments */}
                      {activeClusterState && (
                        <InfoWindow
                          anchor={activeClusterState.anchor}
                          onCloseClick={() => setActiveClusterState(null)}
                        >
                          <div className="p-2.5 sm:p-3 w-[min(275px,calc(100vw-64px))] max-h-[260px] overflow-y-auto bg-[#121212] text-[#F5F1E8] space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D4AF72]">
                              {activeClusterState.cluster.projects.length} Nearby Developments
                            </p>
                            <div className="space-y-1.5">
                              {activeClusterState.cluster.projects.map((proj) => (
                                <div
                                  key={proj.id}
                                  className="p-2 border border-[#D4AF72]/20 bg-[#1B1B1B] space-y-1"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-xs font-semibold text-[#F5F1E8] leading-snug">
                                      {proj.name}
                                    </span>
                                    <span className="font-mono-tabular text-[11px] text-[#D4AF72] shrink-0">
                                      {formatProjectPrice(proj.startingPriceAed, currency, true)}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#A5A19A]">
                                    {proj.community} · {formatPropertyBhk(proj)}
                                  </p>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => onOpenProject(proj)}
                                      className="px-2 py-1 bg-[#D4AF72] text-[#080808] text-[10px] font-semibold hover:bg-[#E6C77A]"
                                    >
                                      Open
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProjectFromSidebar(proj)}
                                      className="px-2 py-1 border border-[#D4AF72]/35 text-[10px] text-[#F5F1E8] hover:border-[#D4AF72]"
                                    >
                                      Focus Pin
                                    </button>
                                    <a
                                      href={getGoogleMapsDirectionsUrl(
                                        proj.coordinates,
                                        proj.googleMapsUrl
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-auto text-[10px] text-[#D4AF72] hover:underline flex items-center gap-0.5"
                                    >
                                      <Navigation className="w-2.5 h-2.5" />
                                      <span>Route</span>
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  </div>
                </GoogleMapsGuard>
              </APIProvider>
            ) : (
              /* Interactive Geographic UAE Coastline & Emirate Vector Map */
              <div className="w-full h-full flex flex-col justify-between p-3 sm:p-4 bg-[#0B1217]">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#D4AF72]/20">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#D4AF72] uppercase tracking-[0.14em] flex items-center gap-1.5">
                      {mapErrorReason ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#FCD34D] shrink-0" />
                      ) : (
                        <MapIcon className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {mapErrorReason
                          ? MAP_ERROR_COPY[mapErrorReason].title
                          : 'UAE Geospatial Property Explorer'}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#A5A19A] mt-0.5">
                      {mapErrorReason
                        ? MAP_ERROR_COPY[mapErrorReason].detail
                        : `Coastline geometry, clustered price pins across ${activeEmirates.length} active Emirates, and verified Google Maps routes.`}
                    </p>
                  </div>
                  {mapErrorReason && (
                    <button
                      type="button"
                      onClick={handleRetryLiveMap}
                      className="h-8 px-3 bg-[#1B1B1B] border border-[#D4AF72]/50 text-[11px] font-semibold text-[#D4AF72] hover:bg-[#D4AF72] hover:text-[#080808] flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry Live Map</span>
                    </button>
                  )}
                </div>

                <div className="relative flex-1 mt-2 border border-[#D4AF72]/25 bg-[#091319] overflow-hidden min-h-[240px]">
                  <svg
                    viewBox={svgViewBox}
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-full block select-none"
                    role="img"
                    aria-label="United Arab Emirates interactive property map across active Emirates"
                  >
                    <defs>
                      <linearGradient id="uaeSeaBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#07131B" />
                        <stop offset="100%" stopColor="#0D1E29" />
                      </linearGradient>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width={UAE_GEO_SVG_BOUNDS.width}
                      height={UAE_GEO_SVG_BOUNDS.height}
                      fill="url(#uaeSeaBg)"
                    />

                    {/* Subtle Lat/Lng Coordinate Graticule */}
                    {[23.5, 24.5, 25.5].map((lat) => {
                      const pt = projectLatLngToGeoSvg({ lat, lng: 54 });
                      return (
                        <line
                          key={`grid-lat-${lat}`}
                          x1={0}
                          y1={pt.y}
                          x2={UAE_GEO_SVG_BOUNDS.width}
                          y2={pt.y}
                          stroke="rgba(212, 175, 114, 0.08)"
                          strokeWidth={1 / fallbackZoomLevel}
                        />
                      );
                    })}
                    {[52.5, 53.5, 54.5, 55.5].map((lng) => {
                      const pt = projectLatLngToGeoSvg({ lat: 24, lng });
                      return (
                        <line
                          key={`grid-lng-${lng}`}
                          x1={pt.x}
                          y1={0}
                          x2={pt.x}
                          y2={UAE_GEO_SVG_BOUNDS.height}
                          stroke="rgba(212, 175, 114, 0.08)"
                          strokeWidth={1 / fallbackZoomLevel}
                        />
                      );
                    })}

                    {/* UAE Landmass Polygon */}
                    <polygon
                      points={uaePolygonPoints}
                      fill="#181918"
                      stroke="#D4AF72"
                      strokeOpacity={0.55}
                      strokeWidth={1.6 / fallbackZoomLevel}
                    />

                    {/* Internal Emirate Boundary Guides */}
                    {UAE_EMIRATE_BORDER_LINES.map((seg, idx) => (
                      <polyline
                        key={`border-${idx}`}
                        fill="none"
                        stroke="rgba(212, 175, 114, 0.3)"
                        strokeDasharray={`${4 / fallbackZoomLevel} ${3 / fallbackZoomLevel}`}
                        strokeWidth={1 / fallbackZoomLevel}
                        points={seg
                          .map((c) => {
                            const pt = projectLatLngToGeoSvg(c);
                            return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                          })
                          .join(' ')}
                      />
                    ))}

                    {/* Sea Labels */}
                    <text
                      x={365}
                      y={155}
                      fill="rgba(165, 161, 154, 0.35)"
                      fontSize={12 / fallbackZoomLevel}
                      letterSpacing="2"
                    >
                      ARABIAN GULF
                    </text>
                    <text
                      x={910}
                      y={220}
                      fill="rgba(165, 161, 154, 0.35)"
                      fontSize={10.5 / fallbackZoomLevel}
                    >
                      GULF OF OMAN
                    </text>

                    {/* Active Emirate Reference Labels & Clustered Project Markers (Unified Collision Avoidance) */}
                    {(() => {
                      const invZoom = 1 / fallbackZoomLevel;
                      const charW = 5.6 * invZoom;
                      const boxH = 12.5 * invZoom;
                      const placedBoxes: Array<{
                        x1: number;
                        y1: number;
                        x2: number;
                        y2: number;
                      }> = [];

                      const offsetMap: Record<
                        EmiratesName,
                        { dx: number; dy: number; anchor: 'start' | 'middle' | 'end' }
                      > = {
                        'Abu Dhabi': { dx: -18, dy: 28, anchor: 'end' },
                        Dubai: { dx: -56, dy: -28, anchor: 'end' },
                        Sharjah: { dx: 54, dy: -10, anchor: 'start' },
                        Ajman: { dx: 48, dy: -24, anchor: 'start' },
                        'Umm Al Quwain': { dx: -22, dy: -32, anchor: 'end' },
                        'Ras Al Khaimah': { dx: 16, dy: -18, anchor: 'start' },
                        Fujairah: { dx: 14, dy: 14, anchor: 'start' },
                      };

                      const emirateEntries = activeEmirates.map((em) => {
                        const pt = projectLatLngToGeoSvg(EMIRATE_MAP_CENTERS[em]);
                        const cfg = offsetMap[em] ?? { dx: 8, dy: -6, anchor: 'start' as const };
                        const lx = pt.x + cfg.dx * invZoom;
                        const ly = pt.y + cfg.dy * invZoom;
                        const emW = Math.max(36 * invZoom, em.length * charW);
                        const tx1 =
                          cfg.anchor === 'start'
                            ? lx
                            : cfg.anchor === 'end'
                            ? lx - emW
                            : lx - emW / 2;
                        const tx2 = tx1 + emW;

                        // Reserve both Emirate dot and Emirate text label boxes
                        placedBoxes.push({
                          x1: pt.x - 5 * invZoom,
                          y1: pt.y - 5 * invZoom,
                          x2: pt.x + 5 * invZoom,
                          y2: pt.y + 5 * invZoom,
                        });
                        placedBoxes.push({
                          x1: tx1 - 2 * invZoom,
                          y1: ly - boxH,
                          x2: tx2 + 2 * invZoom,
                          y2: ly + 3 * invZoom,
                        });

                        return { em, pt, cfg, lx, ly };
                      });

                      const clusterEntries = fallbackClusters.map((cluster) => {
                        const pt = projectLatLngToGeoSvg(cluster.center);
                        const isSingle = cluster.projects.length === 1;
                        const singleProj = cluster.projects[0];
                        const isSelected =
                          (isSingle && activeProject?.id === singleProj.id) ||
                          (!isSingle && activeFallbackCluster?.id === cluster.id);
                        const label = isSingle
                          ? formatProjectPrice(singleProj.startingPriceAed, currency, true)
                          : `${cluster.projects.length} · ${formatProjectPrice(
                              cluster.minPriceAed,
                              currency,
                              true
                            )}`;
                        const r = isSingle
                          ? 5 * invZoom
                          : Math.min(11, 6.5 + Math.log2(cluster.projects.length) * 1.6) * invZoom;

                        // Reserve pin circle bounding box before placing any cluster text label
                        placedBoxes.push({
                          x1: pt.x - (r + 3 * invZoom),
                          y1: pt.y - (r + 3 * invZoom),
                          x2: pt.x + (r + 3 * invZoom),
                          y2: pt.y + (r + 3 * invZoom),
                        });

                        return { cluster, pt, isSingle, singleProj, isSelected, label, r };
                      });

                      return (
                        <>
                          {emirateEntries.map(({ em, pt, cfg, lx, ly }) => (
                            <g
                              key={`svg-em-${em}`}
                              onClick={() => handleEmirateChange(em)}
                              className="cursor-pointer"
                            >
                              <line
                                x1={pt.x}
                                y1={pt.y}
                                x2={lx}
                                y2={ly - 2 * invZoom}
                                stroke="rgba(212, 175, 114, 0.45)"
                                strokeWidth={0.9 * invZoom}
                              />
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={2.5 * invZoom}
                                fill="#D4AF72"
                                fillOpacity={0.85}
                              />
                              <text
                                x={lx}
                                y={ly}
                                textAnchor={cfg.anchor}
                                fill="#D4AF72"
                                fillOpacity={0.92}
                                fontSize={9.5 * invZoom}
                                fontWeight="600"
                              >
                                {em}
                              </text>
                            </g>
                          ))}

                          {clusterEntries.map(
                            ({ cluster, pt, isSingle, singleProj, isSelected, label, r }) => {
                              const estW = Math.max(40 * invZoom, label.length * charW);
                              const candidateOffsets: Array<{
                                dx: number;
                                dy: number;
                                anchor: 'start' | 'end';
                              }> = [
                                { dx: r + 5 * invZoom, dy: 3 * invZoom, anchor: 'start' },
                                { dx: -(r + 5 * invZoom), dy: 3 * invZoom, anchor: 'end' },
                                { dx: -(r + 5 * invZoom), dy: -10 * invZoom, anchor: 'end' },
                                { dx: r + 5 * invZoom, dy: -10 * invZoom, anchor: 'start' },
                                { dx: r + 5 * invZoom, dy: 15 * invZoom, anchor: 'start' },
                                { dx: -(r + 5 * invZoom), dy: 15 * invZoom, anchor: 'end' },
                                { dx: -(r + 12 * invZoom), dy: -18 * invZoom, anchor: 'end' },
                                { dx: r + 12 * invZoom, dy: 24 * invZoom, anchor: 'start' },
                                { dx: -(r + 12 * invZoom), dy: 24 * invZoom, anchor: 'end' },
                              ];

                              let chosenOffset: (typeof candidateOffsets)[number] | null = null;
                              for (const cand of candidateOffsets) {
                                const tx = pt.x + cand.dx;
                                const ty = pt.y + cand.dy;
                                const x1 = cand.anchor === 'start' ? tx : tx - estW;
                                const x2 = cand.anchor === 'start' ? tx + estW : tx;
                                const y1 = ty - boxH;
                                const y2 = ty + 3 * invZoom;
                                const collides = placedBoxes.some(
                                  (b) => !(x2 < b.x1 || x1 > b.x2 || y2 < b.y1 || y1 > b.y2)
                                );
                                if (!collides) {
                                  chosenOffset = cand;
                                  placedBoxes.push({ x1, y1, x2, y2 });
                                  break;
                                }
                              }

                              return (
                                <g
                                  key={cluster.id}
                                  onClick={() => {
                                    if (isSingle) {
                                      setActiveFallbackCluster(null);
                                      setActiveProject(singleProj);
                                    } else {
                                      setFallbackFocus(pt);
                                      if (fallbackZoomLevel < 3.4) {
                                        setFallbackZoomLevel((z) =>
                                          Math.min(4.2, +(z + 1.1).toFixed(1))
                                        );
                                        setActiveFallbackCluster(null);
                                      } else {
                                        setActiveFallbackCluster(cluster);
                                      }
                                    }
                                  }}
                                  className="cursor-pointer"
                                >
                                  <circle
                                    cx={pt.x}
                                    cy={pt.y}
                                    r={r}
                                    fill={isSelected ? '#F5F1E8' : '#D4AF72'}
                                    stroke="#080808"
                                    strokeWidth={1.5 * invZoom}
                                  />
                                  {(chosenOffset || isSelected) && (
                                    <text
                                      x={pt.x + (chosenOffset?.dx ?? r + 5 * invZoom)}
                                      y={pt.y + (chosenOffset?.dy ?? 3 * invZoom)}
                                      textAnchor={chosenOffset?.anchor ?? 'start'}
                                      fill={isSelected ? '#F5F1E8' : '#E6C77A'}
                                      fontSize={9.5 * invZoom}
                                      fontWeight="600"
                                    >
                                      {label}
                                    </text>
                                  )}
                                </g>
                              );
                            }
                          )}
                        </>
                      );
                    })()}
                  </svg>

                  {/* Vector Fallback Zoom Controls */}
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                    <div className="flex border border-[#D4AF72]/40 bg-[#080808]/90">
                      <button
                        type="button"
                        onClick={() => setFallbackZoomLevel((z) => Math.min(4.5, +(z + 0.6).toFixed(1)))}
                        aria-label="Zoom in fallback map"
                        className="h-8 w-8 flex items-center justify-center text-[#F5F1E8] hover:bg-[#D4AF72] hover:text-[#080808]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFallbackZoomLevel((z) => Math.max(1, +(z - 0.6).toFixed(1)))}
                        aria-label="Zoom out fallback map"
                        className="h-8 w-8 flex items-center justify-center text-[#F5F1E8] hover:bg-[#D4AF72] hover:text-[#080808] border-l border-[#D4AF72]/25"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEmirateChange('All UAE')}
                      className="h-8 px-2.5 bg-[#080808]/90 border border-[#D4AF72]/40 text-[11px] font-semibold text-[#F5F1E8] hover:border-[#D4AF72]"
                    >
                      All Active Emirates
                    </button>
                  </div>

                  {/* Fallback Cluster Drawer */}
                  {activeFallbackCluster && (
                    <div className="absolute top-2.5 right-2.5 max-w-[calc(100%-20px)] sm:max-w-[260px] max-h-[210px] overflow-y-auto bg-[#121212]/95 border border-[#D4AF72] p-2.5 space-y-1.5 shadow-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[#D4AF72] uppercase">
                          {activeFallbackCluster.projects.length} Developments
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveFallbackCluster(null)}
                          className="text-[#A5A19A] hover:text-[#F5F1E8]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      {activeFallbackCluster.projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setActiveProject(p);
                            setActiveFallbackCluster(null);
                          }}
                          className="w-full text-left p-1.5 bg-[#1B1B1B] border border-[#D4AF72]/20 hover:border-[#D4AF72] text-[11px]"
                        >
                          <span className="block font-semibold text-[#F5F1E8] truncate">
                            {p.name}
                          </span>
                          <span className="block text-[10px] text-[#D4AF72]">
                            {p.community} · {formatProjectPrice(p.startingPriceAed, currency, true)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Nearby & Selected Project Sidebar */}
          <aside className="border-t lg:border-t-0 lg:border-l border-[#D4AF72]/20 bg-[#121212] overflow-y-auto p-4 flex flex-col gap-3 max-h-[380px] lg:max-h-none lg:h-full min-w-0">
            {activeProject ? (
              <div className="border border-[#D4AF72]/50 bg-[#1B1B1B] p-4 space-y-2">
                {activeProject.heroImage && !failedImgUrls.has(activeProject.heroImage) && (
                  <img
                    src={activeProject.heroImage}
                    alt={activeProject.name}
                    referrerPolicy="no-referrer"
                    onError={() => markImgFailed(activeProject.heroImage)}
                    className="w-full h-28 object-cover mb-2 border border-[#D4AF72]/20"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-[#D4AF72] uppercase tracking-wider">
                    Selected Development
                  </p>
                  <button
                    type="button"
                    onClick={handleCloseInfo}
                    aria-label="Clear selected development"
                    className="text-[#A5A19A] hover:text-[#F5F1E8]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="font-display text-xl font-medium text-[#F5F1E8]">
                  {activeProject.name}
                </h4>
                <p className="text-xs text-[#A5A19A]">
                  {formatCleanLocation(activeProject.community, activeProject.emirate)}
                </p>
                {isValidCoordinate(activeProject.coordinates) ? (
                  <p className="text-[10px] font-mono-tabular text-[#A5A19A] ltr-isolate">
                    GPS: {activeProject.coordinates.lat.toFixed(4)}° N,{' '}
                    {activeProject.coordinates.lng.toFixed(4)}° E
                  </p>
                ) : (
                  <p className="text-[11px] text-[#FCA5A5]">GPS coordinates missing</p>
                )}
                <p className="font-mono-tabular text-sm font-semibold text-[#F5F1E8] pt-1 ltr-isolate">
                  {formatProjectPrice(activeProject.startingPriceAed, currency)}
                </p>
                {currency !== 'INR' && activeProject.startingPriceAed > 0 && (
                  <p className="font-mono-tabular text-[11px] text-[#D4AF72] ltr-isolate">
                    ≈ {formatCurrency(activeProject.startingPriceAed, 'INR')}
                  </p>
                )}
                <p className="text-[11px] text-[#A5A19A] ltr-isolate">
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
                      href={getGoogleMapsDirectionsUrl(
                        activeProject.coordinates,
                        activeProject.googleMapsUrl
                      )}
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
                and exact GPS directions.
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
                      <span className="font-mono-tabular text-xs font-medium text-[#D4AF72] shrink-0 ltr-isolate">
                        {formatProjectPrice(project.startingPriceAed, currency, true)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] text-[#A5A19A]">
                      <span className="truncate">
                        {formatCleanLocation(project.community, project.emirate)}
                      </span>
                      {distKm !== null && (
                        <span className="font-mono-tabular text-[#6EE7B7] shrink-0 ltr-isolate">
                          {distKm.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#D4AF72]/80 mt-1 truncate ltr-isolate">
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
