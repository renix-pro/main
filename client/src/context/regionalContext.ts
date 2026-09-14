/**
 * RENIX vNext — Project Regional Context
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Every project has explicit regional and financial context.
 * This context governs interpretation of all currency, numbers,
 * dates, and measurement units across the entire project.
 * 
 * Core rules:
 * - Regional context is project-specific
 * - Context is explicit and persistent
 * - Context is readable by all frames
 * - No frame may define or override regional context
 * - No silent changes
 * - No AI inference without confirmation
 */

export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type NumberFormat = 'comma-period' | 'period-comma' | 'space-comma';
export type MeasurementSystem = 'metric' | 'imperial';

export interface RegionalContext {
  country: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  dateFormat: DateFormat;
  numberFormat: NumberFormat;
  measurementSystem: MeasurementSystem;
  locale: string;
  confirmed: boolean;
}

export const SUPPORTED_REGIONS: Record<string, Omit<RegionalContext, 'confirmed'>> = {
  AU: {
    country: 'AU',
    countryName: 'Australia',
    currency: 'AUD',
    currencySymbol: '$',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'comma-period',
    measurementSystem: 'metric',
    locale: 'en-AU',
  },
  US: {
    country: 'US',
    countryName: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    dateFormat: 'MM/DD/YYYY',
    numberFormat: 'comma-period',
    measurementSystem: 'imperial',
    locale: 'en-US',
  },
  GB: {
    country: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'comma-period',
    measurementSystem: 'metric',
    locale: 'en-GB',
  },
  CA: {
    country: 'CA',
    countryName: 'Canada',
    currency: 'CAD',
    currencySymbol: '$',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'comma-period',
    measurementSystem: 'metric',
    locale: 'en-CA',
  },
  NZ: {
    country: 'NZ',
    countryName: 'New Zealand',
    currency: 'NZD',
    currencySymbol: '$',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'comma-period',
    measurementSystem: 'metric',
    locale: 'en-NZ',
  },
  DE: {
    country: 'DE',
    countryName: 'Germany',
    currency: 'EUR',
    currencySymbol: '€',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'period-comma',
    measurementSystem: 'metric',
    locale: 'de-DE',
  },
  FR: {
    country: 'FR',
    countryName: 'France',
    currency: 'EUR',
    currencySymbol: '€',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'space-comma',
    measurementSystem: 'metric',
    locale: 'fr-FR',
  },
  JP: {
    country: 'JP',
    countryName: 'Japan',
    currency: 'JPY',
    currencySymbol: '¥',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'comma-period',
    measurementSystem: 'metric',
    locale: 'ja-JP',
  },
};

export const DEFAULT_REGIONAL_CONTEXT: RegionalContext = {
  ...SUPPORTED_REGIONS.AU,
  confirmed: false,
};

export function detectRegion(): string {
  try {
    const browserLocale = navigator.language || 'en-AU';
    const countryCode = browserLocale.split('-')[1]?.toUpperCase();
    if (countryCode && SUPPORTED_REGIONS[countryCode]) {
      return countryCode;
    }
  } catch {
    // Ignore detection errors
  }
  return 'AU';
}

export function getRegionalContext(countryCode: string, confirmed: boolean = false): RegionalContext {
  const region = SUPPORTED_REGIONS[countryCode] ?? SUPPORTED_REGIONS.AU;
  return { ...region, confirmed };
}

export function formatCurrency(amount: number | null, context: RegionalContext): string {
  if (amount === null) return '—';
  const showDecimals = Math.abs(amount) < 1000;
  return new Intl.NumberFormat(context.locale, {
    style: 'currency',
    currency: context.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);
}

export function formatNumber(value: number, context: RegionalContext, decimals: number = 2): string {
  return new Intl.NumberFormat(context.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | number | string, context: RegionalContext): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(context.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(date: Date | number | string, context: RegionalContext): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(context.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatMeasurement(value: number, unit: 'length' | 'area' | 'volume', context: RegionalContext): string {
  if (context.measurementSystem === 'metric') {
    switch (unit) {
      case 'length': return `${formatNumber(value, context)} m`;
      case 'area': return `${formatNumber(value, context)} m²`;
      case 'volume': return `${formatNumber(value, context)} m³`;
    }
  } else {
    switch (unit) {
      case 'length': return `${formatNumber(value * 3.28084, context)} ft`;
      case 'area': return `${formatNumber(value * 10.7639, context)} ft²`;
      case 'volume': return `${formatNumber(value * 35.3147, context)} ft³`;
    }
  }
}

export function getRegionOptions(): { value: string; label: string }[] {
  return Object.entries(SUPPORTED_REGIONS).map(([code, region]) => ({
    value: code,
    label: `${region.countryName} (${region.currency})`,
  }));
}
