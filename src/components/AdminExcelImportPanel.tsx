import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  ShieldAlert,
  Square,
  Upload,
} from 'lucide-react';
import {
  ExcelImportReport,
  Project,
  ProjectMediaItem,
  UserProfile,
} from '../types/realEstate.ts';
import {
  broadcastRealtimeEvent,
  retrieveProjectFromUrlOnServer,
  uploadExcelWorkbookOnServer,
} from '../services/apiClient.ts';
import {
  syncVerifiedCatalogToFirestore,
  upsertProjectsBatch,
} from '../services/firestoreService.ts';
import {
  collectGlobalImageKeys,
  scanCatalogMediaAudit,
} from '../utils/mediaValidation.ts';
import { EXCEL_182_IMPORT_REPORT } from '../data/uaeCatalog.ts';

interface AdminExcelImportPanelProps {
  projects: Project[];
  userProfile: UserProfile;
  canManageProjects: boolean;
  onNotify: (type: 'ok' | 'err', msg: string) => void;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read selected Excel file.'));
    reader.onload = () => {
      resolve(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  });
}

export const AdminExcelImportPanel: React.FC<AdminExcelImportPanelProps> = ({
  projects,
  userProfile,
  canManageProjects,
  onNotify,
}) => {
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [stagedProjects, setStagedProjects] = useState<Project[]>([]);
  const [importReport, setImportReport] = useState<ExcelImportReport | null>(
    EXCEL_182_IMPORT_REPORT
  );
  const [selectedFileName, setSelectedFileName] = useState<string>('uae_182_projects.xlsx');

  // Project-URL Metadata & Unique Photo Enrichment Batch State
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{
    processed: number;
    total: number;
    updated: number;
    skippedDuplicates: number;
    failed: number;
    currentProject: string;
  } | null>(null);
  const stopEnrichRef = useRef(false);

  const auditReport = useMemo(() => scanCatalogMediaAudit(projects), [projects]);

  const enrichCandidates = useMemo(
    () =>
      projects.filter(
        (p) =>
          Boolean(p.projectUrl?.trim()) &&
          (!p.heroImage?.trim() || (p.mediaItems || []).length === 0)
      ),
    [projects]
  );

  const handleExcelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileName(file.name);
    setParsing(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const existingSummary = projects.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        emirate: p.emirate,
        projectUrl: p.projectUrl || '',
        heroImage: p.heroImage || '',
        heroImageHash: p.heroImageHash || '',
        mediaItems: p.mediaItems || [],
        virtualTour: p.virtualTour,
        createdAt: p.createdAt || '',
      }));

      const res = await uploadExcelWorkbookOnServer({
        fileBase64,
        fileName: file.name,
        existingProjects: existingSummary,
      });

      setStagedProjects(res.projects);
      setImportReport(res.report);
      onNotify(
        'ok',
        `Parsed ${res.report.totalExcelRecords} Excel rows: ${res.report.successfullyImported} ready (${res.report.createdCount} new, ${res.report.updatedCount} updates).`
      );
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Failed to parse Excel workbook.');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const handleCommitBatchToFirestore = async () => {
    if (stagedProjects.length === 0) return;
    setCommitting(true);
    try {
      const savedCount = await upsertProjectsBatch(
        stagedProjects,
        userProfile.uid,
        userProfile.email,
        `Excel Batch ${importReport?.batchId || ''} from ${selectedFileName || 'workbook.xlsx'}`
      );
      await broadcastRealtimeEvent('project:updated', {
        imported: savedCount,
        batchId: importReport?.batchId,
      });
      onNotify(
        'ok',
        `Committed ${savedCount} projects to Firestore cleanly without duplicates.`
      );
      setStagedProjects([]);
    } catch (err) {
      onNotify('err', err instanceof Error ? err.message : 'Firestore batch import failed.');
    } finally {
      setCommitting(false);
    }
  };

  const handleDownloadJsonReport = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunUrlEnrichment = async () => {
    if (enrichCandidates.length === 0) {
      onNotify('ok', 'All projects with official URLs already have unique media attached.');
      return;
    }

    stopEnrichRef.current = false;
    setEnriching(true);

    const globalKeys = collectGlobalImageKeys(projects);
    const updatedBatch: Project[] = [];
    let processed = 0;
    let updated = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    setEnrichProgress({
      processed: 0,
      total: enrichCandidates.length,
      updated: 0,
      skippedDuplicates: 0,
      failed: 0,
      currentProject: enrichCandidates[0]?.name || '',
    });

    for (const proj of enrichCandidates) {
      if (stopEnrichRef.current) break;

      setEnrichProgress({
        processed,
        total: enrichCandidates.length,
        updated,
        skippedDuplicates,
        failed,
        currentProject: proj.name,
      });

      try {
        const res = await retrieveProjectFromUrlOnServer({
          projectId: proj.id,
          projectName: proj.name,
          projectUrl: proj.projectUrl || '',
          existingHashes: Array.from(globalKeys),
        });

        skippedDuplicates += res.skippedDuplicates;

        const nextMedia: ProjectMediaItem[] = [...(proj.mediaItems || [])];
        for (let idx = 0; idx < res.verifiedImages.length; idx++) {
          const img = res.verifiedImages[idx];
          globalKeys.add(img.imageHash.toLowerCase());
          nextMedia.push({
            id: `${proj.id}-url-${Date.now().toString(36)}-${idx}`,
            projectId: proj.id,
            developerId: proj.developerId,
            url: img.url,
            imageHash: img.imageHash,
            category: idx === 0 ? 'exterior' : 'amenities_pool',
            classification: img.classification,
            caption: `${proj.name} — Verified Official Project Visual`,
            sourceName: img.sourceName,
            sourcePriority: 1,
            verifiedProjectSpecific: true,
            capturedAt: new Date().toISOString().slice(0, 10),
          });
        }

        const firstImg = res.verifiedImages[0];
        const hasNewTour = Boolean(res.tourEmbedUrl && !proj.virtualTour.embedUrl);
        const hasChanges =
          nextMedia.length > (proj.mediaItems || []).length ||
          Boolean(res.description && res.description.length > proj.description.length) ||
          Boolean(res.brochureUrl) ||
          hasNewTour ||
          Boolean(res.startingPriceAed && proj.startingPriceAed <= 0);

        if (hasChanges) {
          const patched: Project = {
            ...proj,
            description:
              res.description && res.description.length > proj.description.length
                ? res.description
                : proj.description,
            startingPriceAed:
              proj.startingPriceAed <= 0 && res.startingPriceAed
                ? res.startingPriceAed
                : proj.startingPriceAed,
            brochureUrl: res.brochureUrl || proj.brochureUrl,
            heroImage: proj.heroImage || firstImg?.url || '',
            heroImageHash: proj.heroImageHash || firstImg?.imageHash || '',
            heroClassification: firstImg?.classification || proj.heroClassification,
            heroSourceName: firstImg?.sourceName || proj.heroSourceName,
            mediaItems: nextMedia,
            galleryImages: nextMedia.map((m) => m.url).slice(0, 16),
            virtualTour: hasNewTour
              ? {
                  ...proj.virtualTour,
                  projectId: proj.id,
                  available: true,
                  tourStatus: '3d_available',
                  provider: res.tourEmbedUrl.includes('matterport')
                    ? 'Matterport'
                    : 'DeveloperOfficial',
                  tourType: 'matterport_3d',
                  embedUrl: res.tourEmbedUrl,
                  sourceName: `${res.sourceHost} Official Virtual Tour`,
                }
              : proj.virtualTour,
            updatedAt: new Date().toISOString(),
          };
          updatedBatch.push(patched);
          updated++;
        }
      } catch {
        failed++;
      }

      processed++;
    }

    if (updatedBatch.length > 0) {
      try {
        await upsertProjectsBatch(
          updatedBatch,
          userProfile.uid,
          userProfile.email,
          `Project-URL Verification & Unique Photo Retrieval (${updatedBatch.length} enriched)`
        );
        await broadcastRealtimeEvent('project:updated', { enriched: updatedBatch.length });
        onNotify(
          'ok',
          `Verified ${processed} project URLs: updated ${updated} projects (${skippedDuplicates} duplicate images blocked).`
        );
      } catch (err) {
        onNotify('err', err instanceof Error ? err.message : 'Failed to commit URL updates.');
      }
    } else {
      onNotify(
        'ok',
        `Scanned ${processed} project URLs (${skippedDuplicates} duplicate images skipped, ${failed} unreachable).`
      );
    }

    setEnrichProgress({
      processed,
      total: enrichCandidates.length,
      updated,
      skippedDuplicates,
      failed,
      currentProject: 'Completed',
    });
    setEnriching(false);
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. LIVE DATABASE MEDIA, DUPLICATE-IMAGE & 360° AUDIT REPORT */}
      <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
              Strict Anti-Duplication & Media Verification Report
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8]">
              Database Media, URL & 360° Tour Integrity Audit
            </h3>
          </div>
          <button
            type="button"
            onClick={() =>
              handleDownloadJsonReport(
                `white-collar-media-audit-${new Date().toISOString().slice(0, 10)}.json`,
                auditReport
              )
            }
            className="h-9 px-3.5 border border-[#D4AF72]/25 bg-[#121212] text-[#F5F1E8] hover:border-[#D4AF72] text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#D4AF72]" />
            <span>Download Audit JSON</span>
          </button>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 text-xs">
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3 min-w-0">
            <p className="text-[#A5A19A]">Total Projects</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#F5F1E8] mt-1">
              {auditReport.totalProjects}
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">Verified Real Photos</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#6EE7B7] mt-1">
              {auditReport.projectsWithVerifiedRealImages}
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">Renders Only</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#F5F1E8] mt-1">
              {auditReport.projectsWithRendersOnly}
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">Missing Photos</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#FCD34D] mt-1">
              {auditReport.projectsWithMissingImages}
            </p>
          </div>
          <div
            className={`border p-3 ${
              auditReport.projectsWithDuplicateImages === 0
                ? 'bg-[#064E3B]/45 border-[#34D399]/35'
                : 'bg-[#7F1D1D]/45 border-[#F87171]/35'
            }`}
          >
            <p className="text-[#F5F1E8]">Duplicate Images</p>
            <p
              className={`font-mono-tabular text-xl font-semibold mt-1 ${
                auditReport.projectsWithDuplicateImages === 0
                  ? 'text-[#6EE7B7]'
                  : 'text-[#FCA5A5]'
              }`}
            >
              {auditReport.projectsWithDuplicateImages}
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">3D / 360° Tours</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#D4AF72] mt-1">
              {auditReport.projectsWithGenuine360Tours +
                projects.filter((p) => p.virtualTour?.tourStatus === '3d_available').length}
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">Verified Videos (Indep.)</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#6EE7B7] mt-1">
              {projects.filter((p) => (p.videoItems?.length || 0) > 0).length} (
              {(auditReport.projectsWithIndependentWalkthroughs || 0) +
                (auditReport.projectsWithConstructionVideos || 0)}
              )
            </p>
          </div>
          <div className="bg-[#121212] border border-[#D4AF72]/15 p-3">
            <p className="text-[#A5A19A]">Media Not Available</p>
            <p className="font-mono-tabular text-xl font-semibold text-[#FCD34D] mt-1">
              {auditReport.projectsWithMediaNotAvailable ?? auditReport.projectsWithMissingTours}
            </p>
          </div>
        </div>

        {auditReport.duplicateCollisions.length > 0 ? (
          <div className="bg-[#7F1D1D]/45 border border-[#F87171]/35 p-4 text-xs text-[#FCA5A5] space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                Cross-Project Duplicate Images Detected ({auditReport.duplicateCollisions.length}{' '}
                collisions) — Open Media & 360° Tours tab to replace shared photos:
              </span>
            </div>
            <ul className="list-disc ml-5 space-y-1">
              {auditReport.duplicateCollisions.slice(0, 8).map((c) => (
                <li key={c.imageHash}>
                  <strong>{c.projectNames.join(' & ')}</strong> share asset{' '}
                  <span className="font-mono-tabular">{c.imageUrl.slice(0, 70)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-[#064E3B]/45 border border-[#34D399]/35 px-4 py-2.5 text-xs text-[#6EE7B7] flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Zero-Duplicate Policy Verified: 0 projects share identical photographs or image hashes.
            </span>
          </div>
        )}
      </div>

      {/* 2. EXCEL WORKBOOK (.XLSX / .XLS / .CSV) 182+ RECORD SYNCHRONIZATION */}
      <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl min-w-0">
            <div className="flex items-center gap-2 text-[#D4AF72] text-xs font-semibold uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Excel Workbook Synchronization</span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] mt-1">
              Import & Sync UAE Projects Workbook (.xlsx / .xls / .csv)
            </h3>
            <p className="text-xs text-[#A5A19A] mt-1 leading-relaxed">
              Imports every row without skipping, preserves exact project names, locations, Emirates, and project URLs, assigns deterministic stable project IDs so re-uploading updates existing records with zero duplicates, and verifies all image URLs against cross-project collisions.
            </p>
          </div>

          <label
            className={`h-10 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] cursor-pointer flex items-center gap-2 transition-colors shrink-0 ${
              !canManageProjects || parsing ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{parsing ? 'Parsing Excel Workbook...' : 'Select Excel File (.xlsx / .xls)'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              disabled={!canManageProjects || parsing}
              onChange={handleExcelFileSelected}
            />
          </label>
        </div>

        {/* Import Verification Report */}
        {importReport && (
          <div className="border border-[#D4AF72]/20 bg-[#121212] p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                  Mandatory Excel Import Verification Report
                </p>
                <h4 className="font-display text-lg sm:text-xl font-semibold text-[#F5F1E8] break-words">
                  {importReport.fileName} · Batch {importReport.batchId}
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadJsonReport(
                      `excel-import-report-${importReport.batchId}.json`,
                      importReport
                    )
                  }
                  className="h-9 px-3 border border-[#D4AF72]/25 bg-[#1B1B1B] text-[#F5F1E8] text-xs font-medium hover:border-[#D4AF72] flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4AF72]" />
                  <span>Export Report JSON</span>
                </button>
                {stagedProjects.length > 0 && canManageProjects ? (
                  <button
                    type="button"
                    disabled={committing}
                    onClick={handleCommitBatchToFirestore}
                    className="h-9 px-4 bg-[#064E3B] border border-[#34D399]/40 text-[#6EE7B7] text-xs font-semibold hover:bg-[#047857] hover:text-[#F5F1E8] disabled:opacity-50 cursor-pointer"
                  >
                    {committing
                      ? 'Syncing to Firestore...'
                      : `Commit ${stagedProjects.length} Projects to Database`}
                  </button>
                ) : (
                  canManageProjects && (
                    <button
                      type="button"
                      disabled={committing}
                      onClick={async () => {
                        setCommitting(true);
                        try {
                          const synced = await syncVerifiedCatalogToFirestore(
                            userProfile.uid,
                            userProfile.email,
                            true
                          );
                          await broadcastRealtimeEvent('project:updated', { imported: synced });
                          onNotify(
                            'ok',
                            `Synchronized all ${synced} verified Excel projects to Firestore.`
                          );
                        } catch (err) {
                          onNotify(
                            'err',
                            err instanceof Error ? err.message : 'Firestore catalog sync failed.'
                          );
                        } finally {
                          setCommitting(false);
                        }
                      }}
                      className="h-9 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] disabled:opacity-50 cursor-pointer"
                    >
                      {committing
                        ? 'Syncing 182 Projects...'
                        : 'Sync All 182 Projects to Firestore'}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3 min-w-0">
                <span className="text-[#A5A19A] block">Total Excel Records</span>
                <strong className="font-mono-tabular text-lg text-[#F5F1E8]">
                  {importReport.totalExcelRecords}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Ready / Imported</span>
                <strong className="font-mono-tabular text-lg text-[#6EE7B7]">
                  {importReport.successfullyImported} ({importReport.createdCount} new ·{' '}
                  {importReport.updatedCount} updates)
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Failed Imports</span>
                <strong
                  className={`font-mono-tabular text-lg ${
                    importReport.failedImports > 0 ? 'text-[#FCA5A5]' : 'text-[#6EE7B7]'
                  }`}
                >
                  {importReport.failedImports}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Missing Project URLs</span>
                <strong className="font-mono-tabular text-lg text-[#FCD34D]">
                  {importReport.missingProjectUrls}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Duplicate Rows in File</span>
                <strong className="font-mono-tabular text-lg text-[#F5F1E8]">
                  {importReport.duplicateRecordsInFile}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Verified Project Photos</span>
                <strong className="font-mono-tabular text-lg text-[#F5F1E8]">
                  {importReport.projectsWithVerifiedPhotos}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Available 360° / 3D Tours</span>
                <strong className="font-mono-tabular text-lg text-[#D4AF72]">
                  {importReport.projectsWithAvailable360Tours}
                </strong>
              </div>
              <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
                <span className="text-[#A5A19A] block">Commit Status</span>
                <strong className="font-mono-tabular text-sm text-[#F5F1E8]">
                  {stagedProjects.length > 0 ? 'Staged · Click Commit' : 'Committed to Firestore'}
                </strong>
              </div>
            </div>

            {importReport.errors.length > 0 && (
              <div className="bg-[#7F1D1D]/45 border border-[#F87171]/35 p-3 text-xs text-[#FCA5A5] space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Row Warnings / Failed Rows ({importReport.errors.length})</span>
                </p>
                {importReport.errors.slice(0, 12).map((err, idx) => (
                  <p key={idx}>
                    Row {err.row}
                    {err.projectName ? ` (${err.projectName})` : ''}: {err.reason}
                  </p>
                ))}
              </div>
            )}

            {stagedProjects.length > 0 && (
              <div className="max-h-64 overflow-x-auto overflow-y-auto border border-[#D4AF72]/20 bg-[#080808]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D4AF72]/20 bg-[#121212] text-[#A5A19A]">
                      <th className="py-2 px-3">Project Name</th>
                      <th className="py-2 px-3">Emirate & Location</th>
                      <th className="py-2 px-3">Developer</th>
                      <th className="py-2 px-3">Project URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AF72]/10">
                    {stagedProjects.slice(0, 50).map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-medium text-[#F5F1E8]">{p.name}</td>
                        <td className="py-2 px-3 text-[#A5A19A]">
                          {p.community}, {p.emirate}
                        </td>
                        <td className="py-2 px-3 text-[#A5A19A]">{p.developerName}</td>
                        <td className="py-2 px-3 font-mono-tabular text-[#A5A19A] truncate max-w-[220px]">
                          {p.projectUrl || 'Missing URL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stagedProjects.length > 50 && (
                  <p className="p-2 text-[11px] text-[#A5A19A] text-center border-t border-[#D4AF72]/15">
                    Showing first 50 of {stagedProjects.length} parsed projects. All{' '}
                    {stagedProjects.length} will be committed.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. PROJECT-URL VERIFIED METADATA, BROCHURE, UNIQUE PHOTO & 360° LINK RETRIEVER */}
      <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 p-4 sm:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl min-w-0">
            <div className="flex items-center gap-2 text-[#D4AF72] text-xs font-semibold uppercase tracking-wider">
              <Globe className="w-4 h-4 shrink-0" />
              <span>Project-URL Verification & Unique Photo Retrieval</span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F1E8] mt-1">
              Retrieve Verified Info & Unique Photos from Project URLs
            </h3>
            <p className="text-xs text-[#A5A19A] mt-1">
              Scans each project’s official Project URL via SSRF-safe HTTPS fetch to extract verified descriptions, brochures, Matterport/360° links, and SHA-256 deduplicated project-specific photos. Currently{' '}
              <strong className="font-mono-tabular text-[#F5F1E8]">{enrichCandidates.length}</strong> projects have a Project URL and await unique photography.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {enriching ? (
              <button
                type="button"
                onClick={() => {
                  stopEnrichRef.current = true;
                }}
                className="h-10 px-4 bg-[#7F1D1D] border border-[#F87171]/40 text-[#FCA5A5] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Retrieval</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!canManageProjects || enrichCandidates.length === 0}
                onClick={handleRunUrlEnrichment}
                className="h-10 px-4 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retrieve Unique Info & Photos ({enrichCandidates.length})</span>
              </button>
            )}
          </div>
        </div>

        {enrichProgress && (
          <div className="bg-[#121212] border border-[#D4AF72]/20 p-4 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#F5F1E8]">
                {enriching ? `Fetching: ${enrichProgress.currentProject}` : 'Retrieval Finished'}
              </span>
              <span className="font-mono-tabular text-[#A5A19A]">
                {enrichProgress.processed} / {enrichProgress.total} processed ·{' '}
                <strong className="text-[#6EE7B7]">{enrichProgress.updated} updated</strong> ·{' '}
                {enrichProgress.skippedDuplicates} duplicates blocked · {enrichProgress.failed}{' '}
                unreachable
              </span>
            </div>
            <div className="w-full h-2 bg-[#080808] border border-[#D4AF72]/15">
              <div
                className="h-full bg-[#D4AF72] transition-all"
                style={{
                  width: `${
                    enrichProgress.total > 0
                      ? Math.round((enrichProgress.processed / enrichProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
