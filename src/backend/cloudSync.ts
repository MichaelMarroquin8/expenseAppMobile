import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { AppSettings, Budget, FinanceAccount, InvestmentHolding, PaymentCard, ReceivableDebt, SavingsGoal, SmsDetection, Transaction } from '../domain/models';

export interface FinanceCloudSnapshot {
  onboardingDone: boolean;
  transactionCategories: string[];
  incomeCategories?: string[];
  categoryIcons: Record<string, string>;
  accounts: FinanceAccount[];
  /** Desglose de cuentas por cobrar. Ausente en documentos anteriores a esta versión. */
  receivables?: ReceivableDebt[];
  /** Acciones dentro de cuentas de inversión. Ausente en documentos anteriores a esta versión. */
  holdings?: InvestmentHolding[];
  budgets: Budget[];
  goals: SavingsGoal[];
  cards: PaymentCard[];
  smsDetections: SmsDetection[];
  settings: AppSettings;
}

/** Documento antiguo: los movimientos vivían dentro del snapshot. */
export type StoredFinanceSnapshot = FinanceCloudSnapshot & {
  transactions?: Transaction[];
};

const getSnapshotRef = (uid: string) => doc(firebaseDb!, 'users', uid, 'finance', 'main');

export interface CloudSnapshotRecord {
  snapshot: StoredFinanceSnapshot | null;
  updatedAtMs: number | null;
}

const readUpdatedAtMs = (value: unknown): number | null => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
};

export const loadCloudSnapshot = async (uid: string): Promise<StoredFinanceSnapshot | null> => {
  const record = await loadCloudRecord(uid);
  return record?.snapshot ?? null;
};

export const loadCloudRecord = async (uid: string): Promise<CloudSnapshotRecord | null> => {
  if (!firebaseDb) return null;
  const snap = await getDoc(getSnapshotRef(uid));
  if (!snap.exists()) return { snapshot: null, updatedAtMs: null };
  const data = snap.data();
  return {
    snapshot: data?.snapshot ?? null,
    updatedAtMs: readUpdatedAtMs(data?.updatedAt),
  };
};

const omitUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry === undefined) continue;
      output[key] = omitUndefined(entry);
    }
    return output;
  }
  return value;
};

/** Qué escritura falló, para poder decirle al usuario qué dato rechazó la nube. */
export type CloudWriteTarget = { kind: 'profile' } | { kind: 'transaction'; label: string; field?: string };

const withTarget = (error: unknown, target: CloudWriteTarget): unknown => {
  if (error && typeof error === 'object') {
    (error as { cloudTarget?: CloudWriteTarget }).cloudTarget = target;
  }
  return error;
};

export const saveCloudSnapshot = async (uid: string, snapshot: FinanceCloudSnapshot): Promise<void> => {
  if (!firebaseDb) return;
  const ref = getSnapshotRef(uid);
  try {
    await setDoc(ref, {
      snapshot: omitUndefined(snapshot),
      updatedAt: serverTimestamp(),
      schemaVersion: 2,
    });
  } catch (error) {
    throw withTarget(error, { kind: 'profile' });
  }
};

const isStringUpTo = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length <= max;

/** Refleja `isValidTransaction` de firestore.rules; devuelve el primer campo que la nube rechazaría. */
const transactionRuleIssue = (data: Record<string, unknown>): string | null => {
  if (Object.keys(data).length > 24) return 'demasiados campos';
  if (!['income', 'expense', 'transfer'].includes(data.type as string)) return 'type';
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount)) return 'amount';
  if (!isStringUpTo(data.currency, 4) || data.currency.length < 3) return 'currency';
  if (!isStringUpTo(data.category, 80) || data.category.length === 0) return 'category';
  if (!Array.isArray(data.tags) || data.tags.length > 20) return 'tags';
  if (!['cash', 'transfer', 'card', 'wallet'].includes(data.paymentMethod as string)) return 'paymentMethod';
  if (!isStringUpTo(data.merchant, 200)) return 'merchant';
  if (!isStringUpTo(data.occurredAt, 40)) return 'occurredAt';
  if (typeof data.recurring !== 'boolean') return 'recurring';
  if (!['manual', 'sms', 'notification'].includes(data.source as string)) return 'source';
  const optionalStrings: Array<[string, number]> = [
    ['note', 2000],
    ['subcategory', 80],
    ['originalCurrency', 4],
    ['cardId', 80],
    ['accountId', 80],
    ['destinationAccountId', 80],
    ['detectionId', 500],
  ];
  for (const [key, max] of optionalStrings) {
    if (key in data && !isStringUpTo(data[key], max)) return key;
  }
  for (const key of ['originalAmount', 'exchangeRate']) {
    if (key in data && typeof data[key] !== 'number') return key;
  }
  if ('recurringRule' in data && !['daily', 'weekly', 'monthly'].includes(data.recurringRule as string)) {
    return 'recurringRule';
  }
  return null;
};

const transactionLabel = (transaction: Transaction) =>
  `${transaction.merchant || transaction.category || 'Movimiento'} (${String(transaction.occurredAt ?? '').slice(0, 10)})`;

