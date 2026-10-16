export const monthKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const monthKeyFromIso = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate.slice(0, 7);
  return monthKey(parsed);
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  'COP',
  'CLP',
  'JPY',
  'KRW',
  'VND',
  'IDR',
  'PYG',
  'UGX',
  'RWF',
  'GNF',
  'XOF',
  'XAF',
  'XPF',
  'DJF',
  'KMF',
  'ISK',
]);

const CURRENCY_FORMAT_CONFIG: Record<string, { locale: string; maximumFractionDigits: number }> = {
  COP: { locale: 'es-CO', maximumFractionDigits: 0 },
  USD: { locale: 'en-US', maximumFractionDigits: 2 },
  MXN: { locale: 'es-MX', maximumFractionDigits: 2 },
  EUR: { locale: 'es-ES', maximumFractionDigits: 2 },
  PEN: { locale: 'es-PE', maximumFractionDigits: 2 },
  CLP: { locale: 'es-CL', maximumFractionDigits: 0 },
  ARS: { locale: 'es-AR', maximumFractionDigits: 2 },
  GBP: { locale: 'en-GB', maximumFractionDigits: 2 },
  BRL: { locale: 'pt-BR', maximumFractionDigits: 2 },
  JPY: { locale: 'ja-JP', maximumFractionDigits: 0 },
  CNY: { locale: 'zh-CN', maximumFractionDigits: 2 },
  CAD: { locale: 'en-CA', maximumFractionDigits: 2 },
  AUD: { locale: 'en-AU', maximumFractionDigits: 2 },
  CHF: { locale: 'de-CH', maximumFractionDigits: 2 },
  INR: { locale: 'en-IN', maximumFractionDigits: 2 },
  KRW: { locale: 'ko-KR', maximumFractionDigits: 0 },
};

const getCurrencyConfig = (currency: string) =>
  CURRENCY_FORMAT_CONFIG[currency] ?? {
    locale: 'es-CO',
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2,
  };

export const getCurrencyFractionDigits = (currency = 'COP'): number =>
  getCurrencyConfig(currency).maximumFractionDigits;

const FALLBACK_SEPARATORS: Record<string, { group: string; decimal: string }> = {
  'es-CO': { group: '.', decimal: ',' },
  'es-MX': { group: ',', decimal: '.' },
  'es-ES': { group: '.', decimal: ',' },
  'es-PE': { group: ',', decimal: '.' },
  'es-CL': { group: '.', decimal: ',' },
  'es-AR': { group: '.', decimal: ',' },
  'en-US': { group: ',', decimal: '.' },
};

const getSeparators = (locale: string) => {
  const fallback = FALLBACK_SEPARATORS[locale] ?? { group: '.', decimal: ',' };
  const formatter = new Intl.NumberFormat(locale);
  const hasFormatToParts = typeof formatter.formatToParts === 'function';

  if (!hasFormatToParts) return fallback;

  const parts = formatter.formatToParts(12345.6);
  const group = parts.find((part) => part.type === 'group')?.value ?? fallback.group;
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? fallback.decimal;
  return { group, decimal };
};

export const formatMoney = (value: number, currency = 'COP'): string => {
  const config = getCurrencyConfig(currency);
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: config.maximumFractionDigits,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(config.maximumFractionDigits)}`;
  }
};

export const parseAmountInput = (input: string, currency = 'COP'): string => {
  const { locale, maximumFractionDigits } = getCurrencyConfig(currency);
  const { decimal } = getSeparators(locale);
  const allowed = maximumFractionDigits === 0 ? /[0-9]/g : new RegExp(`[0-9${decimal}.,]`, 'g');
  const normalized = (input.match(allowed) ?? []).join('');

  if (maximumFractionDigits === 0) {
    return normalized.replace(/\D/g, '');
  }

  let raw = '';
  let hasDecimal = false;
  for (const char of normalized) {
    const isDecimal = char === decimal || char === '.' || char === ',';
    if (isDecimal) {
      if (!hasDecimal) {
        raw += '.';
        hasDecimal = true;
      }
      continue;
    }
    raw += char;
  }

  if (!hasDecimal) return raw;
  const [intPart, decimalPart = ''] = raw.split('.');
  return `${intPart}.${decimalPart.slice(0, maximumFractionDigits)}`;
};

export const formatAmountInput = (rawValue: string, currency = 'COP'): string => {
  if (!rawValue) return '';
  const { locale, maximumFractionDigits } = getCurrencyConfig(currency);
  const { decimal } = getSeparators(locale);

  if (maximumFractionDigits === 0) {
    const integer = Number(rawValue.replace(/\D/g, '') || '0');
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(integer);
  }

  const [intPart, decimalPart = ''] = rawValue.split('.');
  const normalizedInt = Number((intPart || '0').replace(/\D/g, ''));
  const formattedInt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(normalizedInt);
  return decimalPart.length > 0 ? `${formattedInt}${decimal}${decimalPart}` : formattedInt;
};

export const formatShortDate = (isoDate: string): string =>
  new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
