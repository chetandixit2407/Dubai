import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calculator, Info } from 'lucide-react';
import { CurrencyCode } from '../types/realEstate.ts';
import { formatCurrency } from '../utils/currency.ts';
import {
  analyzeInvestmentOnServer,
  InvestmentAnalysisResponse,
} from '../services/apiClient.ts';

interface InvestmentCalculatorProps {
  currency: CurrencyCode;
  initialPriceAed?: number;
  initialServiceChargePerSqFt?: number;
  initialSizeSqFt?: number;
  initialGrossYieldPct?: number;
  projectName?: string;
}

export const InvestmentCalculator: React.FC<InvestmentCalculatorProps> = ({
  currency,
  initialPriceAed = 2500000,
  initialServiceChargePerSqFt = 18,
  initialSizeSqFt = 1050,
  initialGrossYieldPct = 7.0,
  projectName,
}) => {
  const [propertyPriceAed, setPropertyPriceAed] = useState(initialPriceAed);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [installmentYears, setInstallmentYears] = useState(5);
  const [estimatedAnnualRentAed, setEstimatedAnnualRentAed] = useState(
    Math.round(initialPriceAed * (initialGrossYieldPct / 100))
  );
  const [annualServiceChargeAed, setAnnualServiceChargeAed] = useState(
    Math.round(initialServiceChargePerSqFt * initialSizeSqFt)
  );
  const [dldFeePct, setDldFeePct] = useState(4);
  const [agencyFeePct, setAgencyFeePct] = useState(2);
  const [annualAppreciationPct, setAnnualAppreciationPct] = useState(6.5);
  const [useMortgage, setUseMortgage] = useState(false);
  const [financingRatePct, setFinancingRatePct] = useState(4.25);

  const [analysis, setAnalysis] = useState<InvestmentAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPropertyPriceAed(initialPriceAed);
    setEstimatedAnnualRentAed(Math.round(initialPriceAed * (initialGrossYieldPct / 100)));
    setAnnualServiceChargeAed(Math.round(initialServiceChargePerSqFt * initialSizeSqFt));
  }, [initialPriceAed, initialServiceChargePerSqFt, initialSizeSqFt, initialGrossYieldPct]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await analyzeInvestmentOnServer({
          propertyPriceAed,
          downPaymentPct,
          installmentYears,
          estimatedAnnualRentAed,
          annualServiceChargeAed,
          dldFeePct,
          agencyFeePct,
          annualAppreciationPct,
          financingRatePct,
          useMortgage,
        });
        if (active) setAnalysis(res);
      } catch {
        // Fallback client calculation if network interrupted
      } finally {
        if (active) setLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    propertyPriceAed,
    downPaymentPct,
    installmentYears,
    estimatedAnnualRentAed,
    annualServiceChargeAed,
    dldFeePct,
    agencyFeePct,
    annualAppreciationPct,
    financingRatePct,
    useMortgage,
  ]);

  const out = analysis?.outputs;

  return (
    <div className="bg-white border border-[#E5E2DC] p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#E5E2DC]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9A7B3C] flex items-center gap-1.5">
            <Calculator className="w-4 h-4" />
            <span>UAE Yield & Acquisition Modeling</span>
          </p>
          <h3 className="font-display text-2xl lg:text-3xl font-semibold text-[#111827] mt-1">
            {projectName ? `Investment Calculator — ${projectName}` : 'UAE Property Investment Calculator'}
          </h3>
        </div>

        <div className="flex items-center gap-2 bg-[#FAF9F6] border border-[#E5E2DC] p-1">
          <button
            type="button"
            onClick={() => setUseMortgage(false)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              !useMortgage ? 'bg-[#111827] text-white' : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            Developer Payment Plan
          </button>
          <button
            type="button"
            onClick={() => setUseMortgage(true)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              useMortgage ? 'bg-[#111827] text-white' : 'text-[#4B5563] hover:text-[#111827]'
            }`}
          >
            UAE Bank Mortgage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        {/* Inputs */}
        <div className="lg:col-span-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#4B5563] mb-1">
              Property Price (AED)
            </label>
            <input
              type="number"
              min={200000}
              step={50000}
              value={propertyPriceAed}
              onChange={(e) => setPropertyPriceAed(Number(e.target.value) || 0)}
              className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Down Payment (%)
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Installment Duration (Years)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={installmentYears}
                onChange={(e) => setInstallmentYears(Number(e.target.value) || 1)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Est. Annual Rent (AED)
              </label>
              <input
                type="number"
                min={0}
                step={5000}
                value={estimatedAnnualRentAed}
                onChange={(e) => setEstimatedAnnualRentAed(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Annual Service Charges (AED)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={annualServiceChargeAed}
                onChange={(e) => setAnnualServiceChargeAed(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                DLD / Reg (%)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={dldFeePct}
                onChange={(e) => setDldFeePct(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Agency Fee (%)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={agencyFeePct}
                onChange={(e) => setAgencyFeePct(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Appreciation (%/yr)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={annualAppreciationPct}
                onChange={(e) => setAnnualAppreciationPct(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
          </div>

          {useMortgage && (
            <div>
              <label className="block text-xs font-medium text-[#4B5563] mb-1">
                Annual Mortgage Interest Rate (%)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                step={0.25}
                value={financingRatePct}
                onChange={(e) => setFinancingRatePct(Number(e.target.value) || 4.25)}
                className="w-full h-10 px-3 border border-[#E5E2DC] font-mono-tabular text-sm text-[#111827] focus:outline-none focus:border-[#9A7B3C]"
              />
            </div>
          )}
        </div>

        {/* Outputs & Chart */}
        <div className="lg:col-span-7 space-y-6">
          {out ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">Down Payment</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#111827] mt-1">
                    {formatCurrency(out.downPaymentAed, currency)}
                  </p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">Monthly Installment</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#111827] mt-1">
                    {formatCurrency(out.monthlyInstallmentAed, currency)}
                  </p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">Total Purchase Cost</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#111827] mt-1">
                    {formatCurrency(out.totalAcquisitionCostAed, currency)}
                  </p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">Gross Rental Yield</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#047857] mt-1">
                    {out.grossYieldPct.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">Est. Net Rental Yield</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#9A7B3C] mt-1">
                    {out.netYieldPct.toFixed(2)}%
                  </p>
                </div>
                <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4">
                  <p className="text-xs text-[#6B7280]">5-Year Est. Total ROI</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#111827] mt-1">
                    {out.estimated5YrTotalRoiPct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* 5-Year Chart */}
              <div className="border border-[#E5E2DC] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    5-Year Modeled Asset Value & Cumulative Net Rent (AED)
                  </p>
                  {loading && <span className="text-xs text-[#6B7280]">Recalculating...</span>}
                </div>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.fiveYearProjection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E2DC" />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#4B5563' }} />
                      <YAxis
                        tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                        tick={{ fontSize: 11, fill: '#4B5563' }}
                      />
                      <Tooltip
                        formatter={(value: unknown) => [
                          `AED ${Number(value).toLocaleString()}`,
                          '',
                        ]}
                      />
                      <Bar dataKey="propertyValueAed" name="Projected Value" fill="#111827" />
                      <Bar dataKey="cumulativeNetRentAed" name="Cumulative Net Rent" fill="#9A7B3C" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Explicit Assumptions Disclosure */}
              <div className="bg-[#FAF9F6] border border-[#E5E2DC] p-4 text-xs text-[#4B5563] space-y-1">
                <p className="font-semibold text-[#111827] flex items-center gap-1.5 mb-1">
                  <Info className="w-3.5 h-3.5 text-[#9A7B3C]" />
                  <span>Estimated Projections & Modeling Assumptions</span>
                </p>
                <p className="font-mono-tabular">
                  Breakdown: DLD/Reg {formatCurrency(out.dldFeeAed, currency)} · Agency{' '}
                  {formatCurrency(out.agencyFeeAed, currency)} · Trustee{' '}
                  {formatCurrency(out.trusteeAndAdminAed, currency)} · Net Annual Rent{' '}
                  {formatCurrency(out.netAnnualRentalIncomeAed, currency)}
                </p>
                {analysis.assumptions.map((note, idx) => (
                  <p key={idx}>· {note}</p>
                ))}
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center border border-[#E5E2DC] text-sm text-[#6B7280]">
              Loading investment analysis...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
