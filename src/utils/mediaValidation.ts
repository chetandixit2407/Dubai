import {
  CatalogMediaAuditReport,
  ImageCollisionRecord,
  MediaCategory,
  MediaClassification,
  Project,
  TourAvailabilityStatus,
} from '../types/realEstate.ts';

export const MISSING_PROJECT_PHOTO_LABEL = 'PROJECT PHOTOGRAPHS NOT AVAILABLE';
export const COMING_SOON_TOUR_LABEL = '360° TOUR NOT AVAILABLE';

export const MEDIA_CATEGORY_LABELS: Record<MediaCategory, string> = {
  exterior: 'Building Exterior',
  interior_living: 'Living Room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  balcony_view: 'Balcony & Views',
  amenities_pool: 'Pool & Amenities',
  lobby_entrance: 'Lobby & Entrance',
  landscaping: 'Landscaped Areas',
  construction_progress: 'Construction Progress',
  surroundings: 'Surroundings & Community',
};

export const MEDIA_CLASSIFICATION_LABELS: Record<MediaClassification, string> = {
  actual_photograph: 'Actual Photograph',
  developer_render: 'Developer Render',
  illustrative_image: 'Illustrative Image',
  construction_photo: 'Construction Progress Photo',
};

export const TOUR_STATUS_LABELS: Record<TourAvailabilityStatus, string> = {
  '360_available': '3D Virtual Tour Available',
  '3d_available': '3D Virtual Tour Available',
  video_available: 'Video Walkthrough Available',
  coming_soon: 'Media Not Available',
};

export interface MediaValidationReport {
  isPublishReady: boolean;
  completenessPct: number;
  hasVerifiedProjectImage: boolean;
  hasActualPhoto: boolean;
  hasSourceRecorded: boolean;
  hasAccurateTourStatus: boolean;
  hasConnectedTourIfAvailable: boolean;
  mediaBelongsToProject: boolean;
  effectiveTourStatus: TourAvailabilityStatus;
  totalMediaCount: number;
  categoryCount: number;
  missingReasons: string[];
}

/**
 * Deterministic 64-bit hex fingerprint usable synchronously in both Node and browser.
 */
