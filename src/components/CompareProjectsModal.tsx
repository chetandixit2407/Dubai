import React from 'react';
import { GitCompare, Trash2, X } from 'lucide-react';
import { CurrencyCode, Project } from '../types/realEstate.ts';
import { formatProjectPrice } from '../utils/currency.ts';

interface CompareProjectsModalProps {
  projects: Project[];
  currency: CurrencyCode;
  onRemove: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onClose: () => void;
}

export const CompareProjectsModal: React.FC<CompareProjectsModalProps> = ({
  projects,
  currency,
  onRemove,
  onOpenProject,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E2DC] w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-[#9A7B3C]" />
            <h2 className="font-display text-2xl font-semibold text-[#111827]">
              Side-by-Side Project Comparison ({projects.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Comparison"
            className="w-9 h-9 border border-[#E5E2DC] flex items-center justify-center hover:border-[#9A7B3C]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {projects.length === 0 ? (
            <p className="text-sm text-[#4B5563] text-center py-12">
              Select up to 4 projects using the Compare button on any project card.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E2DC]">
                  <th className="py-3 pr-4 w-48 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Metric
                  </th>
                  {projects.map((p) => (
                    <th key={p.id} className="py-3 px-4 min-w-[210px] align-top">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="font-display text-lg font-semibold text-[#111827] hover:text-[#9A7B3C] text-left"
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          aria-label={`Remove ${p.name}`}
                          className="text-[#6B7280] hover:text-[#B91C1C] p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E2DC] text-xs sm:text-sm">
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Starting Price</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular font-semibold text-[#111827]">
                      {formatProjectPrice(p.startingPriceAed, currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Price / Sq.Ft</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">
                      {formatProjectPrice(p.pricePerSqFtAed, currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Developer</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4">{p.developerName}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Location</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4">
                      {p.community}, {p.emirate}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Verified Available Units</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">
                      {p.inventory.status === 'verified_live' && p.inventory.availableUnits !== null ? (
                        <span className="text-[#047857] font-semibold">
                          {p.inventory.availableUnits} / {p.inventory.totalRegisteredUnits} ({p.inventory.availabilityPct}%)
                        </span>
                      ) : (
                        <span className="text-[#6B7280]">Unavailable — Contact Desk</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Unit Sizes (Sq.Ft)</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">
                      {p.minSizeSqFt.toLocaleString()} – {p.maxSizeSqFt.toLocaleString()} sq.ft
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Payment Plan</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4">{p.paymentPlan}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Handover Date</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">{p.handoverDate}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Construction Progress</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">{p.constructionPct}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Gross / Net Yield (Est.)</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">
                      {p.investment.grossYieldPct ? `${p.investment.grossYieldPct}% Gross` : 'N/A'} ·{' '}
                      {p.investment.netYieldPct ? `${p.investment.netYieldPct}% Net` : ''}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">5-Yr Price Trend</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#047857]">
                      {p.investment.priceTrend5YrPct ? `+${p.investment.priceTrend5YrPct}%` : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#4B5563]">Key Amenities</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-xs text-[#4B5563]">
                      {p.amenities.slice(0, 4).join(' · ')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
