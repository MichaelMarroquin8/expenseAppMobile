import { BANK_SOURCE_PRESETS } from './bankSources';
import { SmsDetection } from './models';
import { extractCardLast4, guessCategory } from './smsParser';

const STATUS_TITLE =
  /^(enviaste|env[ií]o|recibiste|pagaste|compraste|compra|pago|transferencia|retiro|ahora puedes|tu plata|plata)\b/i;

const INCOMING = /\b(recibiste|te lleg[oó]|te enviaron|abono recibido|consignaron)\b/i;
const OUTGOING = /\b(enviaste|env[ií]o de plata|pagaste|compraste|compra por|transferiste|retiraste)\b/i;

const COUNTERPARTY_PATTERNS = [
  /le enviaste a\s+(.+?)(?:\s+en su cuenta|\s+a su cuenta|\s+desde\b|[.]|$)/i,
  /enviaste(?:\s+\$?\s*[\d.,]+)?\s+a\s+(.+?)(?:\s+en\b|\s+desde\b|[.]|$)/i,
  /(?:pagaste|compraste|compra(?:ste)?)\s+(?:por\s+)?\$?\s*[\d.,]+\s+en\s+(.+?)(?:\s+con\b|\s+desde\b|\s+usando\b|[.]|$)/i,
  /(?:recibiste|te lleg[oó]|te enviaron)\s+(?:un(?:a)?\s+)?(?:pago|env[ií]o|plata|\$?\s*[\d.,]+)\s+(?:de|por)\s+(.+?)(?:[.]|$)/i,
  /recibiste\s+\$?\s*[\d.,]+\s+de\s+(.+?)(?:[.]|$)/i,
];

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

const extractLast4 = (text: string): string | undefined => extractCardLast4(text);

const tidy = (value: string): string =>
  value.replace(/\s+/g, ' ').replace(/[.\s]+$/g, '').trim().slice(0, 60);

const cleanMerchant = (title?: string, text?: string): string => {
  const raw = (title ?? '').trim();
  if (raw && !/^google\s*(wallet|pay)?$/i.test(raw) && !STATUS_TITLE.test(raw)) {
    return tidy(raw);
  }
  const fromText =
    text?.match(/(?:en|at|a)\s+([A-Za-z0-9ÁÉÍÓÚáéíóúÑñ .&'-]{3,40})/i)?.[1] ??
    text?.split(/\s+with\s+|\s+con\s+/i)[0];
  return tidy(fromText ?? 'Comercio detectado');
};

const extractCounterparty = (text: string): string | undefined => {
  for (const pattern of COUNTERPARTY_PATTERNS) {
    const match = text.match(pattern)?.[1];
    if (!match) continue;
    const name = tidy(match);
    if (name.length >= 2) return name;
  }
  return undefined;
};

const appMerchant = (title: string, sender: string, raw: string): string => {
  const counterparty = extractCounterparty(raw);
  if (counterparty) return counterparty;
  if (/env[ií]o de plata|enviaste/i.test(raw)) return tidy(`Envío ${sender}`);
  if (/pagaste|compraste|compra/i.test(raw)) return tidy(`Compra ${sender}`);
  if (INCOMING.test(raw)) return tidy(`Recibo ${sender}`);
  if (title && !STATUS_TITLE.test(title)) return tidy(title);
  return sender;
};

/**
 * Parsea avisos de Google Wallet y de apps bancarias (Nu, Nequi, etc.).
 * Wallet: título = comercio, texto = "$X.XX with Visa •••• 1234".
 * Nu: "Enviaste $1,00" / "Le enviaste a NOMBRE en su cuenta de Bancolombia."
 * Nequi: "Envío de plata exitoso" / "envío de plata por $20.000".
 */
export const parseWalletNotification = (
  input: NotificationRawInput,
): Omit<SmsDetection, 'status' | 'duplicate' | 'cardId'> => {
  const title = input.title?.trim() ?? '';
  const text = input.text?.trim() ?? '';
  const rawMessage = [title, text].filter(Boolean).join(' — ');
  const packageName = input.packageName;
  const preset = BANK_SOURCE_PRESETS.find((item) => item.packages.includes(packageName));
  const trustedSource = Boolean(preset);
  const sender = preset?.label ?? packageName;
  const bankApp = Boolean(preset && preset.id !== 'wallet');
  const amount = extractAmount(rawMessage);
  const last4 = extractLast4(rawMessage);
  const merchant = bankApp ? appMerchant(title, sender, rawMessage) : cleanMerchant(title, text);
  const occurredAt =
    typeof input.postedAt === 'number' && input.postedAt > 0
      ? new Date(input.postedAt).toISOString()
      : new Date().toISOString();
  const direction: 'in' | 'out' =
    INCOMING.test(rawMessage) && !OUTGOING.test(rawMessage) ? 'in' : 'out';

  return {
    id: input.id?.trim() || hashMessage(`${packageName}::${rawMessage}::${occurredAt}`),
    sender,
    channel: 'notification',
    direction,
    trustedSource,
    rawMessage,
    bank: bankApp ? preset?.id : undefined,
    amount,
    merchant,
    occurredAt,
    last4,
    categoryGuess: guessCategory(`${merchant} ${text}`),
  };
};
