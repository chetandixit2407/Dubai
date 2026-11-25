import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EXCEL_182_PROJECTS } from '../src/data/excel182Projects.ts';
import {
  Project,
  ProjectVideoItem,
  VideoCategory,
  VideoCreatorType,
  VideoPriorityLevel,
} from '../src/types/realEstate.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface RawYtVideo {
  videoId: string;
  title: string;
  channel: string;
  publishedTimeText?: string;
  lengthText?: string;
  viewCountText?: string;
  thumbnailUrl: string;
}

const GENERIC_TOKENS = new Set([
  'the',
  'by',
  'at',
  'in',
  'of',
  'and',
  'for',
  'with',
  'dubai',
  'abu',
  'dhabi',
  'sharjah',
  'ajman',
  'rak',
  'uaq',
  'fujairah',
  'uae',
  'residence',
  'residences',
  'tower',
  'towers',
  'villa',
  'villas',
  'apartment',
  'apartments',
  'estate',
  'project',
  'properties',
  'property',
  'development',
  'developments',
  'realty',
  'group',
  'holding',
  'pjsc',
  'llc',
  'phase',
  'island',
  'islands',
  'private',
]);

const AMBIGUOUS_SINGLE_TOKENS = new Set([
  'one',
  'circle',
  'haven',
  'hills',
  'district',
  'vintage',
  'david',
  'gabriel',
  'central',
  'crest',
  'breeze',
  'breez',
  'flare',
  'twilight',
  'moonlight',
  'starlight',
  'verde',
  'solis',
  'milan',
  'jade',
  'park',
  'garden',
  'gardens',
  'vista',
  'horizon',
  'oasis',
  'bay',
  'creek',
  'marina',
  'palm',
  'beach',
  'sky',
  'crown',
  'royal',
  'emerald',
  'ruby',
  'pearl',
  'diamond',
  'opal',
  'amber',
]);

const DEVELOPER_CHANNEL_KEYWORDS: Record<string, string[]> = {
  'dev-danube': ['danube properties', 'danube official', 'rizwan sajan'],
  'dev-azizi': ['azizi developments', 'azizi official'],
  'dev-sobha': ['sobha realty', 'sobha official'],
  'dev-emaar': ['emaar', 'emaar properties'],
  'dev-aldar': ['aldar', 'aldar properties'],
  'dev-binghatti': ['binghatti', 'binghatti developers', 'binghatti properties'],
  'dev-damac': ['damac properties', 'damac official'],
  'dev-ellington': ['ellington properties', 'ellington'],
  'dev-nakheel': ['nakheel', 'nakheel official'],
  'dev-meraas': ['meraas', 'meraas official'],
  'dev-samana': ['samana developers', 'samana official'],
  'dev-imtiaz': ['imtiaz developments', 'imtiaz'],
  'dev-reportage': ['reportage properties', 'reportage uae'],
  'dev-bnw': ['bnw developments'],
  'dev-wasl': ['wasl', 'wasl properties'],
  'dev-tiger': ['tiger properties', 'tiger group'],
  'dev-vincitore': ['vincitore realty', 'vincitore'],
  'dev-mag': ['mag property', 'mag lifestyle', 'mag developments'],
  'dev-acube': ['acube developments'],
  'dev-hh': ['h&h development', 'h&h'],
  'dev-alef': ['alef group'],
  'dev-saas': ['saas properties'],
  'dev-select': ['select group'],
  'dev-beyond': ['beyond developments', 'beyond by omniyat', 'omniyat'],
  'dev-cityview': ['cityview developments'],
  'dev-atlon': ['atlon'],
  'dev-kleindienst': ['kleindienst', 'the heart of europe'],
};

function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getDeveloperShortNames(developerName: string): string[] {
  const norm = normalizeText(developerName);
  const words = norm.split(' ').filter((w) => w.length >= 3 && !GENERIC_TOKENS.has(w));
  return words;
}

