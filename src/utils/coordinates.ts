import { EmiratesName, Project } from '../types/realEstate.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

export const UAE_ALL_EMIRATES: EmiratesName[] = [
  'Abu Dhabi',
  'Dubai',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

export const EMIRATE_MAP_CENTERS: Record<'All UAE' | EmiratesName, LatLng & { zoom: number }> = {
  'All UAE': { lat: 24.92, lng: 55.15, zoom: 8 },
  Dubai: { lat: 25.15, lng: 55.24, zoom: 11 },
  'Abu Dhabi': { lat: 24.47, lng: 54.44, zoom: 11 },
  Sharjah: { lat: 25.33, lng: 55.44, zoom: 11 },
  Ajman: { lat: 25.41, lng: 55.46, zoom: 12 },
  'Ras Al Khaimah': { lat: 25.72, lng: 55.86, zoom: 11 },
  Fujairah: { lat: 25.14, lng: 56.33, zoom: 12 },
  'Umm Al Quwain': { lat: 25.56, lng: 55.56, zoom: 12 },
};

/**
 * Geographic bounds framing all 7 Emirates' primary residential/waterfront corridors
 * (Abu Dhabi Island across Dubai, Sharjah, Ajman, UAQ, RAK, and Fujairah).
 */
export const UAE_METRO_BOUNDS = {
  south: 24.18,
  west: 54.18,
  north: 25.98,
  east: 56.44,
};

export const UAE_FULL_COUNTRY_BOUNDS = {
  south: 22.65,
  west: 51.58,
  north: 26.08,
  east: 56.44,
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

/**
 * Builds an authoritative turn-by-turn Google Maps Directions URL using exact verified coordinates
 * when available, avoiding imprecise text-only search links.
 */
export function getGoogleMapsDirectionsUrl(
  coords?: Partial<LatLng> | null,
  fallbackUrl?: string
): string {
  if (isValidCoordinate(coords)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`;
  }
  return fallbackUrl || 'https://www.google.com/maps/search/?api=1&query=United+Arab+Emirates';
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

/** Web Mercator projection into pixel coordinates at a specific zoom level */
function projectToWorldPx(coords: LatLng, zoom: number): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((coords.lng + 180) / 360) * scale;
  const sinLat = Math.sin((coords.lat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const y = (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/**
 * Zoom-aware pixel-radius spatial clustering so overlapping labels are avoided at all zoom levels
 * while smoothly separating into individual project pins as users zoom into neighborhoods.
 */
export function clusterProjectsForMap(projects: Project[], zoom: number): ProjectMapCluster[] {
  const validProjects = projects.filter((p) => isValidCoordinate(p.coordinates));
  if (validProjects.length === 0) return [];

  const clampedZoom = Math.max(4, Math.min(20, Math.round(zoom)));

  // Above zoom 16, only group virtually identical rooftop/compound coordinates (< 12 px)
  const radiusPx =
    clampedZoom >= 17
      ? 0
      : clampedZoom === 16
      ? 18
      : clampedZoom >= 14
      ? 44
      : clampedZoom >= 12
      ? 58
      : clampedZoom >= 10
      ? 68
      : 78;

  // Sort north -> south first for deterministic bucket seeding, then emit south-last for Z-depth
  const sorted = [...validProjects].sort((a, b) => b.coordinates.lat - a.coordinates.lat);

  if (radiusPx === 0) {
    return sorted.map((p) => ({
      id: `pin-${p.id}`,
      center: p.coordinates,
      projects: [p],
      minPriceAed: p.startingPriceAed,
    }));
  }

  const radiusSq = radiusPx * radiusPx;
  const buckets: Array<{
    sumLat: number;
    sumLng: number;
    anchorPx: { x: number; y: number };
    items: Project[];
  }> = [];

  for (const p of sorted) {
    const px = projectToWorldPx(p.coordinates, clampedZoom);
    let matchedBucket: (typeof buckets)[number] | null = null;
    let bestDistSq = radiusSq;

    for (const bucket of buckets) {
      const dx = px.x - bucket.anchorPx.x;
      const dy = px.y - bucket.anchorPx.y;
      const dSq = dx * dx + dy * dy;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        matchedBucket = bucket;
      }
    }

    if (matchedBucket) {
      matchedBucket.items.push(p);
      matchedBucket.sumLat += p.coordinates.lat;
      matchedBucket.sumLng += p.coordinates.lng;
      const avgLat = matchedBucket.sumLat / matchedBucket.items.length;
      const avgLng = matchedBucket.sumLng / matchedBucket.items.length;
      matchedBucket.anchorPx = projectToWorldPx({ lat: avgLat, lng: avgLng }, clampedZoom);
    } else {
      buckets.push({
        sumLat: p.coordinates.lat,
        sumLng: p.coordinates.lng,
        anchorPx: px,
        items: [p],
      });
    }
  }

  const clusters: ProjectMapCluster[] = buckets.map((b, idx) => {
    const count = b.items.length;
    const center =
      count === 1
        ? b.items[0].coordinates
        : {
            lat: b.sumLat / count,
            lng: b.sumLng / count,
          };
    const priced = b.items.filter((p) => p.startingPriceAed > 0).map((p) => p.startingPriceAed);
    const minPriceAed = priced.length > 0 ? Math.min(...priced) : 0;
    const id =
      count === 1
        ? `pin-${b.items[0].id}`
        : `cluster-z${clampedZoom}-${idx}-${b.items[0].id}`;

    return {
      id,
      center,
      projects: b.items,
      minPriceAed,
    };
  });

  // Sort northernmost first so southern markers render visually on top (higher index)
  return clusters.sort((a, b) => b.center.lat - a.center.lat);
}

/**
 * Geographic SVG coordinate projection & verified coastline / 7-Emirate reference vectors
 * used only when live Google Maps tiles are temporarily unavailable (offline / quota limit).
 * Projection viewport: lng [51.5 .. 56.55], lat [22.65 .. 26.25] -> viewBox 0 0 1000 640
 */
export const UAE_GEO_SVG_BOUNDS = {
  minLng: 51.5,
  maxLng: 56.55,
  minLat: 22.65,
  maxLat: 26.25,
  width: 1000,
  height: 640,
};

export function projectLatLngToGeoSvg(coords: LatLng): { x: number; y: number } {
  const { minLng, maxLng, minLat, maxLat, width, height } = UAE_GEO_SVG_BOUNDS;
  const x = ((coords.lng - minLng) / (maxLng - minLng)) * width;
  const y = ((maxLat - coords.lat) / (maxLat - minLat)) * height;
  return { x, y };
}

/** Real coastal & land border outline vertices of the United Arab Emirates (Arabian Gulf + Gulf of Oman) */
export const UAE_LANDMASS_OUTLINE_COORDS: LatLng[] = [
  { lat: 24.06, lng: 51.58 }, // Western Saudi border near Sila
  { lat: 24.16, lng: 51.85 },
  { lat: 24.09, lng: 52.28 },
  { lat: 24.14, lng: 52.68 }, // Ruwais
  { lat: 24.12, lng: 53.05 },
  { lat: 24.11, lng: 53.48 }, // Al Mirfa
  { lat: 24.22, lng: 53.95 },
  { lat: 24.44, lng: 54.32 }, // Abu Dhabi Island West
  { lat: 24.54, lng: 54.44 }, // Saadiyat Island
  { lat: 24.52, lng: 54.63 }, // Yas / Al Raha
  { lat: 24.85, lng: 54.90 }, // Ghantoot
  { lat: 25.00, lng: 55.05 }, // Jebel Ali
  { lat: 25.12, lng: 55.14 }, // Palm Jumeirah coast
  { lat: 25.27, lng: 55.29 }, // Dubai Creek / Port Rashid
  { lat: 25.36, lng: 55.38 }, // Sharjah coast
  { lat: 25.42, lng: 55.44 }, // Ajman coast
  { lat: 25.56, lng: 55.55 }, // Umm Al Quwain
  { lat: 25.69, lng: 55.77 }, // Al Hamra / Al Marjan (RAK)
  { lat: 25.80, lng: 55.95 }, // Ras Al Khaimah City
  { lat: 26.04, lng: 56.09 }, // Northern RAK / Shaam
  { lat: 25.88, lng: 56.18 }, // Musandam inland ridge
  { lat: 25.60, lng: 56.27 }, // Dibba Al-Fujairah (Gulf of Oman)
  { lat: 25.35, lng: 56.36 }, // Khor Fakkan
  { lat: 25.12, lng: 56.35 }, // Fujairah City
  { lat: 25.00, lng: 56.36 }, // Kalba border
  { lat: 24.78, lng: 55.95 }, // Inland Hajar Foothills
  { lat: 24.22, lng: 55.78 }, // Al Ain / Oman border
  { lat: 23.62, lng: 55.45 },
  { lat: 22.92, lng: 55.22 }, // Southern Um Az Zumul corner
  { lat: 22.84, lng: 53.90 }, // Liwa Southern Dunes
  { lat: 22.96, lng: 52.52 },
  { lat: 23.52, lng: 51.82 },
  { lat: 24.06, lng: 51.58 },
];

/** Approximate inter-Emirate geographic boundary guide segments */
export const UAE_EMIRATE_BORDER_LINES: LatLng[][] = [
  // Abu Dhabi - Dubai border
  [
    { lat: 24.87, lng: 54.92 },
    { lat: 24.64, lng: 55.32 },
    { lat: 24.62, lng: 55.74 },
  ],
  // Dubai - Sharjah border
  [
    { lat: 25.31, lng: 55.35 },
    { lat: 25.16, lng: 55.58 },
    { lat: 24.98, lng: 55.75 },
  ],
  // Sharjah / Ajman / UAQ inland arc
  [
    { lat: 25.43, lng: 55.46 },
    { lat: 25.32, lng: 55.69 },
    { lat: 25.15, lng: 55.92 },
  ],
  // UAQ - RAK border
  [
    { lat: 25.63, lng: 55.66 },
    { lat: 25.48, lng: 55.86 },
  ],
  // Fujairah - RAK / Sharjah east coast line
  [
    { lat: 25.56, lng: 56.18 },
    { lat: 25.36, lng: 56.08 },
    { lat: 25.10, lng: 56.10 },
  ],
];
