import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseDb } from './firebase';
import { AppSettings, Budget, FinanceAccount, PaymentCard, SavingsGoal, SmsDetection, Transaction } from '../domain/models';

export interface FinanceCloudSnapshot {
  onboardingDone: boolean;
  transactions: Transaction[];
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

const getSnapshotRef = (uid: string) => doc(firebaseDb!, 'users', uid, 'finance', 'main');

export interface CloudSnapshotRecord {
  snapshot: FinanceCloudSnapshot | null;
  updatedAtMs: number | null;
}

const readUpdatedAtMs = (value: unknown): number | null => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
};

export const loadCloudSnapshot = async (uid: string): Promise<FinanceCloudSnapshot | null> => {
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
      schemaVersion: 1,
    },
    { merge: true },
  );
};