const transactionsCollection = (uid: string) => collection(firebaseDb!, 'users', uid, 'transactions');

const transactionDoc = (uid: string, id: string) => doc(firebaseDb!, 'users', uid, 'transactions', id);

const isSafeTransactionId = (id: string) => id.length > 0 && id.length <= 700 && !id.includes('/');

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
};

const transactionFingerprint = (transaction: Transaction) => JSON.stringify(stableValue(omitUndefined(transaction)));

const fingerprintMap = (transactions: Transaction[]) => {
  const map = new Map<string, string>();
  for (const transaction of transactions) {
    if (!transaction || !isSafeTransactionId(transaction.id)) continue;
    map.set(transaction.id, transactionFingerprint(transaction));
  }
  return map;
};

const cloudTransactionCache = new Map<string, Map<string, string>>();

export const cacheCloudTransactions = (uid: string, transactions: Transaction[]) => {
  cloudTransactionCache.set(uid, fingerprintMap(transactions));
};

export const clearCloudTransactionCache = (uid?: string) => {
  if (uid) cloudTransactionCache.delete(uid);
  else cloudTransactionCache.clear();
};

export const loadCloudTransactions = async (uid: string): Promise<Transaction[]> => {
  if (!firebaseDb) return [];
  const snap = await getDocs(transactionsCollection(uid));
  const transactions: Transaction[] = [];
  snap.forEach((item) => {
    const data = item.data();
    const id = data && typeof data.id === 'string' ? data.id : item.id;
    if (!isSafeTransactionId(id)) return;
    transactions.push({ ...data, id } as Transaction);
  });
  return transactions;
};

const BATCH_LIMIT = 400;

export const syncCloudTransactions = async (uid: string, transactions: Transaction[]): Promise<void> => {
  if (!firebaseDb) return;
  let known = cloudTransactionCache.get(uid);
  if (!known) {
    known = fingerprintMap(await loadCloudTransactions(uid));
  }

  const local = fingerprintMap(transactions);
  const writes = transactions.filter((transaction) => {
    if (!transaction || !isSafeTransactionId(transaction.id)) return false;
    return known?.get(transaction.id) !== local.get(transaction.id);
  });
  const deletes = [...known.keys()].filter((id) => !local.has(id));
  const operations: Array<{ kind: 'set'; transaction: Transaction } | { kind: 'delete'; id: string }> = [
    ...writes.map((transaction) => ({ kind: 'set' as const, transaction: omitUndefined(transaction) as Transaction })),
    ...deletes.map((id) => ({ kind: 'delete' as const, id })),
  ];

  for (const operation of operations) {
    if (operation.kind !== 'set') continue;
    const field = transactionRuleIssue(operation.transaction as unknown as Record<string, unknown>);
    if (field) {
      console.warn('[cloudSync] movimiento rechazado por las reglas', field, operation.transaction);
      throw withTarget(Object.assign(new Error('invalid-transaction'), { code: 'invalid-transaction' }), {
        kind: 'transaction',
        label: transactionLabel(operation.transaction),
        field,
      });
    }
  }

  const synced = new Map(known);
  const markApplied = (operation: (typeof operations)[number]) => {
    if (operation.kind === 'set') {
      const fingerprint = local.get(operation.transaction.id);
      if (fingerprint) synced.set(operation.transaction.id, fingerprint);
    } else {
      synced.delete(operation.id);
    }
  };

  const rejected: Array<{ operation: (typeof operations)[number]; error: unknown }> = [];

  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const chunk = operations.slice(index, index + BATCH_LIMIT);
    const batch = writeBatch(firebaseDb);
    for (const operation of chunk) {
      if (operation.kind === 'set') {
        batch.set(transactionDoc(uid, operation.transaction.id), operation.transaction);
      } else {
        batch.delete(transactionDoc(uid, operation.id));
      }
    }
    try {
      await batch.commit();
      chunk.forEach(markApplied);
    } catch {
      // Un lote es todo o nada: se reintenta uno por uno para guardar los válidos y aislar el rechazado.
      for (const operation of chunk) {
        try {
          if (operation.kind === 'set') {
            await setDoc(transactionDoc(uid, operation.transaction.id), operation.transaction);
          } else {
            await deleteDoc(transactionDoc(uid, operation.id));
          }
          markApplied(operation);
        } catch (error) {
          rejected.push({ operation, error });
        }
      }
    }
  }

  cloudTransactionCache.set(uid, synced);

  if (rejected.length > 0) {
    const { operation, error } = rejected[0];
    console.warn(
      '[cloudSync] la nube rechazó',
      rejected.length,
      'movimiento(s). Primero:',
      operation.kind === 'set' ? operation.transaction : { delete: operation.id },
    );
    throw withTarget(error, {
      kind: 'transaction',
      label:
        operation.kind === 'set'
          ? `${transactionLabel(operation.transaction)}${rejected.length > 1 ? ` y ${rejected.length - 1} más` : ''}`
          : 'un movimiento eliminado',
    });
  }
};