export function computeSyncFingerprint(input: string): string {
  const normalized = input.trim();
  if (!normalized) return '';
  let h1 = 0xdeadbeef ^ normalized.length;
  let h2 = 0x41c6ce57 ^ normalized.length;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const combined =
    (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  return `fp_${combined}`;
}

/**
 * Async SHA-256 hex digest using Web Crypto API for uploaded image files / Data URLs.
 */
export async function computeStringSha256(input: string): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(trimmed);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256_${hex}`;
  }
  return computeSyncFingerprint(trimmed);
}

/**
 * Produces a canonical uniqueness key for any project image (URL, local asset path, or binary hash).
 */
export function normalizeImageKey(urlOrData: string, explicitHash?: string): string {
  if (explicitHash && explicitHash.trim()) {
    return explicitHash.trim().toLowerCase();
  }
  const raw = (urlOrData || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) {
    return computeSyncFingerprint(raw);
  }
  // Normalize query-agnostic path/url without trailing slashes or casing differences
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const parsed = new URL(raw);
      return `url_${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '').toLowerCase()}`;
    }
  } catch {
    // Fallback to raw path normalization
  }
  return `asset_${raw.replace(/^\/+/, '').toLowerCase()}`;
}

/**
 * Checks whether a candidate image URL or content hash is already assigned to another project.
 * Enforces strict zero-duplicate image policy across the entire catalog.
 */
export function findImageCollision(
  candidateUrl: string,
  candidateHash: string | undefined,
  targetProjectId: string,
  allProjects: Project[]
): { projectId: string; projectName: string; matchedKey: string } | null {
  const candidateKeys = new Set<string>();
  const urlKey = normalizeImageKey(candidateUrl, undefined);
  if (urlKey) candidateKeys.add(urlKey);
  if (candidateHash?.trim()) {
    candidateKeys.add(candidateHash.trim().toLowerCase());
  }
  if (candidateKeys.size === 0) return null;

  for (const proj of allProjects) {
    if (proj.id === targetProjectId) continue;

    if (proj.heroImage?.trim()) {
      const heroKey = normalizeImageKey(proj.heroImage, proj.heroImageHash);
      const rawHeroUrlKey = normalizeImageKey(proj.heroImage);
      if (
        (heroKey && candidateKeys.has(heroKey)) ||
        (rawHeroUrlKey && candidateKeys.has(rawHeroUrlKey))
      ) {
        return {
          projectId: proj.id,
          projectName: proj.name,
          matchedKey: heroKey || rawHeroUrlKey,
        };
      }
    }

    for (const item of proj.mediaItems || []) {
      if (!item.url?.trim()) continue;
      const itemKey = normalizeImageKey(item.url, item.imageHash);
      const rawItemUrlKey = normalizeImageKey(item.url);
      if (
        (itemKey && candidateKeys.has(itemKey)) ||
        (rawItemUrlKey && candidateKeys.has(rawItemUrlKey))
      ) {
        return {
          projectId: proj.id,
          projectName: proj.name,
          matchedKey: itemKey || rawItemUrlKey,
        };
      }
    }
  }

  return null;
}

/**
 * Collects all normalized image keys currently in use across all projects (optionally excluding one).
 */
export function collectGlobalImageKeys(projects: Project[], excludeProjectId?: string): Set<string> {
  const keys = new Set<string>();
  for (const p of projects) {
    if (excludeProjectId && p.id === excludeProjectId) continue;
    if (p.heroImage?.trim()) {
      const k1 = normalizeImageKey(p.heroImage);
      const k2 = normalizeImageKey(p.heroImage, p.heroImageHash);
      if (k1) keys.add(k1);
      if (k2) keys.add(k2);
    }
    for (const m of p.mediaItems || []) {
      if (!m.url?.trim()) continue;
      const k1 = normalizeImageKey(m.url);
      const k2 = normalizeImageKey(m.url, m.imageHash);
      if (k1) keys.add(k1);
      if (k2) keys.add(k2);
    }
  }
  return keys;
}

export function getEffectiveTourStatus(project: Project): TourAvailabilityStatus {
  const vt = project.virtualTour;
  const isVideoUrl = (u?: string) => {
    const val = (u || '').toLowerCase();
    return val.includes('youtube.com') || val.includes('youtube-nocookie.com') || val.includes('youtu.be') || val.includes('vimeo.com');
  };

  // 1. Priority 1: Official 3D Spatial Twin or Verified 360 Panorama (excluding YouTube/video walkthroughs)
  if (vt && vt.available && vt.tourType !== 'video_walkthrough') {
    const verification = vt.verificationStatus || vt.discovery?.verificationStatus;
    const isUnverified =
      verification === 'broken' ||
      verification === 'unavailable' ||
      verification === 'awaiting_verification';

    if (!isUnverified) {
      const hasTrue360 = Boolean(
        vt.rooms?.some((r) => r.isTrue360Panorama && r.projectId === project.id && Boolean(r.imageUrl))
      );
      const hasGalleryVerified3d = Boolean(
        vt.tours?.some(
          (t) =>
            t.verificationStatus === 'verified' &&
            t.tourType !== 'video_walkthrough' &&
            ((Boolean(t.embedUrl?.trim()) && !isVideoUrl(t.embedUrl)) ||
              (Boolean(t.directUrl?.trim()) && !isVideoUrl(t.directUrl)))
        )
      );
      const has3dUrl = Boolean(
        (vt.embedUrl?.trim() && !isVideoUrl(vt.embedUrl)) ||
          vt.webXrUrl?.trim() ||
          (vt.directUrl?.trim() && !isVideoUrl(vt.directUrl))
      );

      if (vt.tourStatus === '360_available' && (hasTrue360 || hasGalleryVerified3d)) return '360_available';
      if (vt.tourStatus === '3d_available' && (has3dUrl || hasGalleryVerified3d)) return '3d_available';
      if (hasTrue360 || hasGalleryVerified3d) return '360_available';
      if (has3dUrl) return '3d_available';
    }
  }

  // 2. Priority 2: Mandatory Video Alternative (Independent Walkthrough, Property Video, or Official Video)
  const hasVideoItems = Boolean(project.videoItems && project.videoItems.length > 0);
  const hasWalkthroughVideo = Boolean(
    project.walkthroughVideoUrl?.trim() ||
    project.primaryVideo?.embedUrl?.trim() ||
    vt?.walkthroughVideoUrl?.trim()
  );

  if (hasVideoItems || hasWalkthroughVideo) {
    return 'video_available';
  }

  // 3. Fallback: Media Not Available (strict zero-fabrication)
  return 'coming_soon';
}

export function evaluateProjectMedia(project: Project): MediaValidationReport {
  const items = project.mediaItems || [];
  const hasVerifiedProjectImage = items.some(
    (m) => m.verifiedProjectSpecific && m.projectId === project.id && Boolean(m.url)
  );
  const hasActualPhoto = items.some(
    (m) =>
      m.verifiedProjectSpecific &&
      m.projectId === project.id &&
      (m.classification === 'actual_photograph' || m.classification === 'construction_photo')
  );
  const hasSourceRecorded =
    items.length > 0 &&
    items.every((m) => Boolean(m.sourceName?.trim())) &&
    Boolean(project.heroSourceName?.trim());

  const mediaBelongsToProject =
    items.every((m) => m.projectId === project.id) &&
    (project.virtualTour.rooms || []).every((r) => r.projectId === project.id) &&
    (!project.virtualTour.projectId || project.virtualTour.projectId === project.id);

  const effectiveTourStatus = getEffectiveTourStatus(project);
  const hasConnectedTourIfAvailable =
    !project.virtualTour.available || effectiveTourStatus !== 'coming_soon';
  const hasAccurateTourStatus =
    (project.virtualTour.tourStatus || 'coming_soon') === effectiveTourStatus;

  const missingReasons: string[] = [];
  if (!hasVerifiedProjectImage) {
    missingReasons.push('Requires at least one verified project-specific photograph');
  }
  if (!hasSourceRecorded) {
    missingReasons.push('Every media asset must record its image source');
  }
  if (!hasAccurateTourStatus) {
    missingReasons.push('Virtual tour status flag does not match connected tour assets');
  }
  if (!hasConnectedTourIfAvailable) {
    missingReasons.push('Tour is marked available without a connected 360°, 3D, or video asset');
  }
  if (!mediaBelongsToProject) {
    missingReasons.push('Media or tour room projectId mismatch detected');
  }

  const checksPassed = [
    hasVerifiedProjectImage,
    hasSourceRecorded,
    hasAccurateTourStatus,
    hasConnectedTourIfAvailable,
    mediaBelongsToProject,
  ].filter(Boolean).length;

  const categoryCount = new Set(items.map((m) => m.category)).size;
  const completenessPct = Math.round((checksPassed / 5) * 100);

  return {
    isPublishReady: missingReasons.length === 0,
    completenessPct,
    hasVerifiedProjectImage,
    hasActualPhoto,
    hasSourceRecorded,
    hasAccurateTourStatus,
    hasConnectedTourIfAvailable,
    mediaBelongsToProject,
    effectiveTourStatus,
    totalMediaCount: items.length,
    categoryCount,
    missingReasons,
  };
}

/**
 * Full database-wide media, duplicate-image, URL, and 360° tour audit report.
 */
export function scanCatalogMediaAudit(projects: Project[]): CatalogMediaAuditReport {
  const keyOccurrences = new Map<
    string,
    { sampleUrl: string; projects: Map<string, string> }
  >();

  let projectsWithVerifiedRealImages = 0;
  let projectsWithRendersOnly = 0;
  let projectsWithMissingImages = 0;
  let projectsWithGenuine360Tours = 0;
  let projectsWith3dOrVideoTours = 0;
  let projectsWithMissingTours = 0;
  let projectsWithIndependentWalkthroughs = 0;
  let projectsWithConstructionVideos = 0;
  let projectsWithDeveloperVideos = 0;
  let projectsWithMediaNotAvailable = 0;
  let projectsWithProjectUrls = 0;
  let projectsMissingProjectUrls = 0;

  for (const p of projects) {
    const items = (p.mediaItems || []).filter((m) => Boolean(m.url?.trim()));
    const hasAnyImage = Boolean(p.heroImage?.trim()) || items.length > 0;
    const hasVerifiedReal = items.some(
      (m) =>
        m.verifiedProjectSpecific &&
        m.projectId === p.id &&
        (m.classification === 'actual_photograph' || m.classification === 'construction_photo')
    );

    if (!hasAnyImage) {
      projectsWithMissingImages++;
    } else if (hasVerifiedReal) {
      projectsWithVerifiedRealImages++;
    } else {
      projectsWithRendersOnly++;
    }

    const effTour = getEffectiveTourStatus(p);
    if (effTour === '360_available') {
      projectsWithGenuine360Tours++;
    } else if (effTour === '3d_available' || effTour === 'video_available') {
      projectsWith3dOrVideoTours++;
    } else {
      projectsWithMissingTours++;
    }

    if (p.primaryVideo?.priorityLevel === 1) {
      projectsWithIndependentWalkthroughs++;
    } else if (p.primaryVideo?.priorityLevel === 2) {
      projectsWithConstructionVideos++;
    } else if (p.primaryVideo?.priorityLevel === 4) {
      projectsWithDeveloperVideos++;
    }

    if (effTour === 'coming_soon') {
      projectsWithMediaNotAvailable++;
    }

    if (p.projectUrl?.trim()) {
      projectsWithProjectUrls++;
    } else {
      projectsMissingProjectUrls++;
    }

    // Index every image hash & normalized URL per project to catch any reuse
    const projectSeenKeys = new Set<string>();
    const registerKey = (url: string, explicitHash?: string) => {
      if (!url?.trim()) return;
      const key = normalizeImageKey(url, explicitHash);
      if (!key || projectSeenKeys.has(key)) return;
      projectSeenKeys.add(key);

      const entry = keyOccurrences.get(key) || {
        sampleUrl: url,
        projects: new Map<string, string>(),
      };
      entry.projects.set(p.id, p.name);
      keyOccurrences.set(key, entry);
    };

    if (p.heroImage?.trim()) {
      registerKey(p.heroImage, p.heroImageHash);
    }
    for (const m of items) {
      registerKey(m.url, m.imageHash);
    }
  }

  const duplicateCollisions: ImageCollisionRecord[] = [];
  const affectedProjectIds = new Set<string>();

  for (const [imageHash, info] of keyOccurrences.entries()) {
    if (info.projects.size > 1) {
      const projectIds = Array.from(info.projects.keys());
      const projectNames = Array.from(info.projects.values());
      projectIds.forEach((id) => affectedProjectIds.add(id));
      duplicateCollisions.push({
        imageHash,
        imageUrl: info.sampleUrl,
        projectIds,
        projectNames,
      });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalProjects: projects.length,
    projectsWithVerifiedRealImages,
    projectsWithRendersOnly,
    projectsWithMissingImages,
    projectsWithDuplicateImages: affectedProjectIds.size,
    duplicateCollisions,
    projectsWithGenuine360Tours,
    projectsWith3dOrVideoTours,
    projectsWithIndependentWalkthroughs,
    projectsWithConstructionVideos,
    projectsWithDeveloperVideos,
    projectsWithMediaNotAvailable,
    projectsWithMissingTours,
    projectsWithProjectUrls,
    projectsMissingProjectUrls,
  };
}
