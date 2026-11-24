import { CurrencyCode } from '../types/realEstate.ts';

export const CURRENCY_RATES_FROM_AED: Record<CurrencyCode, number> = {
  AED: 1,
  USD: 0.27229,
  INR: 23.05,
  GBP: 0.2145,
  EUR: 0.252,
  SAR: 1.0211,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  AED: 'AED',
  USD: '$',
  INR: '₹',
  GBP: '£',
  EUR: '€',
  SAR: 'SAR',
};

export function convertFromAed(amountAed: number, currency: CurrencyCode): number {
  return amountAed * CURRENCY_RATES_FROM_AED[currency];
}

export function formatCurrency(
  amountAed: number | null | undefined,
  currency: CurrencyCode,
  compact = false
): string {
  if (amountAed === null || amountAed === undefined || Number.isNaN(amountAed)) {
    return 'Price on Request';
  }

  const converted = convertFromAed(amountAed, currency);

  if (currency === 'INR') {
    if (compact || converted >= 10_000_000) {
      const crores = converted / 10_000_000;
      return `₹${crores.toFixed(2)} Cr`;
    }
    const lakhs = converted / 100_000;
    return `₹${lakhs.toFixed(1)} L`;
  }

  if (compact) {
    if (converted >= 1_000_000) {
      return `${CURRENCY_SYMBOLS[currency]} ${(converted / 1_000_000).toFixed(2)}M`;
    }
    if (converted >= 1_000) {
      return `${CURRENCY_SYMBOLS[currency]} ${Math.round(converted / 1_000)}K`;
    }
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(converted));

  return currency === 'AED' || currency === 'SAR'
    ? `${currency} ${formatted}`
    : `${CURRENCY_SYMBOLS[currency]}${formatted}`;
}

export function formatProjectPrice(
  amountAed: number | null | undefined,
  currency: CurrencyCode,
  compact = false
): string {
  if (
    amountAed === null ||
    amountAed === undefined ||
    Number.isNaN(amountAed) ||
    amountAed <= 0
  ) {
    return compact ? 'POA' : 'Price on Request';
  }
  return formatCurrency(amountAed, currency, compact);
}
