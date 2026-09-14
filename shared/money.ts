/**
 * RENIX vNext — MoneyValue Domain Type
 * 
 * Phase 2: Semantic Isolation & Canonical Read/Write Normalization
 * 
 * ==========================================================================
 * CURRENCY BOUNDARY SPECIFICATION
 * ==========================================================================
 * 
 * This module introduces a canonical representation for monetary values
 * at the DOMAIN level. All NEW financial reasoning should consume MoneyValue.
 * 
 * EXISTING logic using double-based or mixed formats remains UNCHANGED.
 * This boundary is ADDITIVE — no existing code is modified.
 * 
 * ==========================================================================
 * STORAGE CONVENTIONS — CANONICAL (Phase 12.1 Verified)
 * ==========================================================================
 * 
 * ALL monetary values are stored in CENTS (minor units).
 * Divide by 100 at the API boundary before sending to frontend.
 * The frontend formatCurrency() expects WHOLE CURRENCY UNITS.
 * 
 * CENTS (minor units - divide by 100 for display):
 * 1. quotes.total: INTEGER (cents, e.g., 4011728 = €40,117.28)
 * 2. quote_line_items.totalPrice, unitPrice: INTEGER (cents)
 * 3. quote_financials.grossAmount, netAmount, taxAmount: INTEGER (cents)
 * 4. invoice_lines.amount: INTEGER (cents)
 * 
 * WHOLE CURRENCY UNITS (used directly, no conversion):
 * 5. budget_allocations.amount: INTEGER (whole currency units, e.g., 1234 = €1,234)
 * 6. financing_sources.amount: INTEGER (whole currency units, e.g., 10000 = €10,000)
 * 7. budget_data.totalBudget: INTEGER (whole currency units)
 * 
 * CONVERSION RULES:
 * - Server API endpoints MUST convert cents → units before responding
 * - Frontend NEVER divides by 100 — it receives ready-to-display values
 * - Write paths MUST convert units → cents before storing
 * - normalizeTotal() is the canonical read conversion for quotes
 * 
 * This module provides a type-safe boundary for reasoning about money.
 * 
 * ==========================================================================
 */

/**
 * Canonical monetary value representation.
 * 
 * All monetary values are stored as integer minor units (cents/pence/etc.)
 * with an explicit currency code.
 * 
 * @example
 * // €1,234.56 represented as:
 * const price: MoneyValue = { minorUnits: 123456, currency: 'EUR' };
 * 
 * @example
 * // $99.99 represented as:
 * const price: MoneyValue = { minorUnits: 9999, currency: 'USD' };
 */
export interface MoneyValue {
  /** Amount in minor units (cents). Always an integer. */
  minorUnits: number;
  /** ISO 4217 currency code (e.g., 'EUR', 'USD', 'GBP') */
  currency: string;
}

/**
 * Create a MoneyValue from minor units (cents).
 * 
 * @param minorUnits - Amount in cents (must be integer)
 * @param currency - ISO 4217 currency code
 * @returns MoneyValue instance
 * 
 * @example
 * const total = fromMinorUnits(123456, 'EUR'); // €1,234.56
 */
export function fromMinorUnits(minorUnits: number, currency: string): MoneyValue {
  return {
    minorUnits: Math.round(minorUnits), // Ensure integer
    currency: currency.toUpperCase(),
  };
}

/**
 * Create a MoneyValue from major units (euros/dollars).
 * 
 * @param majorUnits - Amount in currency units (e.g., 1234.56 for €1,234.56)
 * @param currency - ISO 4217 currency code
 * @returns MoneyValue instance
 * 
 * @example
 * const total = fromMajorUnits(1234.56, 'EUR'); // €1,234.56
 */
export function fromMajorUnits(majorUnits: number, currency: string): MoneyValue {
  return {
    minorUnits: Math.round(majorUnits * 100),
    currency: currency.toUpperCase(),
  };
}

/**
 * Convert MoneyValue to major units (for display or legacy code).
 * 
 * @param money - MoneyValue instance
 * @returns Amount in currency units (e.g., 1234.56)
 */
export function toMajorUnits(money: MoneyValue): number {
  return money.minorUnits / 100;
}

/**
 * Convert MoneyValue to minor units (for storage).
 * 
 * @param money - MoneyValue instance
 * @returns Amount in minor units (cents)
 */