function parseRelativeTimeToIso(label?: string): string {
  if (!label) return '2025-06-01';
  const s = label.toLowerCase();
  const now = new Date('2026-11-25T00:00:00Z');
  const numMatch = s.match(/(\d+)/);
  const n = numMatch ? Number(numMatch[1]) : 1;

  if (s.includes('day') || /\bd\b/.test(s) || /\d+d\b/.test(s)) {
    now.setUTCDate(now.getUTCDate() - n);
  } else if (s.includes('week') || /\dw\b/.test(s)) {
    now.setUTCDate(now.getUTCDate() - n * 7);
  } else if (s.includes('month') || /\d+mo\b/.test(s)) {
    now.setUTCMonth(now.getUTCMonth() - n);
  } else if (s.includes('year') || /\d+y\b/.test(s)) {
    now.setUTCFullYear(now.getUTCFullYear() - n);
  } else if (s.includes('hour') || s.includes('min') || /\d+h\b/.test(s)) {
    // Today
  }
  return now.toISOString().slice(0, 10);
}

function parseDateTextToIso(dateText?: string, fallbackRelative?: string): string {
  if (dateText) {
    const clean = dateText.replace(/premiered|streamed live on|published on/gi, '').trim();
    const parsed = new Date(clean + ' UTC');
    if (!Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() >= 2018) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return parseRelativeTimeToIso(fallbackRelative);
}

function isVideoRelevantToProject(video: RawYtVideo, project: Project): boolean {
  const titleNorm = normalizeText(video.title);
  const channelNorm = normalizeText(video.channel);
  const combined = `${titleNorm} ${channelNorm}`;

  // Reject Shorts compilation / unrelated spam signals
  if (
    titleNorm.includes('minecraft') ||
    titleNorm.includes('roblox') ||
    titleNorm.includes('gta') ||
    titleNorm.includes('reaction') ||
    titleNorm.includes('song') ||
    titleNorm.includes('trailer movie') ||
    titleNorm.includes('music video')
  ) {
    return false;
  }

  // Require real estate / UAE geographic signal in title or channel
  const uaeSignals = [
    'dubai',
    'abu dhabi',
    'sharjah',
    'ajman',
    'ras al khaimah',
    'rak',
    'marjan',
    'umm al quwain',
    'uaq',
    'uae',
    'emirates',
    'jlt',
    'jvc',
    'jvt',
    'business bay',
    'downtown',
    'meydan',
    'marina',
    'palm',
    'creek',
    'hills',
    'furjan',
    'sobha',
    'emaar',
    'damac',
    'danube',
    'azizi',
    'binghatti',
    'aldar',
    'nakheel',
    'meraas',
    'ellington',
    'samana',
    'imtiaz',
    'reportage',
    'properties',
    'real estate',
    'walkthrough',
    'apartment',
    'villa',
    'penthouse',
  ];
  const hasGeoOrPropertySignal = uaeSignals.some((sig) => combined.includes(sig));
  if (!hasGeoOrPropertySignal) return false;

  const projectNorm = normalizeText(project.name);
  const devShortWords = getDeveloperShortNames(project.developerName);
  const devTokenSet = new Set(devShortWords);

  // Split project name into core tokens (excluding generic words and developer prefix words)
  const rawTokens = projectNorm.split(' ').filter(Boolean);
  const projectSpecificTokens = rawTokens.filter(
    (t) => !GENERIC_TOKENS.has(t) && !devTokenSet.has(t) && t.length >= 2
  );
  const nonGenericTokens = rawTokens.filter((t) => !GENERIC_TOKENS.has(t) && t.length >= 2);

  const hasDevMention =
    devShortWords.length > 0 && devShortWords.some((dw) => combined.includes(dw));

  // If project name has specific non-developer tokens (e.g. "Diamondz", "Bayz 101", "Creek Waters")
  if (projectSpecificTokens.length > 0) {
    const matchedSpecific = projectSpecificTokens.filter((t) => titleNorm.includes(t));

    // Must match all specific tokens if 1-2 tokens, or at least ceil(len * 0.67) if 3+ tokens
    const requiredMatches =
      projectSpecificTokens.length <= 2
        ? projectSpecificTokens.length
        : Math.ceil(projectSpecificTokens.length * 0.67);

    if (matchedSpecific.length < requiredMatches) {
      return false;
    }

    // Check number tokens (e.g. "101", "102", "2", "3") so Bayz 101 doesn't match Bayz 102
    const numberTokens = projectSpecificTokens.filter((t) => /^\d+$/.test(t) && t.length >= 2);
    for (const num of numberTokens) {
      if (!titleNorm.includes(num)) return false;
    }

    // If the specific token is common/ambiguous (e.g. "One", "Circle", "Hills", "Haven"), require developer name too!
    if (
      projectSpecificTokens.length === 1 &&
      AMBIGUOUS_SINGLE_TOKENS.has(projectSpecificTokens[0]) &&
      !hasDevMention
    ) {
      return false;
    }

    // If project name included developer name (e.g. "Danube Diamondz") and single token isn't ultra-unique, check dev or community
    const communityTokens = normalizeText(project.community)
      .split(' ')
      .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));
    const hasCommunityMention = communityTokens.some((ct) => combined.includes(ct));

    if (!hasDevMention && !hasCommunityMention && projectSpecificTokens.length === 1) {
      return false;
    }

    return true;
  }

  // Fallback for projects where name is mostly developer + generic (e.g. "Sobha Central Dubai", "DAMAC District")
  if (nonGenericTokens.length > 0) {
    return nonGenericTokens.every((t) => titleNorm.includes(t));
  }

  return titleNorm.includes(projectNorm);
}

