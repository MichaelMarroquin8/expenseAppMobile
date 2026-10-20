import { DEFAULT_BANK_SMS_SHORT_CODES } from './bankSources';
import { SmsDetection, Transaction } from './models';

const CATEGORY_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Comida', patterns: [/uber ?eats/i, /rappi/i, /restaurante/i, /caf[eé]/i] },
  { category: 'Transporte', patterns: [/uber/i, /didi/i, /gasolina/i, /peaje/i] },
  { category: 'Supermercado', patterns: [/walmart/i, /costco/i, /super/i, /market/i] },
  { category: 'Entretenimiento', patterns: [/netflix/i, /spotify/i, /cine/i, /steam/i] },
];

const BANK_PATTERNS = [/bbva/i, /banamex/i, /banco ?azteca/i, /santander/i, /nu/i, /bancolombia/i, /nequi/i, /daviplata/i];
/** @deprecated Prefer DEFAULT_BANK_SMS_SHORT_CODES from bankSources */
export const BANCOLOMBIA_SHORT_CODES = ['85540', '85784'] as const;
const TRUSTED_SHORT_CODE_SET = new Set(
  DEFAULT_BANK_SMS_SHORT_CODES.map((c) => c.replace(/[^\w]/g, '').toUpperCase()),
);
const BANCOLOMBIA_EMAIL_PATTERN = /@an\.notificacionesbancolombia\.com/i;

const resolveBankLabel = (sender?: string, senderCode?: string, rawMessage?: string): string | undefined => {
  if (BANCOLOMBIA_EMAIL_PATTERN.test(sender ?? '') || ['85540', '85784'].includes(senderCode ?? '')) {
    return 'bancolombia';
  }
  if (senderCode === 'NU' || senderCode === 'NUCO') return 'nu';
  if (senderCode?.includes('NEQUI') || senderCode === '4455637') return 'nequi';
  if (senderCode?.includes('BBVA')) return 'bbva';
  if (senderCode?.includes('DAVIPLATA')) return 'daviplata';
  if (TRUSTED_SHORT_CODE_SET.has(senderCode ?? '')) return 'bank';
  return BANK_PATTERNS.find((pattern) => pattern.test(rawMessage ?? ''))?.source?.replace(/\\\?/g, '');
};

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
  if (TRUSTED_SHORT_CODE_SET.has(normalized)) return true;
  if (BANCOLOMBIA_EMAIL_PATTERN.test(sender ?? '')) return true;
  return false;
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
    // COP suele usar . como miles: 321.900 -> sin decimales si la parte final tiene 3 dígitos y no coexisten ',' y '.'
    if (decimalPart.length === 3 && (lastComma === -1 || lastDot === -1)) {
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
  id?: string;
  sender?: string;
  message: string;
  channel?: 'sms' | 'email';
  /** Epoch ms del SMS nativo (inbox o receiver). */
  receivedAt?: number;
}

const extractRelevantText = (input: SmsRawInput): string => {
  if (input.channel !== 'email') return input.message;
  const flattened = input.message.replace(/\s+/g, ' ').trim();
  const movementSentence = flattened.match(
    /(Bancolombia:\s*(?:Pagaste|Retiraste|Compraste|Transferiste|Recibiste)[^.?!]*[.?!])/i,
  );
  return movementSentence?.[1] ?? flattened;
};

