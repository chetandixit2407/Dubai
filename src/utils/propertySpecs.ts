import { Project } from '../types/realEstate.ts';

interface BhkToken {
  label: string;
  order: number;
  numeric: number;
  isPlus: boolean;
}

function parseBhkTokensFromStrings(values: string[]): BhkToken[] {
  const tokenMap = new Map<string, BhkToken>();

  for (const raw of values) {
    if (!raw) continue;
    const text = raw.trim();
    if (!text) continue;

    if (/\bstudio\b/i.test(text)) {
      tokenMap.set('Studio', { label: 'Studio', order: 0, numeric: 0, isPlus: false });
    }

    const regex = /\b(\d+)\s*(\+)?\s*(?:bhk|bed(?:room)?s?|br)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const num = Number(match[1]);
      if (!Number.isFinite(num) || num <= 0 || num > 20) continue;
      const isPlus = Boolean(match[2]);
      const key = `${num}${isPlus ? '+' : ''}`;
      tokenMap.set(key, {
        label: key,
        order: num * 10 + (isPlus ? 1 : 0),
        numeric: num,
        isPlus,
      });
    }
  }

  return Array.from(tokenMap.values()).sort((a, b) => a.order - b.order);
}

export function extractProjectBhkTokens(project: Project): BhkToken[] {
  const fromTypes = parseBhkTokensFromStrings(project.propertyTypes || []);
  if (fromTypes.length > 0) return fromTypes;
  const fromPlans = parseBhkTokensFromStrings(
    (project.floorPlans || []).map((fp) => fp.bedrooms || '')
  );
  return fromPlans;
}

export function formatPropertyBhk(project: Project): string {
  const tokens = extractProjectBhkTokens(project);
  if (tokens.length === 0) return 'Not Available';

  const hasStudio = tokens.some((t) => t.label === 'Studio');
  const numericParts = tokens.filter((t) => t.label !== 'Studio').map((t) => t.label);

  if (numericParts.length === 0) {
    return 'Studio';
  }
  const numericFormatted = `${numericParts.join(', ')} BR`;
  return hasStudio ? `Studio, ${numericFormatted}` : numericFormatted;
}

export function formatFloorPlanBhk(bedrooms?: string | null): string {
  if (!bedrooms || !bedrooms.trim()) return 'Not Available';
  const tokens = parseBhkTokensFromStrings([bedrooms]);
  if (tokens.length === 0) return 'Not Available';
  const hasStudio = tokens.some((t) => t.label === 'Studio');
  const numericParts = tokens.filter((t) => t.label !== 'Studio').map((t) => t.label);
  if (numericParts.length === 0) return 'Studio';
  const numericFormatted = `${numericParts.join(', ')} BR`;
  return hasStudio ? `Studio, ${numericFormatted}` : numericFormatted;
}

