export const monthKey = (date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const CURRENCY_FORMAT_CONFIG: Record<string, { locale: string; maximumFractionDigits: number }> = {
  COP: { locale: 'es-CO', maximumFractionDigits: 0 },
  USD: { locale: 'en-US', maximumFractionDigits: 2 },
  MXN: { locale: 'es-MX', maximumFractionDigits: 2 },
  EUR: { locale: 'es-ES', maximumFractionDigits: 2 },
  PEN: { locale: 'es-PE', maximumFractionDigits: 2 },
  CLP: { locale: 'es-CL', maximumFractionDigits: 0 },
  ARS: { locale: 'es-AR', maximumFractionDigits: 2 },
};

const getCurrencyConfig = (currency: string) =>
  CURRENCY_FORMAT_CONFIG[currency] ?? { locale: 'es-CO', maximumFractionDigits: 2 };

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
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: config.maximumFractionDigits,
  }).format(value);
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