const parseAccountOutgoing = (
  rawMessage: string,
): { amount?: number; accountLast4: string; merchant: string; occurredAt?: string } | null => {
  const match = rawMessage.match(
    /(?:pagaste|transferiste|enviaste)\s+\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)[\s\S]{0,140}?desde\s+tu\s+cuenta\s+\*?(\d{4})/i,
  );
  if (!match) return null;
  const isTransfer = /c[oó]digo\s+qr|a\s+la\s+llave|transferiste|enviaste|transferencia/i.test(rawMessage);
  if (!isTransfer) return null;

  const llave = rawMessage.match(/a\s+la\s+llave\s+(\d{5,})/i)?.[1];
  const isQr = /c[oó]digo\s+qr/i.test(rawMessage);
  const merchant = (
    isQr
      ? `Código QR${llave ? ` · llave ${llave}` : ''}`
      : llave
        ? `Transferencia · llave ${llave}`
        : 'Transferencia'
  ).slice(0, 60);
  const dateMatch = rawMessage.match(/(\d{2}[-/]\d{2}[-/]\d{4}(?:\s+a\s+las\s+\d{2}:\d{2}(?::\d{2})?)?)/i);

  return {
    amount: parseAmountValue(match[1]),
    accountLast4: match[2],
    merchant,
    occurredAt: parseDateTime(dateMatch?.[1]),
  };
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
  const bankMatch = resolveBankLabel(sender, senderCode, rawMessage);
  const outgoing = parseAccountOutgoing(rawMessage);

  if (outgoing) {
    const occurredAt =
      outgoing.occurredAt ??
      (typeof input.receivedAt === 'number' && input.receivedAt > 0
        ? new Date(input.receivedAt).toISOString()
        : undefined);
    return {
      id: input.id?.trim() || hashMessage(`${channel}::${sender ?? 'unknown'}::${rawMessage}`),
      sender,
      channel,
      trustedSource: isTrustedSender(sender),
      rawMessage,
      bank: bankMatch,
      amount: outgoing.amount,
      merchant: outgoing.merchant,
      occurredAt,
      accountLast4: outgoing.accountLast4,
      categoryGuess: 'Otros',
    };
  }

  const normalizedAmount = parseAmountValue(amountMatch?.[1]);
  const occurredAt =
    parseDateTime(dateMatch?.[1]) ??
    (typeof input.receivedAt === 'number' && input.receivedAt > 0
      ? new Date(input.receivedAt).toISOString()
      : undefined);

  return {
    id: input.id?.trim() || hashMessage(`${channel}::${sender ?? 'unknown'}::${rawMessage}`),
    sender,
    channel,
    trustedSource: isTrustedSender(sender),
    rawMessage,
    bank: bankMatch,
    amount: normalizedAmount,
    merchant: merchantMatch?.[1]?.trim() ?? 'Comercio detectado',
    occurredAt,
    last4: last4Match?.[1],
    categoryGuess: guessCategory(rawMessage),
  };
};

const minuteKey = (iso?: string): string | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Mismo monto y mismo minuto. El nombre del comercio no participa. */
export const isSameAmountAndInstant = (
  left: { amount?: number; occurredAt?: string },
  right: { amount?: number; occurredAt?: string },
): boolean => {
  if (left.amount == null || right.amount == null || !left.occurredAt || !right.occurredAt) return false;
  if (!Number.isFinite(left.amount) || !Number.isFinite(right.amount)) return false;
  if (Math.abs(left.amount - right.amount) >= 0.01) return false;
  const leftMinute = minuteKey(left.occurredAt);
  const rightMinute = minuteKey(right.occurredAt);
  return Boolean(leftMinute && leftMinute === rightMinute);
};

const instantKey = (amount?: number, occurredAt?: string): string | undefined => {
  if (amount == null || !Number.isFinite(amount)) return undefined;
  const minute = minuteKey(occurredAt);
  if (!minute) return undefined;
  return `${Math.round(amount * 100)}@${minute}`;
};

/** El gasto ya está en el registro: mismo aviso, o mismo monto y misma hora, sin mirar el comercio. */
export const matchesSavedMovement = (
  candidate: Pick<SmsDetection, 'id' | 'amount' | 'occurredAt'>,
  transactions: Transaction[],
): boolean =>
  transactions.some((tx) => {
    if (!tx || typeof tx.amount !== 'number' || typeof tx.occurredAt !== 'string') {
      return Boolean(tx && tx.detectionId && tx.detectionId === candidate.id);
    }
    if (tx.detectionId && tx.detectionId === candidate.id) return true;
    if (tx.type === 'income') return false;
    return isSameAmountAndInstant(tx, candidate);
  });

export const isLikelyDuplicate = (
  candidate: SmsDetection,
  existingTransactions: Transaction[],
  existingDetections: SmsDetection[],
): boolean => {
  const alreadyOpen = existingDetections.some(
    (item) => item.id === candidate.id && item.status !== 'discarded',
  );
  if (alreadyOpen) return true;
  if (matchesSavedMovement(candidate, existingTransactions)) return true;

  return existingDetections.some(
    (item) => item.id !== candidate.id && isSameAmountAndInstant(item, candidate),
  );
};

/**
 * Deja visible un solo pendiente por monto+minuto.
 * Si ese gasto ya está guardado, o ya se descartó, el resto queda marcado como duplicado y no se pide de nuevo.
 */
export const reconcileDetections = (
  detections: SmsDetection[],
  transactions: Transaction[],
): SmsDetection[] => {
  const blocked = new Set<string>();
  for (const item of detections) {
    if (item.status !== 'discarded') continue;
    const key = instantKey(item.amount, item.occurredAt);
    if (key) blocked.add(key);
  }

  const seenPending = new Set<string>();
  return detections.map((item) => {
    if (item.status !== 'pending') return { ...item, duplicate: false };

    const key = instantKey(item.amount, item.occurredAt);
    const saved = matchesSavedMovement(item, transactions);
    const repeated = Boolean(key && (blocked.has(key) || seenPending.has(key)));
    if (key) seenPending.add(key);
    return { ...item, duplicate: saved || repeated };
  });
};