function classifyVideo(
  video: RawYtVideo,
  project: Project
): {
  channelType: VideoCreatorType;
  priorityLevel: VideoPriorityLevel;
  priorityLabel: string;
  videoCategory: VideoCategory;
} {
  const channelNorm = normalizeText(video.channel);
  const titleNorm = normalizeText(video.title);
  const devNames = DEVELOPER_CHANNEL_KEYWORDS[project.developerId] || getDeveloperShortNames(project.developerName);

  // Is official developer channel?
  const isOfficialDevChannel = devNames.some((kw) => {
    const cleanKw = normalizeText(kw);
    return (
      channelNorm === cleanKw ||
      channelNorm.startsWith(`${cleanKw} `) ||
      channelNorm.endsWith(` ${cleanKw}`) ||
      (cleanKw.includes(' ') && channelNorm.includes(cleanKw))
    );
  });

  if (isOfficialDevChannel) {
    return {
      channelType: 'developer_official',
      priorityLevel: 4,
      priorityLabel: 'Priority 4: Official Developer Video',
      videoCategory: 'developer_showcase',
    };
  }

  // Independent Construction / Drone / Location Progress
  const isConstructionOrDrone =
    /\b(construction|progress|update|drone|aerial|site visit|site update|handover|status|crane|timeline|excavation)\b/.test(
      titleNorm
    );

  // Independent Walkthrough / Review / Apartment Tour
  const isWalkthroughOrTour =
    /\b(walkthrough|walk through|tour|show apartment|showroom|mock up|mockup|review|apartment|villa|penthouse|unit|floor plan|floorplan|interior|amenities|inside|full tour|overview|1bhk|2bhk|3bhk|studio|bedroom)\b/.test(
      titleNorm
    );

  if (isConstructionOrDrone && !isWalkthroughOrTour) {
    return {
      channelType: 'construction_monitor',
      priorityLevel: 2,
      priorityLabel: 'Priority 2: Independent Property & Construction Video',
      videoCategory: titleNorm.includes('drone') || titleNorm.includes('aerial')
        ? 'area_drone'
        : 'construction_progress',
    };
  }

  if (titleNorm.includes('review') || titleNorm.includes('analysis') || titleNorm.includes('worth')) {
    return {
      channelType: 'independent_reviewer',
      priorityLevel: 1,
      priorityLabel: 'Priority 1: Independent Project Walkthrough',
      videoCategory: 'walkthrough',
    };
  }

  return {
    channelType: 'independent_agent',
    priorityLevel: 1,
    priorityLabel: 'Priority 1: Independent Project Walkthrough',
    videoCategory: titleNorm.includes('apartment') || titleNorm.includes('villa')
      ? 'apartment_tour'
      : 'walkthrough',
  };
}