export function toMinorUnits(money: MoneyValue): number {
  return money.minorUnits;
}

/**
 * Create a zero MoneyValue for a given currency.
 */
export function zero(currency: string): MoneyValue {
  return { minorUnits: 0, currency: currency.toUpperCase() };
}

/**
 * Add two MoneyValues (must have same currency).
 * 
 * @throws Error if currencies do not match
 */
export function add(a: MoneyValue, b: MoneyValue): MoneyValue {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} and ${b.currency} — currency mismatch`);
  }
  return { minorUnits: a.minorUnits + b.minorUnits, currency: a.currency };
}

/**
 * Subtract MoneyValues (must have same currency).
 * 
 * @throws Error if currencies do not match
 */
export function subtract(a: MoneyValue, b: MoneyValue): MoneyValue {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot subtract ${a.currency} and ${b.currency} — currency mismatch`);
  }
  return { minorUnits: a.minorUnits - b.minorUnits, currency: a.currency };
}

/**
 * Sum an array of MoneyValues (must all have same currency).
 * 
 * @throws Error if currencies do not match
 */
export function sum(values: MoneyValue[]): MoneyValue {
  if (values.length === 0) {
    return { minorUnits: 0, currency: 'EUR' }; // Default to EUR for empty arrays
  }
  const currency = values[0].currency;
  const total = values.reduce((acc, v) => {
    if (v.currency !== currency) {
      throw new Error(`Cannot sum ${v.currency} with ${currency} — currency mismatch`);
    }
    return acc + v.minorUnits;
  }, 0);
  return { minorUnits: total, currency };
}

/**
 * Check if a MoneyValue is negative.
 */
export function isNegative(money: MoneyValue): boolean {
  return money.minorUnits < 0;
}

/**
 * Check if a MoneyValue is zero.
 */
export function isZero(money: MoneyValue): boolean {
  return money.minorUnits === 0;
}

/**
 * Check if a MoneyValue is positive.
 */
export function isPositive(money: MoneyValue): boolean {
  return money.minorUnits > 0;
}

/**
 * Compare two MoneyValues (must have same currency).
 * 
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 * @throws Error if currencies do not match
 */
export function compare(a: MoneyValue, b: MoneyValue): -1 | 0 | 1 {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot compare ${a.currency} and ${b.currency} — currency mismatch`);
  }
  if (a.minorUnits < b.minorUnits) return -1;
  if (a.minorUnits > b.minorUnits) return 1;
  return 0;
}

/**
 * Format MoneyValue for display (basic formatting).
 * For full locale-aware formatting, use localeUtils.
 * 
 * @param money - MoneyValue instance
 * @param options - Formatting options
 * @returns Formatted string (e.g., "€1,234.56")
 */
export function format(
  money: MoneyValue,
  options: { showCurrency?: boolean } = {}
): string {
  const { showCurrency = true } = options;
  const majorUnits = toMajorUnits(money);
  const showDecimals = Math.abs(majorUnits) < 1000;
  const formatted = majorUnits.toLocaleString('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });
  
  if (!showCurrency) {
    return formatted;
  }
  
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF ',
  };
  
  const symbol = symbols[money.currency] || `${money.currency} `;
  return `${symbol}${formatted}`;
}

// ==========================================================================
// LEGACY BRIDGE FUNCTIONS
// ==========================================================================
// These functions bridge between the new MoneyValue type and existing
// centsToUnits/unitsToCents patterns. They do NOT change existing behavior.

/**
 * Bridge: Convert nullable cents value to MoneyValue.
 * Returns null if input is null/undefined.
 * 
 * @deprecated Use for legacy bridge only. New code should use fromMinorUnits.
 */
export function fromCentsNullable(
  cents: number | null | undefined,
  currency: string
): MoneyValue | null {
  if (cents === null || cents === undefined) return null;
  return fromMinorUnits(cents, currency);
}

/**
 * Bridge: Convert MoneyValue to major units (nullable).
 * Returns null if input is null.
 * 
 * @deprecated Use for legacy bridge only. New code should use toMajorUnits.
 */
export function toMajorUnitsNullable(money: MoneyValue | null | undefined): number | null {
  if (money === null || money === undefined) return null;
  return toMajorUnits(money);
}
