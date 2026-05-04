import { SmsDetection, Transaction } from './models';

const CATEGORY_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'Comida', patterns: [/uber ?eats/i, /rappi/i, /restaurante/i, /caf[eé]/i] },
  { category: 'Transporte', patterns: [/uber/i, /didi/i, /gasolina/i, /peaje/i] },
  { category: 'Supermercado', patterns: [/walmart/i, /costco/i, /super/i, /market/i] },
  { category: 'Entretenimiento', patterns: [/netflix/i, /spotify/i, /cine/i, /steam/i] },
];

const BANK_PATTERNS = [/bbva/i, /banamex/i, /banco ?azteca/i, /santander/i, /nu/i];

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

export const parseSms = (rawMessage: string): Omit<SmsDetection, 'status' | 'duplicate' | 'cardId'> => {
  const amountMatch = rawMessage.match(/(?:\$|mxn|usd)?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/i);
  const merchantMatch = rawMessage.match(/(?:en|a|comercio)\s+([a-z0-9 .&-]{3,40})/i);
  const last4Match = rawMessage.match(/(?:\*{2,}|terminaci[oó]n|tarjeta)\s?(\d{4})/i);
  const dateMatch = rawMessage.match(
    /(\d{4}[-/]\d{2}[-/]\d{2}[ t]\d{2}:\d{2}|\d{2}[-/]\d{2}[-/]\d{4}(?:\s\d{2}:\d{2})?)/i,
  );
  const bankMatch = BANK_PATTERNS.find((pattern) => pattern.test(rawMessage))?.source;

  const normalizedAmount = amountMatch
    ? Number(amountMatch[1].replace(/\./g, '').replace(',', '.'))
    : undefined;
  const occurredAt = dateMatch ? new Date(dateMatch[1].replace(' ', 'T')).toISOString() : undefined;

  return {
    id: hashMessage(rawMessage),
    rawMessage,
    bank: bankMatch?.replace(/\\\?/g, ''),
    amount: Number.isNaN(normalizedAmount) ? undefined : normalizedAmount,
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
