import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { AppSettings, Budget, FinanceAccount, PaymentCard, SavingsGoal, SmsDetection, Transaction } from '../domain/models';

export interface FinanceCloudSnapshot {
  onboardingDone: boolean;
  transactionCategories: string[];
  incomeCategories?: string[];
  categoryIcons: Record<string, string>;
  accounts: FinanceAccount[];
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

export const saveCloudSnapshot = async (uid: string, snapshot: FinanceCloudSnapshot): Promise<void> => {
  if (!firebaseDb) return;
  const ref = getSnapshotRef(uid);
  await setDoc(
    ref,
    {
      snapshot: omitUndefined(snapshot),
      updatedAt: serverTimestamp(),
      schemaVersion: 2,
    },
    { merge: true },
  );
};

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

  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = writeBatch(firebaseDb);
    for (const operation of operations.slice(index, index + BATCH_LIMIT)) {
      if (operation.kind === 'set') {
        batch.set(transactionDoc(uid, operation.transaction.id), operation.transaction);
      } else {
        batch.delete(transactionDoc(uid, operation.id));
      }
    }
    await batch.commit();
  }

  cloudTransactionCache.set(uid, local);
};
