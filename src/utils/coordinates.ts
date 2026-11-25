import { EmiratesName, Project } from '../types/realEstate.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

export const EMIRATE_MAP_CENTERS: Record<'All UAE' | EmiratesName, LatLng & { zoom: number }> = {
  'All UAE': { lat: 24.95, lng: 54.95, zoom: 8 },
  Dubai: { lat: 25.18, lng: 55.28, zoom: 11 },
  'Abu Dhabi': { lat: 24.47, lng: 54.44, zoom: 11 },
  Sharjah: { lat: 25.33, lng: 55.44, zoom: 11 },
  Ajman: { lat: 25.41, lng: 55.46, zoom: 12 },
  'Ras Al Khaimah': { lat: 25.68, lng: 55.79, zoom: 11 },
  Fujairah: { lat: 25.14, lng: 56.34, zoom: 12 },
  'Umm Al Quwain': { lat: 25.56, lng: 55.56, zoom: 12 },
};

export function isValidCoordinate(coords?: Partial<LatLng> | null): coords is LatLng {
  if (!coords) return false;
  const { lat, lng } = coords;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function isValidUaeCoordinate(coords?: Partial<LatLng> | null): coords is LatLng {
  if (!isValidCoordinate(coords)) return false;
  return coords.lat >= 22.4 && coords.lat <= 26.5 && coords.lng >= 51.3 && coords.lng <= 56.6;
}

export function getEmirateCenter(emirate?: EmiratesName | string): LatLng & { zoom: number } {
  if (emirate && emirate in EMIRATE_MAP_CENTERS) {
    return EMIRATE_MAP_CENTERS[emirate as EmiratesName];
  }
  return EMIRATE_MAP_CENTERS.Dubai;
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface ProjectMapCluster {
  id: string;
  center: LatLng;
  projects: Project[];
  minPriceAed: number;
}

/**
 * Deterministic spatial clustering so 182+ UAE developments stay legible at country/emirate zoom
 * while expanding to exact individual property markers on click or zoom >= 12.
 */
export function clusterProjectsForMap(projects: Project[], zoom: number): ProjectMapCluster[] {
  const validProjects = projects.filter((p) => isValidCoordinate(p.coordinates));

  if (zoom >= 12 || validProjects.length <= 18) {
    return validProjects.map((p) => ({
      id: `pin-${p.id}`,
      center: p.coordinates,
      projects: [p],
      minPriceAed: p.startingPriceAed,
    }));
  }

  // Adaptive degree grid size scaled smoothly by zoom level
  const gridDeg = zoom <= 8 ? 0.18 : zoom === 9 ? 0.1 : zoom === 10 ? 0.05 : 0.025;
  const buckets = new Map<string, Project[]>();

  for (const p of validProjects) {
    const gx = Math.floor(p.coordinates.lng / gridDeg);
    const gy = Math.floor(p.coordinates.lat / gridDeg);
    const key = `${gx}:${gy}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(p);
    } else {
      buckets.set(key, [p]);
    }
  }

  const clusters: ProjectMapCluster[] = [];
  for (const [key, list] of buckets.entries()) {
    const avgLat = list.reduce((acc, item) => acc + item.coordinates.lat, 0) / list.length;
    const avgLng = list.reduce((acc, item) => acc + item.coordinates.lng, 0) / list.length;
    const priced = list.filter((p) => p.startingPriceAed > 0).map((p) => p.startingPriceAed);
    const minPriceAed = priced.length > 0 ? Math.min(...priced) : 0;

    clusters.push({
      id: list.length === 1 ? `pin-${list[0].id}` : `cluster-${key}`,
      center: list.length === 1 ? list[0].coordinates : { lat: avgLat, lng: avgLng },
      projects: list,
      minPriceAed,
    });
  }

  return clusters;
}
