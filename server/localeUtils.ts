/**
 * Locale-aware number and date parsing utilities for document processing.
 * Handles German (comma decimal) vs US (period decimal) number formats.
 */

export interface LocaleConfig {
  region: string;
  currency: string;
  decimalSeparator: ',' | '.';
  thousandsSeparator: '.' | ',' | ' ' | '' | "'";
  dateFormat: 'DD.MM.YYYY' | 'DD/MM/YYYY' | 'DD-MM-YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
}

const LOCALE_CONFIGS: Record<string, LocaleConfig> = {
  DE: { region: 'DE', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD.MM.YYYY' },
  AT: { region: 'AT', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD.MM.YYYY' },
  CH: { region: 'CH', currency: 'CHF', decimalSeparator: '.', thousandsSeparator: "'", dateFormat: 'DD.MM.YYYY' },
  FR: { region: 'FR', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: ' ', dateFormat: 'DD/MM/YYYY' },
  IT: { region: 'IT', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD/MM/YYYY' },
  ES: { region: 'ES', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD/MM/YYYY' },
  NL: { region: 'NL', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD-MM-YYYY' },
  BE: { region: 'BE', currency: 'EUR', decimalSeparator: ',', thousandsSeparator: '.', dateFormat: 'DD/MM/YYYY' },
  PL: { region: 'PL', currency: 'PLN', decimalSeparator: ',', thousandsSeparator: ' ', dateFormat: 'DD.MM.YYYY' },
  UK: { region: 'UK', currency: 'GBP', decimalSeparator: '.', thousandsSeparator: ',', dateFormat: 'DD/MM/YYYY' },
  GB: { region: 'GB', currency: 'GBP', decimalSeparator: '.', thousandsSeparator: ',', dateFormat: 'DD/MM/YYYY' },
  US: { region: 'US', currency: 'USD', decimalSeparator: '.', thousandsSeparator: ',', dateFormat: 'MM/DD/YYYY' },
};

const DEFAULT_LOCALE: LocaleConfig = {
  region: 'US',
  currency: 'USD',
  decimalSeparator: '.',
  thousandsSeparator: ',',
  dateFormat: 'MM/DD/YYYY',
};

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  GERMANY: 'DE', DEUTSCHLAND: 'DE',
  AUSTRIA: 'AT', ÖSTERREICH: 'AT',
  SWITZERLAND: 'CH', SCHWEIZ: 'CH', SUISSE: 'CH',
  FRANCE: 'FR', FRANKREICH: 'FR',
  ITALY: 'IT', ITALIEN: 'IT', ITALIA: 'IT',
  SPAIN: 'ES', SPANIEN: 'ES', ESPAÑA: 'ES',
  NETHERLANDS: 'NL', NIEDERLANDE: 'NL',
  BELGIUM: 'BE', BELGIEN: 'BE', BELGIQUE: 'BE',
  POLAND: 'PL', POLEN: 'PL', POLSKA: 'PL',
  'UNITED KINGDOM': 'GB', 'GREAT BRITAIN': 'GB', ENGLAND: 'GB',
  'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US', USA: 'US', AMERICA: 'US',
  AUSTRALIA: 'AU', AUSTRALIEN: 'AU',
  CANADA: 'CA', KANADA: 'CA',
  'NEW ZEALAND': 'NZ', NEUSEELAND: 'NZ',
  JAPAN: 'JP',
};

function normalizeRegionInput(input: string): string {
  const upper = input.toUpperCase().trim();
  return COUNTRY_NAME_TO_CODE[upper] || upper;
}

export function getLocaleConfig(regionCode: string | undefined | null): LocaleConfig {
  if (!regionCode) return DEFAULT_LOCALE;
  const normalized = normalizeRegionInput(regionCode);
  return LOCALE_CONFIGS[normalized] || DEFAULT_LOCALE;
}

export function getLocaleFromRegionalContext(regionalContext: unknown): LocaleConfig {
  if (!regionalContext || typeof regionalContext !== 'object') {
    return DEFAULT_LOCALE;
  }
  const ctx = regionalContext as { region?: string; country?: string };
  const regionCode = ctx.region || ctx.country;
  return getLocaleConfig(regionCode);
}

export function normalizeNumber(
  input: string,
  locale: LocaleConfig
): number | null {
  if (!input || typeof input !== 'string') return null;
  
  let cleaned = input
    .replace(/[€$£¥₣₹₽₩]/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  if (cleaned.toLowerCase().includes('mio') || cleaned.toLowerCase().includes('million')) {
    cleaned = cleaned.replace(/mio\.?|million/gi, '');
    const baseNumber = parseNumberWithLocale(cleaned, locale);
    return baseNumber !== null ? baseNumber * 1000000 : null;
  }
  
  if (cleaned.toLowerCase().includes('tsd') || cleaned.toLowerCase().includes('k')) {
    cleaned = cleaned.replace(/tsd\.?|k/gi, '');
    const baseNumber = parseNumberWithLocale(cleaned, locale);
    return baseNumber !== null ? baseNumber * 1000 : null;
  }
  
  return parseNumberWithLocale(cleaned, locale);
}

function parseNumberWithLocale(cleaned: string, locale: LocaleConfig): number | null {
  if (!cleaned) return null;
  
  const hasDecimalComma = cleaned.includes(',');
  const hasDecimalPeriod = cleaned.includes('.');
  
  if (locale.decimalSeparator === ',') {
    cleaned = cleaned.replace(/\./g, '');
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function formatNumberForPrompt(locale: LocaleConfig): string {
  const examples = locale.decimalSeparator === ','
    ? {
        thousand: '1.234,56',
        tenThousand: '15.750,00',
        hundred: '123,45',
        integer: '1.000',
      }
    : {
        thousand: '1,234.56',
        tenThousand: '15,750.00',
        hundred: '123.45',
        integer: '1,000',
      };
  
  return `This document uses ${locale.region} number formatting:
- Decimal separator: "${locale.decimalSeparator}" (e.g., ${examples.hundred} = one hundred twenty-three point forty-five)
- Thousands separator: "${locale.thousandsSeparator}" (e.g., ${examples.tenThousand} = fifteen thousand seven hundred fifty)
- Currency: ${locale.currency}

CRITICAL: When extracting amounts, always convert to standard numeric format (period as decimal):
- "${examples.tenThousand}" in document → "15750.00" in normalizedValue
- "${examples.thousand}" in document → "1234.56" in normalizedValue
- "${examples.integer}" in document → "1000" in normalizedValue

Common mistakes to avoid:
- Do NOT treat "${locale.thousandsSeparator}" as decimal separator
- Do NOT multiply values by 100 by misreading the format`;
}

export function formatDateForPrompt(locale: LocaleConfig): string {
  const format = locale.dateFormat;
  const examples: Record<string, string> = {
    'DD.MM.YYYY': '15.03.2024 = March 15, 2024',
    'DD/MM/YYYY': '15/03/2024 = March 15, 2024',
    'DD-MM-YYYY': '15-03-2024 = March 15, 2024',
    'MM/DD/YYYY': '03/15/2024 = March 15, 2024',
    'YYYY-MM-DD': '2024-03-15 = March 15, 2024',
  };
  
  return `Date format used: ${format}
Example: ${examples[format] || examples['YYYY-MM-DD']}
Always normalize dates to ISO format (YYYY-MM-DD) in normalizedValue.`;
}

export function getLocalePromptContext(locale: LocaleConfig): string {
  return `
=== DOCUMENT LOCALE CONTEXT ===
Region: ${locale.region}
Currency: ${locale.currency}

${formatNumberForPrompt(locale)}

${formatDateForPrompt(locale)}
=== END LOCALE CONTEXT ===
`;
}

export function normalizeExtractedAmounts(
  amounts: Array<{ amount: string; currency?: string; context: string }> | undefined,
  locale: LocaleConfig
): Array<{ amount: string; numericAmount: number | null; currency: string; context: string }> {
  if (!amounts) return [];
  
  return amounts.map(amt => {
    const numericAmount = normalizeNumber(amt.amount, locale);
    return {
      amount: amt.amount,
      numericAmount,
      currency: amt.currency || locale.currency,
      context: amt.context,
    };
  });
}

/**
 * Convert cents to euros/dollars (divide by 100).
 * Used when reading financial data stored in cents for display or AI context.
 */
export function centsToUnits(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined) return null;
  return cents / 100;
}

/**
 * Convert euros/dollars to cents (multiply by 100).
 * Used when storing financial data in cents.
 */
export function unitsToCents(units: number | null | undefined): number | null {
  if (units === null || units === undefined) return null;
  return Math.round(units * 100);
}
