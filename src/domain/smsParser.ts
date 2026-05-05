import { SmsDetection, Transaction } from './models';

const CATEGORY_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Comida', patterns: [/uber ?eats/i, /rappi/i, /restaurante/i, /caf[eé]/i] },
  { category: 'Transporte', patterns: [/uber/i, /didi/i, /gasolina/i, /peaje/i] },
  { category: 'Supermercado', patterns: [/walmart/i, /costco/i, /super/i, /market/i] },
  { category: 'Entretenimiento', patterns: [/netflix/i, /spotify/i, /cine/i, /steam/i] },
];

const BANK_PATTERNS = [/bbva/i, /banamex/i, /banco ?azteca/i, /santander/i, /nu/i, /bancolombia/i];
const BANCOLOMBIA_SHORT_CODES = new Set(['85540', '85784']);
const BANCOLOMBIA_EMAIL_PATTERN = /@an\.notificacionesbancolombia\.com/i;

const hashMessage = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return `sms_${Math.abs(hash)}`;
};

export const guessCategory = (text: string): string => {
  const match = CATEGORY_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(text)));
  return match?.category ?? 'Otros';
};

const normalizeSender = (sender?: string): string | undefined => sender?.trim() || undefined;

const getSenderCode = (sender?: string): string | undefined =>
  sender?.replace(/[^\w]/g, '').toUpperCase() || undefined;

const isTrustedSender = (sender?: string): boolean => {
  const normalized = getSenderCode(sender);
  if (!normalized) return false;
  if (BANCOLOMBIA_SHORT_CODES.has(normalized)) return true;
  if (BANCOLOMBIA_EMAIL_PATTERN.test(sender ?? '')) return true;
  return false;
};

const parseAmountValue = (rawValue?: string): number | undefined => {
  if (!rawValue) return undefined;
  const cleaned = rawValue.replace(/[^\d.,]/g, '');
  if (!cleaned) return undefined;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalSeparator = lastComma > lastDot ? ',' : '.';
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized = cleaned;
  if (decimalIndex >= 0) {
    const integerPart = cleaned.slice(0, decimalIndex).replace(/[.,]/g, '');
    const decimalPart = cleaned.slice(decimalIndex + 1).replace(/[.,]/g, '');
    normalized = `${integerPart}.${decimalPart}`;
  } else {
    normalized = cleaned.replace(/[.,]/g, '');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseDateTime = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/\s+a\s+las\s+/i, ' ');

  const yyyyFirst = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (yyyyFirst) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = yyyyFirst;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).toISOString();
  }

  const ddFirst = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (ddFirst) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = ddFirst;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)).toISOString();
  }

  return undefined;
};

export interface SmsRawInput {
  sender?: string;
  message: string;
  channel?: 'sms' | 'email';
}

const extractRelevantText = (input: SmsRawInput): string => {
  if (input.channel !== 'email') return input.message;
  const flattened = input.message.replace(/\s+/g, ' ').trim();
  const movementSentence = flattened.match(
    /(Bancolombia:\s*(?:Pagaste|Retiraste|Compraste|Transferiste|Recibiste)[^.?!]*[.?!])/i,
  );
  return movementSentence?.[1] ?? flattened;
};

export const parseSms = (input: SmsRawInput): Omit<SmsDetection, 'status' | 'duplicate' | 'cardId'> => {
  const sender = normalizeSender(input.sender);
  const channel = input.channel ?? 'sms';
  const rawMessage = extractRelevantText({ ...input, sender, channel });
  const senderCode = getSenderCode(sender);
  const amountMatch = rawMessage.match(
    /(?:\$|cop|mxn|usd)?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i,
  );
  const merchantMatch =
    rawMessage.match(/pagaste\s+\$[\d.,]+\s+a\s+(.+?)\s+desde/i) ??
    rawMessage.match(
      /(?:en|a|comercio|establecimiento)\s+([a-z0-9áéíóúñ .&*'-]{3,45}?)(?=\s+(?:desde|con|el|de|por)\b|[.,]|$)/i,
    );
  const last4Match = rawMessage.match(/(?:\*{2,}|terminaci[oó]n|tarjeta)\s?(\d{4})/i);
  const dateMatch = rawMessage.match(
    /(\d{4}[-/]\d{2}[-/]\d{2}(?:\s(?:a\s+las\s+)?\d{2}:\d{2}(?::\d{2})?)?|\d{2}[-/]\d{2}[-/]\d{4}(?:\s(?:a\s+las\s+)?\d{2}:\d{2}(?::\d{2})?)?)/i,
  );
  const bankMatch = BANCOLOMBIA_SHORT_CODES.has(senderCode ?? '') || BANCOLOMBIA_EMAIL_PATTERN.test(sender ?? '')
    ? 'bancolombia'
    : BANK_PATTERNS.find((pattern) => pattern.test(rawMessage))?.source;

  const normalizedAmount = parseAmountValue(amountMatch?.[1]);
  const occurredAt = parseDateTime(dateMatch?.[1]);

  return {
    id: hashMessage(`${channel}::${sender ?? 'unknown'}::${rawMessage}`),
    sender,
    channel,
    trustedSource: isTrustedSender(sender),
    rawMessage,
    bank: bankMatch?.replace(/\\\?/g, ''),
    amount: normalizedAmount,
    merchant: merchantMatch?.[1]?.trim() ?? 'Comercio detectado',
    occurredAt,
    last4: last4Match?.[1],
    categoryGuess: guessCategory(rawMessage),
  };
};

export const isLikelyDuplicate = (
  candidate: SmsDetection,
  existingTransactions: Transaction[],
  existingDetections: SmsDetection[],
): boolean => {
  const sameDetection = existingDetections.some((item) => item.id === candidate.id);
  if (sameDetection) return true;

  const sameTransaction = existingTransactions.some((tx) => {
    if (!candidate.amount || !candidate.occurredAt) return false;
    const sameAmount = Math.abs(tx.amount - candidate.amount) < 0.01;
    const sameDay =
      new Date(tx.occurredAt).toDateString() === new Date(candidate.occurredAt).toDateString();
    const sameMerchant =
      candidate.merchant && tx.merchant.toLowerCase().includes(candidate.merchant.toLowerCase());
    return sameAmount && sameDay && Boolean(sameMerchant);
  });

  return sameTransaction;
};
