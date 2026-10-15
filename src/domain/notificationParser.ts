import { SmsDetection } from './models';
import { guessCategory } from './smsParser';

const WALLET_PACKAGES = new Set([
  'com.google.android.apps.walletnfcrel',
  'com.google.android.gms',
  'com.google.android.apps.nbu.paisa.user',
]);

export interface NotificationRawInput {
  id?: string;
  packageName: string;
  title?: string;
  text?: string;
  postedAt?: number;
}

const hashMessage = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `notif_${Math.abs(hash)}`;
};

const parseAmountValue = (rawValue?: string): number | undefined => {
  if (!rawValue) return undefined;
  const cleaned = rawValue.replace(/[^\d.,]/g, '');
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized = cleaned;
  if (decimalIndex >= 0) {
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, '');
    // COP suele usar . como miles: 45.000 → sin decimales si la parte decimal tiene 3 dígitos
    if (decimalPart.length === 3 && !cleaned.includes(',')) {
      normalized = `${integerPart}${decimalPart}`;
    } else {
      normalized = `${integerPart}.${decimalPart}`;
    }
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const extractAmount = (text: string): number | undefined => {
  const match =
    text.match(/(?:\$|cop|usd|mxn|€|£)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i) ??
    text.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?)\s*(?:cop|usd|mxn)?/i) ??
    text.match(/(\d+[.,]\d{1,2})/);
  return parseAmountValue(match?.[1]);
};

const extractLast4 = (text: string): string | undefined => {
  const match =
    text.match(/(?:[•*·.]{2,}|\*{2,}|x{2,})\s*(\d{4})/i) ??
    text.match(
      /(?:with|con)\s+(?:visa|mastercard|amex|débito|debito|crédito|credito)?[^0-9]*(\d{4})/i,
    ) ??
    text.match(/\b(\d{4})\s*$/);
  return match?.[1];
};

const cleanMerchant = (title?: string, text?: string): string => {
  const raw = (title ?? '').trim();
  if (raw && !/^google\s*(wallet|pay)?$/i.test(raw) && !/^pago$/i.test(raw)) {
    return raw.replace(/\s+/g, ' ').slice(0, 60);
  }
  const fromText =
    text?.match(/(?:en|at|a)\s+([A-Za-z0-9ÁÉÍÓÚáéíóúÑñ .&'-]{3,40})/i)?.[1] ??
    text?.split(/\s+with\s+|\s+con\s+/i)[0];
  return (fromText ?? 'Comercio detectado').trim().slice(0, 60);
};

/**
 * Parsea notificaciones estilo Google Wallet:
 * título = comercio, texto = "$X.XX with Visa •••• 1234"
 */
export const parseWalletNotification = (
  input: NotificationRawInput,
): Omit<SmsDetection, 'status' | 'duplicate' | 'cardId'> => {
  const title = input.title?.trim() ?? '';
  const text = input.text?.trim() ?? '';
  const rawMessage = [title, text].filter(Boolean).join(' — ');
  const packageName = input.packageName;
  const trustedSource = WALLET_PACKAGES.has(packageName);
  const amount = extractAmount(rawMessage);
  const last4 = extractLast4(rawMessage);
  const merchant = cleanMerchant(title, text);
  const occurredAt =
    typeof input.postedAt === 'number' && input.postedAt > 0
      ? new Date(input.postedAt).toISOString()
      : new Date().toISOString();

  return {
    id: input.id?.trim() || hashMessage(`${packageName}::${rawMessage}::${occurredAt}`),
    sender: packageName.includes('wallet') ? 'Google Wallet' : packageName,
    channel: 'notification',
    trustedSource,
    rawMessage,
    bank: undefined,
    amount,
    merchant,
    occurredAt,
    last4,
    categoryGuess: guessCategory(`${merchant} ${text}`),
  };
};
