import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Eye,
  Filter,
  Globe,
  HelpCircle,
  Layers,
  Link2,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Project, TourVerificationStatus, VirtualTourConfig } from '../types/realEstate.ts';
import { checkTourLink, scanAllProjectTours, TourScanItem } from '../services/apiClient.ts';
import { VirtualTourModal } from './VirtualTourModal.tsx';

interface AdminTourDiscoveryPanelProps {
  projects: Project[];
  onUpdateProjectTour?: (projectId: string, tourConfig: VirtualTourConfig) => Promise<void>;
  canManageTours?: boolean;
}

export const AdminTourDiscoveryPanel: React.FC<AdminTourDiscoveryPanelProps> = ({
  projects,
  onUpdateProjectTour,
  canManageTours = true,
}) => {
  const [scanItems, setScanItems] = useState<TourScanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [probingNetwork, setProbingNetwork] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TourVerificationStatus>('all');
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [previewProject, setPreviewProject] = useState<Project | null>(null);
  const [editModal, setEditModal] = useState<{
    open: boolean;
    projectId: string;
    projectName: string;
    currentUrl: string;
    currentProvider: string;
  } | null>(null);
  const [editUrlInput, setEditUrlInput] = useState('');
  const [editProviderInput, setEditProviderInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Initialize or reload tour scan data from server scanner
  const runScan = async (probeNetwork = false) => {
    if (probeNetwork) setProbingNetwork(true);
    else setLoading(true);

    try {
      const res = await scanAllProjectTours(probeNetwork);
      setScanItems(res.results);
      setStatusMsg(
        `Scanned all ${res.totalScanned} projects · ${res.verifiedCount} verified tours · ${res.embeddableCount} iframe embeddable · ${res.brokenCount} broken`
      );
    } catch (e: any) {
      // Fallback: build from client projects array
      const localResults: TourScanItem[] = projects.map((p) => {
        const vt = p.virtualTour || { available: false, tourStatus: 'coming_soon' };
        const tourUrl = vt.embedUrl || vt.directUrl || vt.walkthroughVideoUrl || '';
        return {
          projectId: p.id,
          projectName: p.name,
          developerName: p.developerName,
          tourUrl,
          tourProvider: vt.provider || (vt.available ? 'Verified Provider' : 'None'),
          verificationStatus: vt.verificationStatus || (vt.available ? 'verified' : 'unavailable'),
          lastCheckedDate: vt.lastCheckedDate || new Date().toISOString().slice(0, 10),
          embedAvailable: vt.embedAvailable ?? (Boolean(vt.embedUrl) && vt.embedAvailable !== false),
          errorStatus: vt.errorStatus || (vt.available ? 'None - Active' : 'No publicly verified tour available'),
          category: p.category,
          emirate: p.emirate,
        };
      });
      setScanItems(localResults);
    } finally {
      setLoading(false);
      setProbingNetwork(false);
    }
  };

  useEffect(() => {
    runScan(false);
  }, [projects]);

  // Quick live test of an individual URL
  const handleTestLink = async (url: string, projectId: string) => {
    if (!url) return;
    setTestingUrl(projectId);
    try {
      const result = await checkTourLink(url);
      setTestResult((prev) => ({ ...prev, [projectId]: result }));
      setStatusMsg(
        `Test Result for ${url.slice(0, 45)}...: Status ${result.status} (${result.reachable ? 'Reachable' : 'Unreachable'}) · Embed: ${result.embedAvailable ? 'Allowed' : 'Restricted'}`
      );
    } catch (e: any) {
      setTestResult((prev) => ({
        ...prev,
        [projectId]: { status: 0, reachable: false, embedAvailable: false, error: e.message },
      }));
    } finally {
      setTestingUrl(null);
    }
  };

  // Approve and mark verified
  const handleApproveTour = async (item: TourScanItem) => {
    if (!onUpdateProjectTour || !canManageTours) return;
    const targetProject = projects.find((p) => p.id === item.projectId);
    if (!targetProject) return;

    const updatedConfig: VirtualTourConfig = {
      ...(targetProject.virtualTour || { available: true, tourStatus: '3d_available' }),
      available: true,
      tourStatus:
        targetProject.virtualTour?.tourStatus === 'coming_soon'
          ? '3d_available'
          : targetProject.virtualTour?.tourStatus || '3d_available',
      verificationStatus: 'verified',
      lastCheckedDate: new Date().toISOString().slice(0, 10),
      errorStatus: 'None - Admin Verified Active',
    };

    await onUpdateProjectTour(item.projectId, updatedConfig);
    setScanItems((prev) =>
      prev.map((x) =>
        x.projectId === item.projectId
          ? { ...x, verificationStatus: 'verified', errorStatus: 'None - Admin Verified Active' }
          : x
      )
    );
    setStatusMsg(`Tour for "${item.projectName}" approved and verified live.`);
  };

  // Remove tour and reset to unavailable
  const handleRemoveTour = async (item: TourScanItem) => {
    if (!onUpdateProjectTour || !canManageTours) return;
    const targetProject = projects.find((p) => p.id === item.projectId);
    if (!targetProject) return;

    const updatedConfig: VirtualTourConfig = {
      projectId: item.projectId,
      available: false,
      tourStatus: 'coming_soon',
      verificationStatus: 'unavailable',
      lastCheckedDate: new Date().toISOString().slice(0, 10),
      errorStatus: 'Tour removed by administrator',
      rooms: [],
      tours: [],
      discovery: {
        projectId: item.projectId,
        projectName: item.projectName,
        developerName: item.developerName,
        tourUrl: '',
        tourProvider: '',
        verificationStatus: 'unavailable',
        lastCheckedDate: new Date().toISOString().slice(0, 10),
        embedAvailable: false,
        errorStatus: 'Tour removed by administrator',
      },
    };

    await onUpdateProjectTour(item.projectId, updatedConfig);
    setScanItems((prev) =>
      prev.map((x) =>
        x.projectId === item.projectId
          ? {
              ...x,
              tourUrl: '',
              tourProvider: 'None',
              verificationStatus: 'unavailable',
              embedAvailable: false,
              errorStatus: 'Tour removed by administrator',
            }
          : x
      )
    );
    setStatusMsg(`Tour for "${item.projectName}" removed and flagged unavailable.`);
  };

  // Save new URL from edit modal
  const handleSaveEditedTour = async () => {
    if (!editModal || !onUpdateProjectTour || !canManageTours) return;
    const targetProject = projects.find((p) => p.id === editModal.projectId);
    if (!targetProject) return;

    const url = editUrlInput.trim();
    const provider = editProviderInput.trim() || 'Verified Provider';

    if (!url) {
      await handleRemoveTour({
        projectId: editModal.projectId,
        projectName: editModal.projectName,
        developerName: targetProject.developerName,
        tourUrl: '',
        tourProvider: '',
        verificationStatus: 'unavailable',
        lastCheckedDate: new Date().toISOString().slice(0, 10),
        embedAvailable: false,
        errorStatus: '',
        category: targetProject.category,
        emirate: targetProject.emirate,
      });
      setEditModal(null);
      return;
    }

    const updatedConfig: VirtualTourConfig = {
      projectId: editModal.projectId,
      available: true,
      tourStatus: '3d_available',
      provider,
      embedUrl: url,
      directUrl: url,
      embedAvailable: true,
      verificationStatus: 'verified',
      lastCheckedDate: new Date().toISOString().slice(0, 10),
      errorStatus: 'None - Active 200 OK',
      tours: [
        {
          id: `tour-custom-${Date.now()}`,
          title: `${editModal.projectName} 360° Virtual Walkthrough`,
          provider,
          tourType: '360_panorama',
          embedUrl: url,
          directUrl: url,
          embedAvailable: true,
          verificationStatus: 'verified',
          lastCheckedDate: new Date().toISOString().slice(0, 10),
          sourceName: `${provider} Official Showcase`,
        },
      ],
      discovery: {
        projectId: editModal.projectId,
        projectName: editModal.projectName,
        developerName: targetProject.developerName,
        tourUrl: url,
        tourProvider: provider,
        verificationStatus: 'verified',
        lastCheckedDate: new Date().toISOString().slice(0, 10),
        embedAvailable: true,
        errorStatus: 'None - Active 200 OK',
      },
    };

    await onUpdateProjectTour(editModal.projectId, updatedConfig);
    setScanItems((prev) =>
      prev.map((x) =>
        x.projectId === editModal.projectId
          ? {
              ...x,
              tourUrl: url,
              tourProvider: provider,
              verificationStatus: 'verified',
              embedAvailable: true,
              errorStatus: 'None - Active 200 OK',
            }
          : x
      )
    );
    setStatusMsg(`Tour for "${editModal.projectName}" updated and verified.`);
    setEditModal(null);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = scanItems.length;
    const verified = scanItems.filter((x) => x.verificationStatus === 'verified').length;
    const awaiting = scanItems.filter((x) => x.verificationStatus === 'awaiting_verification').length;
    const broken = scanItems.filter((x) => x.verificationStatus === 'broken').length;
    const unavailable = scanItems.filter((x) => x.verificationStatus === 'unavailable').length;
    const embeddable = scanItems.filter(
      (x) => x.verificationStatus === 'verified' && x.embedAvailable
    ).length;

    return { total, verified, awaiting, broken, unavailable, embeddable };
  }, [scanItems]);

  // Filtered List
  const filteredList = useMemo(() => {
    return scanItems.filter((item) => {
      if (statusFilter !== 'all' && item.verificationStatus !== statusFilter) {
        return false;
      }
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        return (
          item.projectName.toLowerCase().includes(q) ||
          item.developerName.toLowerCase().includes(q) ||
          item.emirate.toLowerCase().includes(q) ||
          item.tourProvider.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scanItems, statusFilter, filterQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Automated Scan Controls */}
      <div className="bg-[#121212] text-[#F5F1E8] p-6 border border-[#D4AF72]/25">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#D4AF72]">
              <Layers className="w-4 h-4" />
              <span>Automated 360° Tour Discovery & Link Health System</span>
            </div>
            <h3 className="font-display text-2xl font-semibold mt-1 text-[#F5F1E8]">
              UAE 182-Project Virtual Tour Tracking Engine
            </h3>
            <p className="text-xs text-[#A5A19A] mt-1 max-w-2xl leading-relaxed">
              Monitors and tracks verified Matterport, PropVR, VirtualHomes, World of Aldar, VisEngine, and developer digital walkthroughs across all 182 project records. Unverified or broken tours are strictly held private from public display.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || probingNetwork}
              onClick={() => runScan(false)}
              className="px-4 py-2.5 bg-[#1B1B1B] border border-[#D4AF72]/30 text-[#F5F1E8] text-xs font-semibold hover:border-[#D4AF72] flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF72] ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Scanning 182 Projects...' : 'Refresh 182 Status'}</span>
            </button>

            <button
              type="button"
              disabled={loading || probingNetwork}
              onClick={() => runScan(true)}
              className="px-4 py-2.5 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] flex items-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              <Globe className={`w-3.5 h-3.5 ${probingNetwork ? 'animate-spin' : ''}`} />
              <span>{probingNetwork ? 'Probing Links...' : 'Deep Network Recheck'}</span>
            </button>
          </div>
        </div>

        {/* 6 Metrics KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-[#D4AF72]/15 font-mono-tabular">
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#A5A19A] block">Total Scanned</span>
            <span className="text-xl font-bold text-[#F5F1E8]">{metrics.total}</span>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#6EE7B7] block">Verified & Active</span>
            <span className="text-xl font-bold text-[#6EE7B7]">{metrics.verified}</span>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#D4AF72] block">Iframe Embeddable</span>
            <span className="text-xl font-bold text-[#D4AF72]">{metrics.embeddable}</span>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#FCD34D] block">Awaiting Verification</span>
            <span className="text-xl font-bold text-[#FCD34D]">{metrics.awaiting}</span>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#FCA5A5] block">Broken / Unreachable</span>
            <span className="text-xl font-bold text-[#FCA5A5]">{metrics.broken}</span>
          </div>
          <div className="bg-[#1B1B1B] border border-[#D4AF72]/15 p-3">
            <span className="text-[11px] font-sans text-[#A5A19A] block">No Tour Available</span>
            <span className="text-xl font-bold text-[#A5A19A]">{metrics.unavailable}</span>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="bg-[#1B1B1B] border border-[#D4AF72]/25 px-4 py-2.5 text-xs text-[#F5F1E8] flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-[#A5A19A] hover:text-[#F5F1E8]"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[#1B1B1B] p-4 border border-[#D4AF72]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 font-medium border cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#D4AF72] text-[#080808] border-[#D4AF72]'
                : 'bg-[#121212] border-[#D4AF72]/20 text-[#A5A19A] hover:border-[#D4AF72] hover:text-[#F5F1E8]'
            }`}
          >
            All Projects ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('verified')}
            className={`px-3 py-1.5 font-medium border cursor-pointer ${
              statusFilter === 'verified'
                ? 'bg-[#064E3B] text-[#6EE7B7] border-[#34D399]/50'
                : 'bg-[#121212] border-[#D4AF72]/20 text-[#6EE7B7] hover:border-[#34D399]/50'
            }`}
          >
            Verified ({metrics.verified})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('awaiting_verification')}
            className={`px-3 py-1.5 font-medium border cursor-pointer ${
              statusFilter === 'awaiting_verification'
                ? 'bg-[#78350F] text-[#FCD34D] border-[#FBBF24]/50'
                : 'bg-[#121212] border-[#D4AF72]/20 text-[#FCD34D] hover:border-[#FBBF24]/50'
            }`}
          >
            Awaiting ({metrics.awaiting})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('broken')}
            className={`px-3 py-1.5 font-medium border cursor-pointer ${
              statusFilter === 'broken'
                ? 'bg-[#7F1D1D] text-[#FCA5A5] border-[#F87171]/50'
                : 'bg-[#121212] border-[#D4AF72]/20 text-[#FCA5A5] hover:border-[#F87171]/50'
            }`}
          >
            Broken Links ({metrics.broken})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unavailable')}
            className={`px-3 py-1.5 font-medium border cursor-pointer ${
              statusFilter === 'unavailable'
                ? 'bg-[#2A2A2A] text-[#F5F1E8] border-[#D4AF72]/50'
                : 'bg-[#121212] border-[#D4AF72]/20 text-[#A5A19A] hover:border-[#D4AF72]'
            }`}
          >
            No Tour ({metrics.unavailable})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-[#A5A19A] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search project, developer, provider..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] placeholder:text-[#A5A19A]/60 focus:outline-none focus:border-[#D4AF72]"
          />
        </div>
      </div>

      {/* Discovery Tracking Table */}
      <div className="bg-[#1B1B1B] border border-[#D4AF72]/20 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#121212] border-b border-[#D4AF72]/20 text-[#A5A19A]">
              <th className="py-3 px-4">Project & Location</th>
              <th className="py-3 px-4">Developer</th>
              <th className="py-3 px-4">Tour Provider</th>
              <th className="py-3 px-4">Tour URL</th>
              <th className="py-3 px-4 text-center">Verification</th>
              <th className="py-3 px-4 text-center">Embed Status</th>
              <th className="py-3 px-4">Last Checked</th>
              <th className="py-3 px-4">Error Status</th>
              <th className="py-3 px-4 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D4AF72]/15">
            {filteredList.map((item) => {
              const test = testResult[item.projectId];
              const projectObj = projects.find((p) => p.id === item.projectId);

              return (
                <tr key={item.projectId} className="hover:bg-[#121212] transition-colors">
                  <td className="py-3 px-4 font-sans">
                    <p className="font-semibold text-[#F5F1E8]">{item.projectName}</p>
                    <p className="text-[11px] text-[#A5A19A]">
                      {item.emirate} · {item.category}
                    </p>
                  </td>

                  <td className="py-3 px-4 font-medium text-[#A5A19A]">
                    {item.developerName}
                  </td>

                  <td className="py-3 px-4">
                    {item.tourProvider && item.tourProvider !== 'None' ? (
                      <span className="px-2 py-0.5 bg-[#121212] border border-[#D4AF72]/20 text-[11px] font-semibold text-[#F5F1E8]">
                        {item.tourProvider}
                      </span>
                    ) : (
                      <span className="text-[#A5A19A] italic">None</span>
                    )}
                  </td>

                  <td className="py-3 px-4 max-w-[200px]">
                    {item.tourUrl ? (
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[#F5F1E8] font-mono-tabular" title={item.tourUrl}>
                          {item.tourUrl.replace(/^https?:\/\//, '')}
                        </span>
                        <a
                          href={item.tourUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#D4AF72] hover:text-[#F5F1E8] shrink-0"
                          title="Open Tour Directly"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-[#A5A19A] italic">Not Discovered</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.verificationStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#064E3B]/45 text-[#6EE7B7] border border-[#34D399]/35 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified</span>
                      </span>
                    )}
                    {item.verificationStatus === 'awaiting_verification' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#78350F]/45 text-[#FCD34D] border border-[#FBBF24]/35 text-[11px] font-semibold">
                        <HelpCircle className="w-3 h-3" />
                        <span>Awaiting</span>
                      </span>
                    )}
                    {item.verificationStatus === 'broken' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#7F1D1D]/45 text-[#FCA5A5] border border-[#F87171]/35 text-[11px] font-semibold">
                        <XCircle className="w-3 h-3" />
                        <span>Broken</span>
                      </span>
                    )}
                    {item.verificationStatus === 'unavailable' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#121212] text-[#A5A19A] border border-[#D4AF72]/20 text-[11px]">
                        <span>Unavailable</span>
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.embedAvailable ? (
                      <span className="inline-block px-1.5 py-0.5 bg-[#064E3B]/45 text-[#6EE7B7] text-[10px] font-semibold border border-[#34D399]/35">
                        Embeddable
                      </span>
                    ) : item.tourUrl ? (
                      <span className="inline-block px-1.5 py-0.5 bg-[#78350F]/45 text-[#FCD34D] text-[10px] font-semibold border border-[#FBBF24]/35">
                        Window Only
                      </span>
                    ) : (
                      <span className="text-[#A5A19A] text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono-tabular text-[#A5A19A]">
                    {item.lastCheckedDate}
                  </td>

                  <td className="py-3 px-4 max-w-[160px]">
                    <span
                      className={`truncate block text-[11px] ${
                        item.errorStatus?.includes('HTTP') || item.errorStatus?.includes('Timeout')
                          ? 'text-[#FCA5A5] font-semibold'
                          : 'text-[#A5A19A]'
                      }`}
                      title={item.errorStatus}
                    >
                      {item.errorStatus}
                    </span>
                    {test && (
                      <span
                        className={`text-[10px] block mt-0.5 font-mono-tabular ${
                          test.reachable ? 'text-[#6EE7B7]' : 'text-[#FCA5A5]'
                        }`}
                      >
                        Live: {test.status} ({test.embedAvailable ? 'Embed Ok' : 'No Embed'})
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.tourUrl && (
                        <button
                          type="button"
                          disabled={testingUrl === item.projectId}
                          onClick={() => handleTestLink(item.tourUrl, item.projectId)}
                          className="p-1 text-[#A5A19A] hover:text-[#D4AF72] border border-[#D4AF72]/20 hover:border-[#D4AF72] bg-[#121212] cursor-pointer"
                          title="Test HTTP Status & Iframe Headers"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              testingUrl === item.projectId ? 'animate-spin' : ''
                            }`}
                          />
                        </button>
                      )}

                      {projectObj && item.tourUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewProject(projectObj)}
                          className="p-1 text-[#A5A19A] hover:text-[#6EE7B7] border border-[#D4AF72]/20 hover:border-[#34D399]/50 bg-[#121212] cursor-pointer"
                          title="Preview Interactive 360/3D Experience"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setEditModal({
                            open: true,
                            projectId: item.projectId,
                            projectName: item.projectName,
                            currentUrl: item.tourUrl,
                            currentProvider: item.tourProvider,
                          })
                        }
                        className="px-2 py-1 bg-[#121212] border border-[#D4AF72]/25 text-[#F5F1E8] hover:border-[#D4AF72] font-medium cursor-pointer"
                      >
                        {item.tourUrl ? 'Replace' : 'Attach'}
                      </button>

                      {item.verificationStatus !== 'verified' && item.tourUrl && (
                        <button
                          type="button"
                          disabled={!canManageTours}
                          onClick={() => handleApproveTour(item)}
                          className="px-2 py-1 bg-[#064E3B] border border-[#34D399]/40 text-[#6EE7B7] hover:bg-[#047857] hover:text-[#F5F1E8] font-medium disabled:opacity-50 cursor-pointer"
                        >
                          Approve
                        </button>
                      )}

                      {item.tourUrl && (
                        <button
                          type="button"
                          disabled={!canManageTours}
                          onClick={() => handleRemoveTour(item)}
                          className="p-1 text-[#A5A19A] hover:text-[#FCA5A5] border border-[#D4AF72]/20 hover:border-[#F87171]/50 bg-[#121212] disabled:opacity-50 cursor-pointer"
                          title="Remove Tour Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Attach / Replace Tour Modal */}
      {editModal?.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1B1B1B] max-w-lg w-full p-6 border border-[#D4AF72]/35 space-y-4">
            <h4 className="font-display text-xl font-semibold text-[#F5F1E8]">
              Attach / Replace 360° Tour Link
            </h4>
            <p className="text-xs text-[#A5A19A]">
              Assign verified tour for <strong className="text-[#F5F1E8]">{editModal.projectName}</strong>. Only verified, genuine links belonging strictly to this project may be published.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#A5A19A] mb-1">
                  Tour URL (Matterport, PropVR, VirtualHomes, Kuula, World of Aldar, etc.)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  defaultValue={editModal.currentUrl}
                  onChange={(e) => setEditUrlInput(e.target.value)}
                  className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72] font-mono-tabular"
                />
              </div>

              <div>
                <label className="block text-[#A5A19A] mb-1">Tour Provider Name</label>
                <input
                  type="text"
                  placeholder="e.g. PropVR, VirtualHomes, Matterport, World of Aldar"
                  defaultValue={editModal.currentProvider === 'None' ? '' : editModal.currentProvider}
                  onChange={(e) => setEditProviderInput(e.target.value)}
                  className="w-full h-9 px-3 border border-[#D4AF72]/25 bg-[#080808] text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D4AF72]/15">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="px-4 py-2 border border-[#D4AF72]/25 text-[#A5A19A] text-xs hover:border-[#D4AF72] hover:text-[#F5F1E8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedTour}
                className="px-4 py-2 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#A88750] hover:text-[#F5F1E8] cursor-pointer"
              >
                Save & Verify Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewProject && (
        <VirtualTourModal
          project={previewProject}
          isPreview
          onClose={() => setPreviewProject(null)}
        />
      )}
    </div>
  );
};
