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
import { formatCurrency, formatInrTimestampNote } from '../utils/currency.ts';
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

function computeLocalInvestmentAnalysis(params: {
  propertyPriceAed: number;
  downPaymentPct: number;
  installmentYears: number;
  estimatedAnnualRentAed: number;
  annualServiceChargeAed: number;
  dldFeePct: number;
  agencyFeePct: number;
  annualAppreciationPct: number;
  financingRatePct: number;
  useMortgage: boolean;
}): InvestmentAnalysisResponse {
  const price = Math.max(100000, Number(params.propertyPriceAed) || 2500000);
  const downPct = Math.min(100, Math.max(5, Number(params.downPaymentPct) || 20));
  const years = Math.min(30, Math.max(1, Number(params.installmentYears) || 5));
  const annualRent = Math.max(0, Number(params.estimatedAnnualRentAed) || 0);
  const serviceCharge = Math.max(0, Number(params.annualServiceChargeAed) || 0);
  const dldFee = price * ((Number(params.dldFeePct) || 4) / 100);
  const agencyFee = price * ((Number(params.agencyFeePct) || 2) / 100);
  const trusteeAndAdminAed = 5400;

  const downPaymentAed = price * (downPct / 100);
  const financedPrincipalAed = Math.max(0, price - downPaymentAed);
  const totalAcquisitionCostAed = price + dldFee + agencyFee + trusteeAndAdminAed;

  let monthlyInstallmentAed = 0;
  if (financedPrincipalAed > 0) {
    if (params.useMortgage && Number(params.financingRatePct) > 0) {
      const monthlyRate = Number(params.financingRatePct) / 100 / 12;
      const n = years * 12;
      monthlyInstallmentAed =
        (financedPrincipalAed * monthlyRate * Math.pow(1 + monthlyRate, n)) /
        (Math.pow(1 + monthlyRate, n) - 1);
    } else {
      monthlyInstallmentAed = financedPrincipalAed / (years * 12);
    }
  }

  const netAnnualIncomeAed = annualRent - serviceCharge;
  const grossYieldPct = (annualRent / price) * 100;
  const netYieldPct = (netAnnualIncomeAed / totalAcquisitionCostAed) * 100;

  const cashInvestedYear1 = downPaymentAed + dldFee + agencyFee + trusteeAndAdminAed;
  const fiveYearProjection = Array.from({ length: 5 }, (_, idx) => {
    const year = idx + 1;
    const propertyValue =
      price * Math.pow(1 + (Number(params.annualAppreciationPct) || 0) / 100, year);
    const cumulativeNetRent = netAnnualIncomeAed * year;
    const totalEquityGain = propertyValue - price + cumulativeNetRent;
    const roiPct = cashInvestedYear1 > 0 ? (totalEquityGain / cashInvestedYear1) * 100 : 0;
    return {
      year: `Year ${year}`,
      propertyValueAed: Math.round(propertyValue),
      cumulativeNetRentAed: Math.round(cumulativeNetRent),
      estimatedRoiPct: Number(roiPct.toFixed(1)),
    };
  });

  return {
    outputs: {
      downPaymentAed: Math.round(downPaymentAed),
      financedPrincipalAed: Math.round(financedPrincipalAed),
      monthlyInstallmentAed: Math.round(monthlyInstallmentAed),
      dldFeeAed: Math.round(dldFee),
      agencyFeeAed: Math.round(agencyFee),
      trusteeAndAdminAed,
      totalAcquisitionCostAed: Math.round(totalAcquisitionCostAed),
      estimatedAnnualRentalIncomeAed: Math.round(annualRent),
      netAnnualRentalIncomeAed: Math.round(netAnnualIncomeAed),
      grossYieldPct: Number(grossYieldPct.toFixed(2)),
      netYieldPct: Number(netYieldPct.toFixed(2)),
      estimated5YrTotalRoiPct: fiveYearProjection[4].estimatedRoiPct,
    },
    fiveYearProjection,
    assumptions: [
      'Dubai Land Department (DLD) transfer / Oqood fee modeled at 4% unless developer waiver applies.',
      'Brokerage & registration trustee fee modeled separately as an estimate.',
      'Rental yields assume 95%+ annual occupancy and do not include personal income tax (0% in UAE).',
    ],
  };
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

  const [analysis, setAnalysis] = useState<InvestmentAnalysisResponse | null>(() =>
    computeLocalInvestmentAnalysis({
      propertyPriceAed: initialPriceAed,
      downPaymentPct: 20,
      installmentYears: 5,
      estimatedAnnualRentAed: Math.round(initialPriceAed * (initialGrossYieldPct / 100)),
      annualServiceChargeAed: Math.round(initialServiceChargePerSqFt * initialSizeSqFt),
      dldFeePct: 4,
      agencyFeePct: 2,
      annualAppreciationPct: 6.5,
      financingRatePct: 4.25,
      useMortgage: false,
    })
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPropertyPriceAed(initialPriceAed);
    setEstimatedAnnualRentAed(Math.round(initialPriceAed * (initialGrossYieldPct / 100)));
    setAnnualServiceChargeAed(Math.round(initialServiceChargePerSqFt * initialSizeSqFt));
  }, [initialPriceAed, initialServiceChargePerSqFt, initialSizeSqFt, initialGrossYieldPct]);

  useEffect(() => {
    let active = true;
    const fallbackParams = {
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
    };
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await analyzeInvestmentOnServer(fallbackParams);
        if (active) setAnalysis(res);
      } catch {
        if (active) setAnalysis(computeLocalInvestmentAnalysis(fallbackParams));
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
    <div className="bg-[#121212] border border-[#D4AF72]/25 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#D4AF72]/20">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#D4AF72] flex items-center gap-1.5">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>UAE Yield &amp; Acquisition Modeling</span>
          </p>
          <h3 className="font-display text-xl sm:text-2xl lg:text-3xl font-medium text-[#F5F1E8] mt-1 break-words">
            {projectName
              ? `Investment Calculator — ${projectName}`
              : 'UAE Property Investment Calculator'}
          </h3>
        </div>

        <div className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex items-center gap-1.5 bg-[#080808] border border-[#D4AF72]/25 p-1">
          <button
            type="button"
            onClick={() => setUseMortgage(false)}
            className={`px-2.5 sm:px-3 py-2 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors text-center ${
              !useMortgage
                ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                : 'text-[#A5A19A] hover:text-[#F5F1E8]'
            }`}
          >
            Developer Payment Plan
          </button>
          <button
            type="button"
            onClick={() => setUseMortgage(true)}
            className={`px-2.5 sm:px-3 py-2 sm:py-1.5 text-[11px] sm:text-xs font-medium transition-colors text-center ${
              useMortgage
                ? 'bg-[#D4AF72] text-[#080808] font-semibold'
                : 'text-[#A5A19A] hover:text-[#F5F1E8]'
            }`}
          >
            UAE Bank Mortgage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 pt-6">
        {/* Inputs */}
        <div className="lg:col-span-5 min-w-0 space-y-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#D4AF72] font-semibold">
            Verified Acquisition &amp; Registry Inputs
          </p>
          <div>
            <label className="block text-xs font-medium text-[#A5A19A] mb-1">
              Property Price (AED)
            </label>
            <input
              type="number"
              min={200000}
              step={50000}
              value={propertyPriceAed}
              onChange={(e) => setPropertyPriceAed(Number(e.target.value) || 0)}
              className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Down Payment (%)
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={downPaymentPct}
                onChange={(e) => setDownPaymentPct(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Installment Duration (Years)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={installmentYears}
                onChange={(e) => setInstallmentYears(Number(e.target.value) || 1)}
                className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Est. Annual Rent (AED)
              </label>
              <input
                type="number"
                min={0}
                step={5000}
                value={estimatedAnnualRentAed}
                onChange={(e) => setEstimatedAnnualRentAed(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Annual Service Charges (AED)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={annualServiceChargeAed}
                onChange={(e) => setAnnualServiceChargeAed(Number(e.target.value) || 0)}
                className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                DLD / Reg (%)
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={dldFeePct}
                onChange={(e) => setDldFeePct(Number(e.target.value) || 0)}
                className="w-full min-w-0 h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Agency Fee (%)
              </label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={agencyFeePct}
                onChange={(e) => setAgencyFeePct(Number(e.target.value) || 0)}
                className="w-full min-w-0 h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Appreciation (%/yr)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={annualAppreciationPct}
                onChange={(e) => setAnnualAppreciationPct(Number(e.target.value) || 0)}
                className="w-full min-w-0 h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          </div>

          {useMortgage && (
            <div>
              <label className="block text-xs font-medium text-[#A5A19A] mb-1">
                Annual Mortgage Interest Rate (%)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                step={0.25}
                value={financingRatePct}
                onChange={(e) => setFinancingRatePct(Number(e.target.value) || 4.25)}
                className="w-full h-10 px-3 bg-[#1B1B1B] border border-[#D4AF72]/25 font-mono-tabular text-sm text-[#F5F1E8] focus:outline-none focus:border-[#D4AF72]"
              />
            </div>
          )}
        </div>

        {/* Outputs & Chart */}
        <div className="lg:col-span-7 min-w-0 space-y-6">
          {out ? (
            <>
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">Down Payment</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#F5F1E8] mt-1 break-words">
                    {formatCurrency(out.downPaymentAed, currency)}
                  </p>
                </div>
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">Monthly Installment</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#F5F1E8] mt-1 break-words">
                    {formatCurrency(out.monthlyInstallmentAed, currency)}
                  </p>
                </div>
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">Total Purchase Cost</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#F5F1E8] mt-1 break-words">
                    {formatCurrency(out.totalAcquisitionCostAed, currency)}
                  </p>
                </div>
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">Est. Gross Rental Yield</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#6EE7B7] mt-1">
                    {out.grossYieldPct.toFixed(2)}%
                  </p>
                </div>
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">Est. Net Rental Yield</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#D4AF72] mt-1">
                    {out.netYieldPct.toFixed(2)}%
                  </p>
                </div>
                <div className="min-w-0 bg-[#1B1B1B] border border-[#D4AF72]/20 p-3.5 sm:p-4">
                  <p className="text-xs text-[#A5A19A]">5-Year Est. Total ROI</p>
                  <p className="font-mono-tabular text-[clamp(1rem,2.4vw,1.125rem)] font-semibold text-[#F5F1E8] mt-1">
                    {out.estimated5YrTotalRoiPct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* 5-Year Chart */}
              <div className="border border-[#D4AF72]/20 bg-[#1B1B1B] p-3.5 sm:p-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold text-[#F5F1E8] uppercase tracking-wider">
                    5-Year Modeled Asset Value &amp; Cumulative Net Rent (AED)
                  </p>
                  {loading && <span className="text-xs text-[#D4AF72]">Recalculating...</span>}
                </div>
                <div className="h-52 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.fiveYearProjection}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 175, 114, 0.14)" />
                      <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#A5A19A' }} />
                      <YAxis
                        width={46}
                        tickFormatter={(v) => `${(Number(v) / 1_000_000).toFixed(1)}M`}
                        tick={{ fontSize: 11, fill: '#A5A19A' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#121212',
                          borderColor: 'rgba(212, 175, 114, 0.45)',
                          color: '#F5F1E8',
                          fontSize: '12px',
                        }}
                        formatter={(value: unknown) => [
                          `AED ${Number(value).toLocaleString()}`,
                          '',
                        ]}
                      />
                      <Bar dataKey="propertyValueAed" name="Projected Value" fill="#F5F1E8" />
                      <Bar
                        dataKey="cumulativeNetRentAed"
                        name="Cumulative Net Rent"
                        fill="#D4AF72"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Explicit Assumptions Disclosure */}
              <div className="bg-[#080808] border border-[#D4AF72]/20 p-3.5 sm:p-4 text-xs text-[#A5A19A] space-y-1 break-words">
                <p className="font-semibold text-[#F5F1E8] flex items-center gap-1.5 mb-1">
                  <Info className="w-3.5 h-3.5 text-[#D4AF72] shrink-0" />
                  <span>
                    Estimated ROI Projections &amp; Modeling Assumptions ({formatInrTimestampNote()})
                  </span>
                </p>
                <p className="font-mono-tabular text-[#D4AF72] break-words">
                  Fee Breakdown: DLD/Reg {formatCurrency(out.dldFeeAed, currency)} · Agency{' '}
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
            <div className="h-64 flex items-center justify-center border border-[#D4AF72]/20 bg-[#1B1B1B] text-sm text-[#A5A19A]">
              Loading investment analysis...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
