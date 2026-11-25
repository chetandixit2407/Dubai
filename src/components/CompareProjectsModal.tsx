import React from 'react';
import { GitCompare, Trash2, X } from 'lucide-react';
import { CurrencyCode, Project } from '../types/realEstate.ts';
import { formatCurrency, formatProjectPrice } from '../utils/currency.ts';

interface CompareProjectsModalProps {
  projects: Project[];
  currency: CurrencyCode;
  onRemove: (projectId: string) => void;
  onOpenProject: (project: Project) => void;
  onRequestAvailabilitySheet?: (project: Project) => void;
  onClose: () => void;
}

export const CompareProjectsModal: React.FC<CompareProjectsModalProps> = ({
  projects,
  currency,
  onRemove,
  onOpenProject,
  onRequestAvailabilitySheet,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-[#121212] text-[#F5F1E8] border border-[#D4AF72]/35 w-full max-w-6xl max-h-[92dvh] flex flex-col">
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#D4AF72]/20 flex items-center justify-between gap-2 bg-[#080808]">
          <div className="flex items-center gap-2 min-w-0">
            <GitCompare className="w-5 h-5 text-[#D4AF72] shrink-0" />
            <h2 className="font-display text-lg sm:text-2xl font-medium text-[#F5F1E8] truncate">
              Side-by-Side Comparison ({projects.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Comparison"
            className="w-9 h-9 border border-[#D4AF72]/25 flex items-center justify-center text-[#F5F1E8] hover:border-[#D4AF72] hover:text-[#D4AF72] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3.5 sm:p-6">
          {projects.length === 0 ? (
            <p className="text-sm text-[#A5A19A] text-center py-12">
              Select up to 4 projects using the Compare button on any project card.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#D4AF72]/25">
                  <th className="py-3 pr-3 sm:pr-4 w-28 sm:w-48 min-w-[112px] sm:min-w-[180px] sticky left-0 bg-[#121212] z-10 text-xs font-semibold uppercase tracking-wider text-[#D4AF72]">
                    Metric
                  </th>
                  {projects.map((p) => (
                    <th key={p.id} className="py-3 px-3 sm:px-4 min-w-[170px] sm:min-w-[210px] align-top">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="font-display text-lg font-medium text-[#F5F1E8] hover:text-[#D4AF72] text-left transition-colors"
                        >
                          {p.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          aria-label={`Remove ${p.name}`}
                          className="text-[#A5A19A] hover:text-[#F87171] p-1 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4AF72]/15 text-xs sm:text-sm">
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Starting Price</td>
                  {projects.map((p) => (
                    <td
                      key={p.id}
                      className="py-3 px-4 font-mono-tabular font-semibold text-[#F5F1E8]"
                    >
                      {formatProjectPrice(p.startingPriceAed, currency)}
                      {p.startingPriceAed > 0 && (
                        <span className="block text-xs font-semibold text-[#D4AF72] font-mono-tabular mt-0.5">
                          ≈ {formatCurrency(p.startingPriceAed, 'INR')}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Booking / Down Payment</td>
                  {projects.map((p) => (
                    <td
                      key={p.id}
                      className="py-3 px-4 font-mono-tabular text-[#6EE7B7] font-semibold"
                    >
                      {p.bookingAmountAed
                        ? formatProjectPrice(p.bookingAmountAed, currency)
                        : `${p.downPaymentPct}%`}
                      {p.bookingAmountAed && (
                        <span className="block text-xs text-[#D4AF72] font-mono-tabular">
                          ≈ {formatCurrency(p.bookingAmountAed, 'INR')} ({p.downPaymentPct}%)
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Price / Sq.Ft</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#F5F1E8]">
                      {formatProjectPrice(p.pricePerSqFtAed, currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Configurations</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-[#F5F1E8]">
                      {p.propertyTypes.join(', ')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Bathrooms</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-medium text-[#F5F1E8]">
                      {p.bathrooms || '1 - 3 Bathrooms'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Developer</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-semibold text-[#F5F1E8]">
                      {p.developerName}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Location</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-[#A5A19A]">
                      {p.community}, {p.emirate}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Verified Available Units</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular">
                      {p.inventory.status === 'verified_live' &&
                      p.inventory.availableUnits !== null ? (
                        <span className="text-[#6EE7B7] font-semibold">
                          {p.inventory.availableUnits} / {p.inventory.totalRegisteredUnits ?? 'Verified'}{' '}
                          {p.inventory.availabilityPct !== null ? `(${p.inventory.availabilityPct}%)` : ''}
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="text-[#D4AF72] block text-xs font-medium font-sans">
                            Contact Developer for Latest Availability
                          </span>
                          {onRequestAvailabilitySheet && (
                            <button
                              type="button"
                              onClick={() => onRequestAvailabilitySheet(p)}
                              className="text-[11px] font-sans font-semibold text-[#F5F1E8] underline hover:text-[#D4AF72]"
                            >
                              Request Availability Sheet
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Unit Sizes (Sq.Ft)</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#F5F1E8]">
                      {p.minSizeSqFt.toLocaleString()} – {p.maxSizeSqFt.toLocaleString()} sq.ft
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Payment Plan</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-[#F5F1E8]">
                      {p.paymentPlan}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Handover Date</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#F5F1E8]">
                      {p.handoverDate}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Construction Progress</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#F5F1E8]">
                      {p.constructionPct}% ({p.status})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Gross / Net Yield (Est.)</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#A5A19A]">
                      <span className="font-semibold text-[#6EE7B7]">
                        {p.investment.grossYieldPct
                          ? `${p.investment.grossYieldPct}% Gross`
                          : 'N/A'}
                      </span>{' '}
                      · {p.investment.netYieldPct ? `${p.investment.netYieldPct}% Net` : ''}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">5-Yr Price Trend</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 font-mono-tabular text-[#6EE7B7]">
                      {p.investment.priceTrend5YrPct ? `+${p.investment.priceTrend5YrPct}%` : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Virtual 3D Tour</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-xs font-semibold">
                      {p.virtualTour.tourStatus === '3d_available' ||
                      p.virtualTour.tourStatus === '360_available' ? (
                        <span className="text-[#D4AF72] font-semibold">
                          3D Model / 360 Available
                        </span>
                      ) : (
                        <span className="text-[#A5A19A]">Unavailable</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Key Amenities</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4 text-xs text-[#A5A19A]">
                      {p.amenities.slice(0, 4).join(' · ')}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-[#A5A19A]">Action</td>
                  {projects.map((p) => (
                    <td key={p.id} className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onOpenProject(p)}
                        className="py-1.5 px-3 bg-[#D4AF72] text-[#080808] text-xs font-semibold hover:bg-[#E6C77A] transition-colors"
                      >
                        Open Property Profile
                      </button>
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