async function searchYouTube(query: string): Promise<RawYtVideo[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]);

    const found: RawYtVideo[] = [];
    const seen = new Set<string>();

    function walk(obj: any) {
      if (!obj || typeof obj !== 'object') return;
      if (obj.videoRenderer && obj.videoRenderer.videoId) {
        const vr = obj.videoRenderer;
        const vid = String(vr.videoId);
        if (!seen.has(vid)) {
          seen.add(vid);
          const title = (vr.title?.runs || []).map((r: any) => r.text).join('').trim();
          const channel = (vr.ownerText?.runs || []).map((r: any) => r.text).join('').trim();
          const publishedTimeText = vr.publishedTimeText?.simpleText;
          const lengthText = vr.lengthText?.simpleText;
          const viewCountText = vr.viewCountText?.simpleText;
          if (title && channel) {
            found.push({
              videoId: vid,
              title,
              channel,
              publishedTimeText,
              lengthText,
              viewCountText,
              thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
            });
          }
        }
      }
      if (Array.isArray(obj)) {
        for (const item of obj) walk(item);
      } else {
        for (const key of Object.keys(obj)) {
          walk(obj[key]);
        }
      }
    }

    walk(data);
    return found;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function verifyWatchAndOembed(
  videoId: string
): Promise<{ ok: boolean; exactDate?: string; title?: string; author?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    // 1. oEmbed verifies video is public & embeddable
    const oeRes = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: controller.signal, headers: { 'User-Agent': UA } }
    );
    if (!oeRes.ok) return { ok: false };
    const oeJson = (await oeRes.json()) as { title?: string; author_name?: string };

    // 2. Fetch watch page dateText for exact publication date (YYYY-MM-DD)
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
    });
    let exactDate: string | undefined;
    if (watchRes.ok) {
      const html = await watchRes.text();
      const dateMatch =
        html.match(/"dateText":\{"simpleText":"([^"]+)"\}/) ||
        html.match(/"publishDate":\{"simpleText":"([^"]+)"\}/);
      if (dateMatch?.[1]) {
        exactDate = dateMatch[1];
      }
    }

    return {
      ok: true,
      exactDate,
      title: oeJson.title,
      author: oeJson.author_name,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function discoverForProject(project: Project): Promise<ProjectVideoItem[]> {
  const devShort = getDeveloperShortNames(project.developerName)[0] || '';
  const query1 = `${project.name} ${project.emirate} walkthrough tour`;
  const results1 = await searchYouTube(query1);

  let combinedRaw = [...results1];
  const matched1 = results1.filter((v) => isVideoRelevantToProject(v, project));

  // If fewer than 2 matched videos, run a second query including community & construction/review keywords
  if (matched1.length < 2) {
    const query2 = `${project.name} ${devShort} ${project.community.split(',')[0]} construction update`;
    const results2 = await searchYouTube(query2);
    const seenIds = new Set(combinedRaw.map((v) => v.videoId));
    for (const v of results2) {
      if (!seenIds.has(v.videoId)) {
        seenIds.add(v.videoId);
        combinedRaw.push(v);
      }
    }
  }

  const relevant = combinedRaw.filter((v) => isVideoRelevantToProject(v, project));
  if (relevant.length === 0) return [];

  // Score and pre-sort candidates before verifying oEmbed + exact dates (keep top 6 candidates to verify)
  const classifiedCandidates = relevant.map((v) => ({
    raw: v,
    meta: classifyVideo(v, project),
    approxDate: parseRelativeTimeToIso(v.publishedTimeText),
  }));

  classifiedCandidates.sort((a, b) => {
    if (a.meta.priorityLevel !== b.meta.priorityLevel) {
      return a.meta.priorityLevel - b.meta.priorityLevel;
    }
    return b.approxDate.localeCompare(a.approxDate);
  });

  const topCandidates = classifiedCandidates.slice(0, 5);
  const verifiedItems: ProjectVideoItem[] = [];

  for (const cand of topCandidates) {
    const check = await verifyWatchAndOembed(cand.raw.videoId);
    if (!check.ok) continue;

    const publishedAt = parseDateTextToIso(check.exactDate, cand.raw.publishedTimeText);
    verifiedItems.push({
      id: `${project.id}-yt-${cand.raw.videoId}`,
      projectId: project.id,
      title: check.title || cand.raw.title,
      channelName: check.author || cand.raw.channel,
      channelType: cand.meta.channelType,
      priorityLevel: cand.meta.priorityLevel,
      priorityLabel: cand.meta.priorityLabel,
      publishedAt,
      thumbnailUrl: cand.raw.thumbnailUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${cand.raw.videoId}`,
      sourceUrl: `https://www.youtube.com/watch?v=${cand.raw.videoId}`,
      videoCategory: cand.meta.videoCategory,
      duration: cand.raw.lengthText,
      viewCount: cand.raw.viewCountText,
      verifiedProjectSpecific: true,
      notes: `Verified YouTube match for ${project.name} (${project.community}, ${project.emirate}).${check.exactDate ? ` Uploaded ${check.exactDate}.` : ''}`,
    });
  }

  // Final sort: Independent Walkthrough (1) -> Independent Video (2) -> Official Developer (4), then newest first
  verifiedItems.sort((a, b) => {
    if (a.priorityLevel !== b.priorityLevel) {
      return a.priorityLevel - b.priorityLevel;
    }
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return verifiedItems;
}

async function run() {
  const outPath = path.resolve(__dirname, '../src/data/realVideoIndex.json');
  let existingIndex: Record<string, ProjectVideoItem[]> = {};
  if (fs.existsSync(outPath)) {
    try {
      existingIndex = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    } catch {
      existingIndex = {};
    }
  }

  const resultIndex: Record<string, ProjectVideoItem[]> = { ...existingIndex };
  const pending = EXCEL_182_PROJECTS.filter((p) => !(p.id in resultIndex));

  console.log(
    `Total projects: ${EXCEL_182_PROJECTS.length}. Already cached: ${
      Object.keys(resultIndex).length
    }. Discovering: ${pending.length}...`
  );

  const BATCH_SIZE = 8;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (proj) => {
        const videos = await discoverForProject(proj);
        return { id: proj.id, name: proj.name, videos };
      })
    );

    for (const r of batchResults) {
      resultIndex[r.id] = r.videos;
    }

    // Incremental save after every batch
    fs.writeFileSync(outPath, JSON.stringify(resultIndex, null, 2), 'utf-8');
    const matchedInBatch = batchResults.filter((r) => r.videos.length > 0).length;
    console.log(
      `Processed ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} (batch matches: ${matchedInBatch}/${batch.length})`
    );
  }

  let withVideos = 0;
  let independentPrimary = 0;
  let developerOnly = 0;
  let noVideos = 0;

  for (const p of EXCEL_182_PROJECTS) {
    const vids = resultIndex[p.id] || [];
    if (vids.length === 0) {
      noVideos++;
    } else {
      withVideos++;
      if (vids[0].priorityLevel === 1 || vids[0].priorityLevel === 2) {
        independentPrimary++;
      } else {
        developerOnly++;
      }
    }
  }

  console.log('=== REAL VIDEO DISCOVERY SUMMARY ===');
  console.log({
    totalProjects: EXCEL_182_PROJECTS.length,
    withVerifiedVideos: withVideos,
    independentPrimary,
    developerOnly,
    noVideosFound: noVideos,
  });
}

run().catch((err) => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
