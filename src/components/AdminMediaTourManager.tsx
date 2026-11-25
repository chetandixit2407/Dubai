import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  MediaCategory,
  MediaClassification,
  MediaSourcePriority,
  Project,
  ProjectMediaItem,
  TourAvailabilityStatus,
  VirtualTourHotspot,
  VirtualTourRoom,
} from '../types/realEstate.ts';
import {
  computeStringSha256,
  computeSyncFingerprint,
  evaluateProjectMedia,
  findImageCollision,
  MEDIA_CATEGORY_LABELS,
  MEDIA_CLASSIFICATION_LABELS,
  MISSING_PROJECT_PHOTO_LABEL,
  scanCatalogMediaAudit,
  TOUR_STATUS_LABELS,
} from '../utils/mediaValidation.ts';
import { VirtualTourModal } from './VirtualTourModal.tsx';

interface AdminMediaTourManagerProps {
  projects: Project[];
  canManageProjects: boolean;
  onSaveProjectMedia: (updated: Project) => Promise<void>;
  onNotify: (type: 'ok' | 'err', msg: string) => void;
}

function compressImageToDataUrl(
  file: File,
  maxWidth = 1280
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable for compression.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 180000 && quality > 0.45) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve({ dataUrl, width: img.width, height: img.height });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const AdminMediaTourManager: React.FC<AdminMediaTourManagerProps> = ({
  projects,
  canManageProjects,
  onSaveProjectMedia,
  onNotify,
}) => {
  const [selectedId, setSelectedId] = useState<string>(() => projects[0]?.id || '');
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) || projects[0],
    [projects, selectedId]
  );

  const [draft, setDraft] = useState<Project | null>(selectedProject ? { ...selectedProject } : null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [failedMediaUrls, setFailedMediaUrls] = useState<Set<string>>(() => new Set());
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedProject) {
      setDraft({
        ...selectedProject,
        mediaItems: [...(selectedProject.mediaItems || [])],
        virtualTour: {
          ...selectedProject.virtualTour,
          projectId: selectedProject.id,
          rooms: [...(selectedProject.virtualTour.rooms || [])],
        },
      });
    }
  }, [selectedProject]);

  // Add Photo Form State
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoImageHash, setPhotoImageHash] = useState('');
  const [photoCategory, setPhotoCategory] = useState<MediaCategory>('exterior');
  const [photoClass, setPhotoClass] = useState<MediaClassification>('actual_photograph');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoSource, setPhotoSource] = useState('');
  const [photoPriority, setPhotoPriority] = useState<MediaSourcePriority>(1);
  const [photoVerified, setPhotoVerified] = useState(true);

  // Add 360 Room Form State
  const [roomLabel, setRoomLabel] = useState('');
  const [roomFloor, setRoomFloor] = useState('Typical Floor');
  const [roomCategory, setRoomCategory] = useState<VirtualTourRoom['viewCategory']>('interior');
  const [roomImageUrl, setRoomImageUrl] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [roomSource, setRoomSource] = useState('');
  const [roomFloorPlanId, setRoomFloorPlanId] = useState('');
  const [roomIsTrue360, setRoomIsTrue360] = useState(true);
  const [aspectHint, setAspectHint] = useState<string | null>(null);

  // Hotspot Builder State
  const [hsTargetRoomIdx, setHsTargetRoomIdx] = useState<number>(0);
  const [hsLabel, setHsLabel] = useState('');
  const [hsDetail, setHsDetail] = useState('');
  const [hsYaw, setHsYaw] = useState<number>(0);
  const [hsPitch, setHsPitch] = useState<number>(0);
  const [hsJumpRoomId, setHsJumpRoomId] = useState<string>('');

  const completenessRows = useMemo(
    () => projects.map((p) => ({ project: p, report: evaluateProjectMedia(p) })),
    [projects]
  );

  const dashboardMetrics = useMemo(() => {
    const total = completenessRows.length;
    const ready = completenessRows.filter((r) => r.report.isPublishReady).length;
    const withActual = completenessRows.filter((r) => r.report.hasActualPhoto).length;
    const liveTours = completenessRows.filter(
      (r) => r.report.effectiveTourStatus !== 'coming_soon'
    ).length;
    return { total, ready, withActual, liveTours, comingSoon: total - liveTours };
  }, [completenessRows]);

  const catalogAudit = useMemo(() => scanCatalogMediaAudit(projects), [projects]);

  const draftReport = useMemo(() => (draft ? evaluateProjectMedia(draft) : null), [draft]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImageToDataUrl(file, 1280);
      const hash = await computeStringSha256(dataUrl);
      if (draft) {
        const collision = findImageCollision(dataUrl, hash, draft.id, projects);
        if (collision) {
          onNotify(
            'err',
            `Duplicate image blocked: this photograph already belongs to "${collision.projectName}". Every project must use its own unique imagery.`
          );
          return;
        }
      }
      setPhotoUrl(dataUrl);
      setPhotoImageHash(hash);
      if (!photoCaption.trim()) {
        setPhotoCaption(file.name.replace(/\.[^.]+$/, ''));
      }
      onNotify('ok', `Compressed & hashed image (${Math.round(dataUrl.length / 1024)} KB) ready to add.`);
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to process uploaded photo.');
    }
  };

  const handleRoomPanoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, width, height } = await compressImageToDataUrl(file, 1600);
      const ratio = width / Math.max(1, height);
      setRoomImageUrl(dataUrl);
      if (ratio < 1.8) {
        setRoomIsTrue360(false);
        setAspectHint(
          `Detected ${width}x${height} (ratio ${ratio.toFixed(2)}:1). Standard non-2:1 photos must NOT be marked as equirectangular 360° panoramas.`
        );
      } else {
        setRoomIsTrue360(true);
        setAspectHint(`Equirectangular ratio verified (${width}x${height}, ${ratio.toFixed(2)}:1).`);
      }
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to process panorama.');
    }
  };

  const handleAddPhotoToDraft = async () => {
    if (!draft) return;
    const trimmedUrl = photoUrl.trim();
    if (!trimmedUrl) {
      onNotify('err', 'Upload an image or paste an authorized developer image URL first.');
      return;
    }
    if (!photoSource.trim()) {
      onNotify('err', 'Every image must record its official source attribution.');
      return;
    }

    const resolvedHash =
      photoImageHash ||
      (trimmedUrl.startsWith('data:')
        ? await computeStringSha256(trimmedUrl)
        : computeSyncFingerprint(trimmedUrl.toLowerCase()));

    const collision = findImageCollision(trimmedUrl, resolvedHash, draft.id, projects);
    if (collision) {
      onNotify(
        'err',
        `Blocked cross-project duplicate: this image URL or hash already belongs to "${collision.projectName}" (${collision.projectId}).`
      );
      return;
    }

    const newItem: ProjectMediaItem = {
      id: `${draft.id}-media-${Date.now().toString(36)}`,
      projectId: draft.id,
      developerId: draft.developerId,
      url: trimmedUrl,
      imageHash: resolvedHash,
      category: photoCategory,
      classification: photoClass,
      caption: photoCaption.trim() || `${draft.name} — ${MEDIA_CATEGORY_LABELS[photoCategory]}`,
      sourceName: photoSource.trim(),
      sourcePriority: photoPriority,
      verifiedProjectSpecific: photoVerified,
      capturedAt: new Date().toISOString().slice(0, 10),
    };

    const nextMedia = [...(draft.mediaItems || []), newItem];
    const shouldPromoteHero = !draft.heroImage?.trim();
    setDraft({
      ...draft,
      heroImage: shouldPromoteHero ? newItem.url : draft.heroImage,
      heroImageHash: shouldPromoteHero ? resolvedHash : draft.heroImageHash,
      heroClassification: shouldPromoteHero ? newItem.classification : draft.heroClassification,
      heroSourceName: shouldPromoteHero ? newItem.sourceName : draft.heroSourceName,
      mediaItems: nextMedia,
      galleryImages: Array.from(
        new Set([shouldPromoteHero ? newItem.url : draft.heroImage, ...nextMedia.map((m) => m.url)].filter(Boolean))
      ).slice(0, 20),
    });
    setPhotoUrl('');
    setPhotoImageHash('');
    setPhotoCaption('');
    onNotify('ok', 'Added unique project-bound media item to draft. Save changes below to publish.');
  };

  const handleAddRoomToDraft = () => {
    if (!draft) return;
    if (!roomLabel.trim() || !roomImageUrl.trim()) {
      onNotify('err', 'Room title and panorama image are required.');
      return;
    }
    if (!roomIsTrue360) {
      onNotify(
        'err',
        'Cannot add a non-equirectangular photo as a 360° room. Upload a true 2:1 panorama or use Video / Matterport URL instead.'
      );
      return;
    }
    const newRoom: VirtualTourRoom = {
      id: `${draft.id}-room-${Date.now().toString(36)}`,
      projectId: draft.id,
      floorLevel: roomFloor.trim() || 'Typical Floor',
      viewCategory: roomCategory,
      label: roomLabel.trim(),
      imageUrl: roomImageUrl.trim(),
      isTrue360Panorama: true,
      description: roomDesc.trim() || `${draft.name} interactive 360° scene`,
      sourceName: roomSource.trim() || `${draft.developerName} Official 360° Capture`,
      yawOffset: 0,
      ...(roomFloorPlanId ? { floorPlanId: roomFloorPlanId } : {}),
      hotspots: [],
    };
    const nextRooms = [...(draft.virtualTour.rooms || []), newRoom];
    setDraft({
      ...draft,
      virtualTour: {
        ...draft.virtualTour,
        projectId: draft.id,
        available: true,
        tourStatus: '360_available',
        tourType: '360_panorama',
        provider: draft.virtualTour.provider || 'WhiteCollar360',
        rooms: nextRooms,
      },
    });
    setRoomLabel('');
    setRoomImageUrl('');
    setRoomDesc('');
    setAspectHint(null);
    onNotify('ok', `Added 360° scene "${newRoom.label}" to draft.`);
  };

  const handleAddHotspot = () => {
    if (!draft) return;
    const rooms = [...(draft.virtualTour.rooms || [])];
    const targetRoom = rooms[hsTargetRoomIdx];
    if (!targetRoom) {
      onNotify('err', 'Add a 360° room first before attaching hotspots.');
      return;
    }
    if (!hsLabel.trim()) {
      onNotify('err', 'Hotspot label is required.');
      return;
    }
    const hs: VirtualTourHotspot = {
      id: `hs-${Date.now().toString(36)}`,
      yawDeg: Math.max(-180, Math.min(180, Number(hsYaw) || 0)),
      pitchDeg: Math.max(-80, Math.min(80, Number(hsPitch) || 0)),
      label: hsLabel.trim(),
      ...(hsDetail.trim() ? { detail: hsDetail.trim() } : {}),
      ...(hsJumpRoomId ? { targetRoomId: hsJumpRoomId } : {}),
    };
    rooms[hsTargetRoomIdx] = {
      ...targetRoom,
      hotspots: [...(targetRoom.hotspots || []), hs],
    };
    setDraft({
      ...draft,
      virtualTour: {
        ...draft.virtualTour,
        rooms,
      },
    });
    setHsLabel('');
    setHsDetail('');
    onNotify('ok', `Added hotspot to "${targetRoom.label}".`);
  };

  const handleSaveDraft = async () => {
    if (!draft || !draftReport) return;
    // Mandatory validation check before committing tour / media state
    if (!draftReport.mediaBelongsToProject) {
      onNotify('err', 'Blocked: Every image and virtual tour room must match the selected project ID.');
      return;
    }
    if (!draftReport.hasSourceRecorded) {
      onNotify('err', 'Blocked: Every image and hero asset must have a recorded source attribution.');
      return;
    }
    if (!draftReport.hasConnectedTourIfAvailable || !draftReport.hasAccurateTourStatus) {
      onNotify(
        'err',
        'Blocked: Tour status must match connected assets (360° equirectangular rooms, Matterport/3D URL, or Video URL). Otherwise set status to Media Not Available.'
      );
      return;
    }

    setSaving(true);
    try {
      await onSaveProjectMedia({
        ...draft,
        heroClassification: draft.heroClassification || 'illustrative_image',
        heroSourceName: draft.heroSourceName || draft.developerName,
        virtualTour: {
          ...draft.virtualTour,
          projectId: draft.id,
        },
      });
      onNotify('ok', `Published updated media & virtual tour config for "${draft.name}".`);
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to save media configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. MEDIA COMPLETENESS DASHBOARD */}
      <div className="space-y-4 min-w-0">
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 min-w-0">
            <p className="text-xs text-[#A5A19A]">Total Listed Projects</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#F5F1E8] mt-1">
              {dashboardMetrics.total}
            </p>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 min-w-0">
            <p className="text-xs text-[#A5A19A]">Media Validation Passing</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#6EE7B7] mt-1">
              {dashboardMetrics.ready} / {dashboardMetrics.total}
            </p>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 min-w-0">
            <p className="text-xs text-[#A5A19A]">Verified Actual Site Photos</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#F5F1E8] mt-1">
              {dashboardMetrics.withActual}
            </p>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 min-w-0">
            <p className="text-xs text-[#A5A19A]">Live 360° / 3D / Video Tours</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#D4AF72] mt-1">
              {dashboardMetrics.liveTours}
            </p>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 min-w-0">
            <p className="text-xs text-[#A5A19A]">Media Not Available</p>
            <p className="font-mono-tabular text-2xl font-semibold text-[#FCD34D] mt-1">
              {dashboardMetrics.comingSoon}
            </p>
          </div>
        </div>

        <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8]">
                Media Completeness & Anti-Fake-Tour Audit Matrix
              </h3>
              <p className="text-xs text-[#A5A19A] mt-0.5">
                Every development requires unique project-specific photography (0 shared images allowed), explicit render vs. photograph labeling, recorded source priority, and accurate virtual tour status.
              </p>
            </div>
            <div className="text-xs font-mono-tabular flex flex-wrap items-center gap-3">
              <span
                className={
                  catalogAudit.projectsWithDuplicateImages === 0
                    ? 'text-[#6EE7B7] font-semibold'
                    : 'text-[#FCA5A5] font-semibold'
                }
              >
                Duplicate Images: {catalogAudit.projectsWithDuplicateImages}
              </span>
              <span className="text-[#FCD34D] font-semibold">
                Missing Photos: {catalogAudit.projectsWithMissingImages}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#D4AF72]/20 bg-[#121212] text-[#A5A19A]">
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Main Visual Type</th>
                  <th className="py-2.5 px-3">Media Assets</th>
                  <th className="py-2.5 px-3">Virtual Tour Status</th>
                  <th className="py-2.5 px-3">Completeness</th>
                  <th className="py-2.5 px-3">Missing / Audit Flags</th>
                  <th className="py-2.5 px-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4AF72]/15">
                {completenessRows.map(({ project, report }) => (
                  <tr
                    key={project.id}
                    className={selectedProject?.id === project.id ? 'bg-[#121212]' : 'hover:bg-[#121212]'}
                  >
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[#F5F1E8]">{project.name}</p>
                      <p className="text-[#A5A19A]">{project.emirate}</p>
                    </td>
                    <td className="py-2.5 px-3 text-[#F5F1E8]">
                      {MEDIA_CLASSIFICATION_LABELS[project.heroClassification || 'illustrative_image']}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#A5A19A]">
                      {report.totalMediaCount} files · {report.categoryCount} categories
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#F5F1E8]">
                      {TOUR_STATUS_LABELS[report.effectiveTourStatus]}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular">
                      <span
                        className={`font-semibold ${
                          report.isPublishReady ? 'text-[#6EE7B7]' : 'text-[#FCD34D]'
                        }`}
                      >
                        {report.completenessPct}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#A5A19A]">
                      {report.isPublishReady
                        ? 'All mandatory checks passed'
                        : report.missingReasons[0]}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(project.id);
                          workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-3 py-1.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] cursor-pointer"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. PROJECT-SPECIFIC MEDIA & 360 TOUR WORKSPACE */}
      {draft && draftReport && (
        <div ref={workspaceRef} className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D4AF72]/15">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72] break-all">
                Project-Bound Media & Tour Console (ID: {draft.id})
              </p>
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] break-words">
                {draft.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0">
              <select
                value={draft.id}
                onChange={(e) => setSelectedId(e.target.value)}
                aria-label="Select project to manage media"
                className="w-full sm:w-auto max-w-full min-w-0 h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] text-xs font-medium"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.emirate})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="h-9 px-4 border border-[#D4AF72]/35 text-[#F5F1E8] text-xs font-semibold hover:border-[#D4AF72] hover:text-[#D4AF72] flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Tour</span>
              </button>

              {canManageProjects && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="h-9 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Publishing...' : 'Save & Publish Media'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mandatory Publishing Validation Status Box */}
          <div
            className={`p-4 border text-xs flex flex-wrap items-center justify-between gap-3 ${
              draftReport.isPublishReady
                ? 'bg-[#064E3B]/45 border-[#34D399]/35 text-[#6EE7B7]'
                : 'bg-[#78350F]/45 border-[#FBBF24]/35 text-[#FCD34D]'
            }`}
          >
            <div className="flex items-start gap-2">
              {draftReport.isPublishReady ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  Publishing Gate: {draftReport.completenessPct}% Complete — Effective Tour Status:{' '}
                  {TOUR_STATUS_LABELS[draftReport.effectiveTourStatus]}
                </p>
                {draftReport.missingReasons.length > 0 && (
                  <ul className="list-disc ml-4 mt-1 space-y-0.5">
                    {draftReport.missingReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* A. PHOTOGRAPHY MANAGER */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#F5F1E8]">
              <Camera className="w-4 h-4 text-[#D4AF72]" />
              <h4 className="font-display text-xl font-semibold">
                Authentic Photography & Render Attribution ({(draft.mediaItems || []).length} items)
              </h4>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#121212] border border-[#D4AF72]/20 p-4 text-xs">
              <div className="lg:col-span-6 space-y-3">
                <p className="font-semibold text-[#F5F1E8]">Upload or Attach Verified Image</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#F5F1E8] hover:border-[#D4AF72] cursor-pointer flex items-center gap-1.5 font-medium">
                    <Upload className="w-3.5 h-3.5 text-[#D4AF72]" />
                    <span>Upload Image File</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  <input
                    type="url"
                    placeholder="Or paste official developer image URL..."
                    value={photoUrl.startsWith('data:') ? '' : photoUrl}
                    onChange={(e) => {
                      setPhotoUrl(e.target.value);
                      setPhotoImageHash('');
                    }}
                    className="w-full sm:flex-1 min-w-0 h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                  />
                </div>
                {photoUrl && (
                  <p className="text-[11px] text-[#6EE7B7] font-medium">
                    Image staged ({photoUrl.startsWith('data:') ? 'Compressed Data URL' : 'External URL'})
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Space Category</label>
                    <select
                      value={photoCategory}
                      onChange={(e) => setPhotoCategory(e.target.value as MediaCategory)}
                      className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                    >
                      {Object.entries(MEDIA_CATEGORY_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Visual Classification</label>
                    <select
                      value={photoClass}
                      onChange={(e) => setPhotoClass(e.target.value as MediaClassification)}
                      className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                    >
                      {Object.entries(MEDIA_CLASSIFICATION_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Source Attribution *</label>
                    <input
                      type="text"
                      placeholder="e.g. Official Emaar Gallery"
                      value={photoSource}
                      onChange={(e) => setPhotoSource(e.target.value)}
                      className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-[#A5A19A] mb-1">Sourcing Priority</label>
                    <select
                      value={photoPriority}
                      onChange={(e) =>
                        setPhotoPriority(Number(e.target.value) as MediaSourcePriority)
                      }
                      className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                    >
                      <option value={1}>1 · Official Developer Gallery</option>
                      <option value={2}>2 · Authorized Developer API / Feed</option>
                      <option value={3}>3 · Licensed Real Estate Photography</option>
                      <option value={4}>4 · White Collar Realty Verified Upload</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[#A5A19A] mb-1">Caption</label>
                  <input
                    type="text"
                    placeholder="e.g. Completed Podium Infinity Pool overlooking Marina"
                    value={photoCaption}
                    onChange={(e) => setPhotoCaption(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-[#F5F1E8]">
                    <input
                      type="checkbox"
                      checked={photoVerified}
                      onChange={(e) => setPhotoVerified(e.target.checked)}
                    />
                    <span>Verified Project-Specific Asset</span>
                  </label>
                  <button
                    type="button"
                    disabled={!canManageProjects}
                    onClick={handleAddPhotoToDraft}
                    className="h-9 px-4 bg-[#D4AF72] text-[#080808] font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Attach Image</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Existing Media Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(draft.mediaItems || []).map((item) => {
                const isHero = draft.heroImage === item.url;
                return (
                  <div key={item.id} className="border border-[#D4AF72]/20 bg-[#121212] p-3 text-xs space-y-2">
                    <div className="relative aspect-[16/10] bg-[#080808] overflow-hidden">
                      {failedMediaUrls.has(item.url) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                          <Camera className="w-6 h-6 text-[#D4AF72]/70 mb-1" />
                          <span className="text-[10px] text-[#A5A19A]">Preview Unavailable</span>
                        </div>
                      ) : (
                        <img
                          src={item.url}
                          alt={item.caption}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedMediaUrls((prev) => new Set(prev).add(item.url))
                          }
                          className="w-full h-full object-cover"
                        />
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-[#080808]/90 text-[#F5F1E8] text-[10px]">
                        {MEDIA_CLASSIFICATION_LABELS[item.classification]}
                      </span>
                      {isHero && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#D4AF72] text-[#080808] text-[10px] font-semibold">
                          Main Photo
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-[#F5F1E8] truncate">{item.caption}</p>
                      <p className="text-[#A5A19A]">
                        {MEDIA_CATEGORY_LABELS[item.category]} · Source: {item.sourceName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#D4AF72]/15">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            heroImage: item.url,
                            heroImageHash:
                              item.imageHash || computeSyncFingerprint(item.url.toLowerCase()),
                            heroClassification: item.classification,
                            heroSourceName: item.sourceName,
                          })
                        }
                        className="text-[#D4AF72] font-semibold hover:underline cursor-pointer"
                      >
                        {isHero ? 'Main Photo Active' : 'Set as Main'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            mediaItems: (draft.mediaItems || []).map((m) =>
                              m.id === item.id
                                ? { ...m, verifiedProjectSpecific: !m.verifiedProjectSpecific }
                                : m
                            ),
                          })
                        }
                        className={item.verifiedProjectSpecific ? 'text-[#6EE7B7] cursor-pointer' : 'text-[#FCD34D] cursor-pointer'}
                      >
                        {item.verifiedProjectSpecific ? 'Verified ✓' : 'Unverified'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = (draft.mediaItems || []).filter((m) => m.id !== item.id);
                          const removedWasHero = draft.heroImage === item.url;
                          const nextHero = removedWasHero ? remaining[0] : undefined;
                          setDraft({
                            ...draft,
                            heroImage: removedWasHero ? nextHero?.url || '' : draft.heroImage,
                            heroImageHash: removedWasHero
                              ? nextHero?.imageHash || ''
                              : draft.heroImageHash,
                            heroClassification: removedWasHero
                              ? nextHero?.classification || 'illustrative_image'
                              : draft.heroClassification,
                            heroSourceName: removedWasHero
                              ? nextHero?.sourceName || MISSING_PROJECT_PHOTO_LABEL
                              : draft.heroSourceName,
                            mediaItems: remaining,
                            galleryImages: remaining.map((m) => m.url).slice(0, 20),
                          });
                        }}
                        className="text-[#A5A19A] hover:text-[#FCA5A5] cursor-pointer"
                        aria-label="Remove media item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* B. 360° VIRTUAL TOUR & HOTSPOT MANAGER */}
          <div className="pt-5 border-t border-[#D4AF72]/15 space-y-4">
            <div className="flex items-center gap-2 text-[#F5F1E8]">
              <Compass className="w-4 h-4 text-[#D4AF72]" />
              <h4 className="font-display text-xl font-semibold">
                Project-Specific 360° / 3D / Video Virtual Tour Manager
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-[#121212] border border-[#D4AF72]/20 p-4">
              <div>
                <label className="block text-[#A5A19A] font-medium mb-1">Tour Availability Status</label>
                <select
                  value={draft.virtualTour.tourStatus || 'coming_soon'}
                  onChange={(e) => {
                    const nextStatus = e.target.value as TourAvailabilityStatus;
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        projectId: draft.id,
                        tourStatus: nextStatus,
                        available: nextStatus !== 'coming_soon',
                        tourType:
                          nextStatus === '360_available'
                            ? '360_panorama'
                            : nextStatus === '3d_available'
                            ? 'matterport_3d'
                            : nextStatus === 'video_available'
                            ? 'video_walkthrough'
                            : undefined,
                      },
                    });
                  }}
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                >
                  <option value="coming_soon">Media Not Available</option>
                  <option value="360_available">3D Virtual Tour Available (360°)</option>
                  <option value="3d_available">3D Virtual Tour Available (Matterport/WebXR)</option>
                  <option value="video_available">Video Walkthrough Available</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A5A19A] font-medium mb-1">Tour Provider / Engine</label>
                <select
                  value={draft.virtualTour.provider || 'WhiteCollar360'}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        provider: e.target.value as Project['virtualTour']['provider'],
                      },
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                >
                  <option value="WhiteCollar360">WhiteCollar 360° Panorama Engine</option>
                  <option value="Matterport">Matterport 3D Digital Twin</option>
                  <option value="DeveloperOfficial">Official Developer Interactive Tour</option>
                  <option value="WebXR">WebXR Spatial Experience</option>
                </select>
              </div>

              <div>
                <label className="block text-[#A5A19A] font-medium mb-1">
                  Matterport / 3D Tour Embed URL
                </label>
                <input
                  type="url"
                  placeholder="https://my.matterport.com/show/?m=..."
                  value={draft.virtualTour.embedUrl || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        embedUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                />
              </div>

              <div>
                <label className="block text-[#A5A19A] font-medium mb-1">
                  Walkthrough Video URL (MP4 / Stream)
                </label>
                <input
                  type="url"
                  placeholder="https://.../project-walkthrough.mp4"
                  value={draft.virtualTour.walkthroughVideoUrl || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        walkthroughVideoUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[#A5A19A] font-medium mb-1">Authorized WebXR URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://.../webxr-tour"
                  value={draft.virtualTour.webXrUrl || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        webXrUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[#A5A19A] font-medium mb-1">Tour Source Attribution</label>
                <input
                  type="text"
                  placeholder="e.g. Official Emaar Show Apartment 360° Capture"
                  value={draft.virtualTour.sourceName || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      virtualTour: {
                        ...draft.virtualTour,
                        sourceName: e.target.value,
                      },
                    })
                  }
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                />
              </div>
            </div>

            {/* 360° Panorama Scenes Builder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
              <div className="border border-[#D4AF72]/20 bg-[#121212] p-4 space-y-3">
                <h5 className="font-semibold text-[#F5F1E8]">
                  Add True 360° Equirectangular Scene (2:1 Panorama Only)
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Scene Name (e.g. Sky Lounge)"
                    value={roomLabel}
                    onChange={(e) => setRoomLabel(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60 min-w-0"
                  />
                  <input
                    type="text"
                    placeholder="Floor Level (e.g. Level 28)"
                    value={roomFloor}
                    onChange={(e) => setRoomFloor(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60 min-w-0"
                  />
                  <select
                    value={roomCategory}
                    onChange={(e) =>
                      setRoomCategory(e.target.value as VirtualTourRoom['viewCategory'])
                    }
                    className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] min-w-0"
                  >
                    <option value="interior">Interior Room</option>
                    <option value="exterior">Building Exterior</option>
                    <option value="amenities">Amenities & Pool</option>
                    <option value="villa_apartment">Villa / Apartment Unit</option>
                  </select>
                  <select
                    value={roomFloorPlanId}
                    onChange={(e) => setRoomFloorPlanId(e.target.value)}
                    className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] min-w-0"
                  >
                    <option value="">Link Floor Plan (Optional)</option>
                    {draft.floorPlans.map((fp) => (
                      <option key={fp.id} value={fp.id}>
                        {fp.name} ({fp.bedrooms})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#F5F1E8] hover:border-[#D4AF72] cursor-pointer flex items-center gap-1.5 font-medium">
                    <Upload className="w-3.5 h-3.5 text-[#D4AF72]" />
                    <span>Upload 360° Panorama</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleRoomPanoUpload} />
                  </label>
                  <input
                    type="url"
                    placeholder="Or paste 2:1 equirectangular URL..."
                    value={roomImageUrl.startsWith('data:') ? '' : roomImageUrl}
                    onChange={(e) => setRoomImageUrl(e.target.value)}
                    className="w-full sm:flex-1 min-w-0 h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                  />
                </div>

                {aspectHint && (
                  <p className={roomIsTrue360 ? 'text-[#6EE7B7]' : 'text-[#FCA5A5]'}>{aspectHint}</p>
                )}

                <label className="flex items-center gap-2 cursor-pointer text-[#F5F1E8]">
                  <input
                    type="checkbox"
                    checked={roomIsTrue360}
                    onChange={(e) => setRoomIsTrue360(e.target.checked)}
                  />
                  <span>Confirmed authentic 2:1 equirectangular 360° panorama</span>
                </label>

                <button
                  type="button"
                  disabled={!canManageProjects}
                  onClick={handleAddRoomToDraft}
                  className="h-9 px-4 bg-[#D4AF72] text-[#080808] font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add 360° Scene</span>
                </button>
              </div>

              {/* Interactive Hotspots Builder */}
              <div className="border border-[#D4AF72]/20 bg-[#121212] p-4 space-y-3 min-w-0">
                <h5 className="font-semibold text-[#F5F1E8]">
                  Connect Interactive Hotspots & Room Jumps
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <select
                    value={hsTargetRoomIdx}
                    onChange={(e) => setHsTargetRoomIdx(Number(e.target.value))}
                    className="w-full h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] sm:col-span-2 min-w-0"
                  >
                    {(draft.virtualTour.rooms || []).length === 0 ? (
                      <option value={0}>No 360° rooms created yet</option>
                    ) : (
                      (draft.virtualTour.rooms || []).map((r, idx) => (
                        <option key={r.id} value={idx}>
                          Room {idx + 1}: {r.label} ({r.floorLevel})
                        </option>
                      ))
                    )}
                  </select>

                  <input
                    type="text"
                    placeholder="Hotspot Label (e.g. Step to Terrace)"
                    value={hsLabel}
                    onChange={(e) => setHsLabel(e.target.value)}
                    className="h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                  />
                  <select
                    value={hsJumpRoomId}
                    onChange={(e) => setHsJumpRoomId(e.target.value)}
                    className="h-9 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8]"
                  >
                    <option value="">Info Callout Only (No Jump)</option>
                    {(draft.virtualTour.rooms || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        Jump to: {r.label}
                      </option>
                    ))}
                  </select>
                  <div>
                    <label className="block text-[#A5A19A] mb-0.5">Yaw (-180° to 180°)</label>
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={hsYaw}
                      onChange={(e) => setHsYaw(Number(e.target.value))}
                      className="w-full h-8 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-[#A5A19A] mb-0.5">Pitch (-80° to 80°)</label>
                    <input
                      type="number"
                      min={-80}
                      max={80}
                      value={hsPitch}
                      onChange={(e) => setHsPitch(Number(e.target.value))}
                      className="w-full h-8 px-2 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] font-mono-tabular"
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Optional architectural finish detail..."
                  value={hsDetail}
                  onChange={(e) => setHsDetail(e.target.value)}
                  className="w-full h-9 px-2.5 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60"
                />
                <button
                  type="button"
                  disabled={!canManageProjects || (draft.virtualTour.rooms || []).length === 0}
                  onClick={handleAddHotspot}
                  className="h-9 px-4 bg-[#D4AF72] text-[#080808] font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Attach Hotspot</span>
                </button>
              </div>
            </div>

            {/* Connected 360 Rooms List */}
            {(draft.virtualTour.rooms || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#A5A19A]">
                  Connected 360° Rooms ({(draft.virtualTour.rooms || []).length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(draft.virtualTour.rooms || []).map((room) => (
                    <div
                      key={room.id}
                      className="border border-[#D4AF72]/20 bg-[#121212] p-3 text-xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#F5F1E8] truncate">
                          {room.floorLevel} · {room.label}
                        </p>
                        <p className="text-[#A5A19A]">
                          {(room.hotspots || []).length} hotspots · {room.sourceName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = (draft.virtualTour.rooms || []).filter(
                            (r) => r.id !== room.id
                          );
                          setDraft({
                            ...draft,
                            virtualTour: {
                              ...draft.virtualTour,
                              rooms: remaining,
                              available:
                                remaining.length > 0 ||
                                Boolean(draft.virtualTour.embedUrl || draft.virtualTour.walkthroughVideoUrl),
                              tourStatus:
                                remaining.length > 0
                                  ? '360_available'
                                  : draft.virtualTour.embedUrl
                                  ? '3d_available'
                                  : draft.virtualTour.walkthroughVideoUrl
                                  ? 'video_available'
                                  : 'coming_soon',
                            },
                          });
                        }}
                        className="text-[#A5A19A] hover:text-[#FCA5A5] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {previewOpen && draft && (
        <VirtualTourModal
          project={draft}
          isPreview
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};