function deduplicateSegments(segments: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of segments) {
    if (!raw) continue;
    for (const part of String(raw).split(',')) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

/**
 * Deduplicates community + emirate strings so e.g. ("Business Bay, Dubai", "Dubai")
 * renders cleanly as "Business Bay, Dubai" instead of "Business Bay, Dubai · Dubai".
 */
export function formatCleanLocation(
  community?: string | null,
  emirate?: string | null,
  includeCountry = false
): string {
  const parts = deduplicateSegments([community, emirate, includeCountry ? 'UAE' : null]);
  return parts.join(', ');
}

/**
 * Deduplicates full address strings so repeated community/emirate tokens such as
 * "Azizi Riviera, Meydan One district, Dubai, Meydan One district, Dubai, Dubai, UAE"
 * collapse cleanly to "Azizi Riviera, Meydan One district, Dubai, UAE".
 */
export function formatCleanFullAddress(project: {
  buildingName?: string | null;
  neighbourhood?: string | null;
  community?: string | null;
  emirate?: string | null;
  fullAddress?: string | null;
}): string {
  const sourceSegments = project.fullAddress?.trim()
    ? [project.fullAddress]
    : [project.buildingName, project.neighbourhood, project.community, project.emirate, 'UAE'];
  const parts = deduplicateSegments(sourceSegments);
  return parts.join(', ');
}

export function formatRegistrationBadge(registrationNumber?: string | null): {
  label: string;
  value: string;
  isInternalRef: boolean;
} {
  const val = (registrationNumber || '').trim();
  if (!val) {
    return { label: 'Registry Status', value: 'Pending Verification', isInternalRef: true };
  }
  const isInternalRef = /^UAE-WCR-/i.test(val);
  return {
    label: isInternalRef ? 'Internal Catalog Ref' : 'RERA / Registry No.',
    value: val,
    isInternalRef,
  };
}

export function formatVerifiedLayoutsLabel(count: number): string {
  return `${count} Verified ${count === 1 ? 'Layout' : 'Layouts'}`;
}

/**
 * Accepts only verified single bathroom counts (e.g., "1", "1 Bathroom", "2.5 Baths", "3 Bathrooms").
 * Rejects synthetic/ambiguous ranges (e.g., "1 - 5 Bathrooms", "1 - 3 Bathrooms", "4.5 - 5 Baths")
 * and empty/placeholder values so nothing is guessed or fabricated.
 */
export function parseSingleBathroomCount(raw?: string | null): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^(n\/a|na|not available|unavailable|on request|tbd|-|—)$/i.test(s)) {
    return null;
  }
  // Reject any range (e.g. "1 - 5 Bathrooms", "4.5 - 5 Baths", "1 to 3 Bathrooms")
  if (/\d\s*[-–—]\s*\d|\b\d+\s+to\s+\d+\b/i.test(s) || s.includes('–')) {
    return null;
  }
  const exactMatch = s.match(/^\s*(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)?\s*$/i);
  if (!exactMatch) return null;
  const n = Number(exactMatch[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 50) return null;
  return n;
}

export function formatPropertyBathrooms(project: Project): string {
  const count = parseSingleBathroomCount(project.bathrooms);
  if (count === null) return 'Not Available';
  return count === 1 ? '1 Bathroom' : `${count} Bathrooms`;
}

export function formatFloorPlanBathrooms(bathrooms?: string | null): string {
  const count = parseSingleBathroomCount(bathrooms);
  if (count === null) return 'Not Available';
  return count === 1 ? '1 Bathroom' : `${count} Bathrooms`;
}

export function formatPropertyAreaSqFt(project: Project): string {
  const min = Number(project.minSizeSqFt) || 0;
  const max = Number(project.maxSizeSqFt) || 0;
  if (min > 0 && max > min) {
    return `${min.toLocaleString()}–${max.toLocaleString()} sq ft`;
  }
  if (min > 0) {
    return `${min.toLocaleString()} sq ft`;
  }
  if (max > 0) {
    return `${max.toLocaleString()} sq ft`;
  }
  return 'Not Available';
}

export function formatFloorPlanAreaSqFt(sizeSqFt?: number | null): string {
  const val = Number(sizeSqFt);
  if (Number.isFinite(val) && val > 0) {
    return `${Math.round(val).toLocaleString()} sq ft`;
  }
  return 'Not Available';
}

export function formatPropertySpecsSummary(project: Project): string {
  return `${formatPropertyBhk(project)} | ${formatPropertyBathrooms(project)} | ${formatPropertyAreaSqFt(project)}`;
}

export function doesProjectMatchBhkFilter(project: Project, filterValue: string): boolean {
  if (!filterValue) return true;
  const tokens = extractProjectBhkTokens(project);
  if (tokens.length === 0) return false;

  const norm = filterValue.trim().toLowerCase();
  if (norm === 'studio') {
    return tokens.some((t) => t.label === 'Studio');
  }

  const filterMatch = norm.match(/^(\d+)\s*(\+)?/);
  if (!filterMatch) return false;
  const targetNum = Number(filterMatch[1]);
  const targetPlus = Boolean(filterMatch[2]);

  if (targetPlus) {
    return tokens.some((t) => t.numeric >= targetNum);
  }
  return tokens.some((t) => t.numeric === targetNum && !t.isPlus);
}

export function doesProjectMatchBathroomFilter(project: Project, minBaths: number): boolean {
  if (!Number.isFinite(minBaths) || minBaths <= 0) return true;
  const projectCount = parseSingleBathroomCount(project.bathrooms);
  return projectCount !== null && projectCount >= minBaths;
}
