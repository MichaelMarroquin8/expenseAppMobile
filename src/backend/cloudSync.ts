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

export const loadCloudSnapshot = async (uid: string): Promise<FinanceCloudSnapshot | null> => {
  if (!firebaseDb) return null;
  const ref = getSnapshotRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data()?.snapshot ?? null;
};

export const saveCloudSnapshot = async (uid: string, snapshot: FinanceCloudSnapshot): Promise<void> => {
  if (!firebaseDb) return;
  const ref = getSnapshotRef(uid);
  await setDoc(
    ref,
    {
      snapshot,
      updatedAt: serverTimestamp(),
      schemaVersion: 1,
    },
    { merge: true },
  );
};
