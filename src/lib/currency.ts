import type { JobSettings } from '../types';

export type QuoteCurrencyCode =
  | 'ZAR'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'NZD'
  | 'NAD'
  | 'BWP'
  | 'MZN'
  | 'ZMW';

export interface QuoteCurrencyDef {
  code: QuoteCurrencyCode;
  /** Dropdown label */
  label: string;
  /** Legal / PDF phrasing */
  name: string;
  symbol: string;
  locale: string;
}

export const DEFAULT_QUOTE_CURRENCY: QuoteCurrencyCode = 'ZAR';

export const QUOTE_CURRENCIES: QuoteCurrencyDef[] = [
  { code: 'ZAR', label: 'ZAR — South African Rand (R)', name: 'South African Rand', symbol: 'R', locale: 'en-ZA' },
  { code: 'USD', label: 'USD — US Dollar ($)', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', label: 'EUR — Euro (€)', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', label: 'GBP — British Pound (£)', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar (NZ$)', name: 'New Zealand Dollar', symbol: 'NZ$', locale: 'en-NZ' },
  { code: 'NAD', label: 'NAD — Namibian Dollar (N$)', name: 'Namibian Dollar', symbol: 'N$', locale: 'en-NA' },
  { code: 'BWP', label: 'BWP — Botswana Pula (P)', name: 'Botswana Pula', symbol: 'P', locale: 'en-BW' },
  { code: 'MZN', label: 'MZN — Mozambican Metical (MT)', name: 'Mozambican Metical', symbol: 'MT', locale: 'pt-MZ' },
  { code: 'ZMW', label: 'ZMW — Zambian Kwacha (ZK)', name: 'Zambian Kwacha', symbol: 'ZK', locale: 'en-ZM' },
];

export function resolveQuoteCurrency(settings: JobSettings): QuoteCurrencyDef {
  const code = (settings.quoteCurrency ?? DEFAULT_QUOTE_CURRENCY) as QuoteCurrencyCode;
  return QUOTE_CURRENCIES.find((c) => c.code === code) ?? QUOTE_CURRENCIES[0];
}

export function resolveQuoteCurrencyCode(settings: JobSettings): QuoteCurrencyCode {
  return resolveQuoteCurrency(settings).code;
}

function formatNumber(
  amount: number,
  locale: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string {
  return Number(amount).toLocaleString(locale, { minimumFractionDigits, maximumFractionDigits });
}

/** Format a money amount for display in cut lists, quotes, and PDFs. */
export function formatMoney(
  amount: number,
  settings: JobSettings,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const cur = resolveQuoteCurrency(settings);
  const min = opts?.minimumFractionDigits ?? 2;
  const max = opts?.maximumFractionDigits ?? 2;
  const n = formatNumber(amount, cur.locale, min, max);
  if (cur.code === 'ZAR') return `R ${n}`;
  if (cur.code === 'EUR') return `€${n}`;
  return `${cur.symbol}${n}`;
}

/** e.g. "Price / sheet (R)" */
export function priceInputLabel(settings: JobSettings, unit: string): string {
  const sym = resolveQuoteCurrency(settings).symbol;
  return `${unit} (${sym})`;
}

/** e.g. "R / pair" */
export function ratePerUnitLabel(settings: JobSettings, unit: string): string {
  return `${resolveQuoteCurrency(settings).symbol} / ${unit}`;
}

/** PDF / client quote footer — currency only. */
export function quoteCurrencyLine(settings: JobSettings): string {
  const cur = resolveQuoteCurrency(settings);
  return `All amounts in ${cur.name} (${cur.code}).`;
}
