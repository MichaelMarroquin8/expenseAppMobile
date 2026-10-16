import { User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { FinanceCloudSnapshot, loadCloudSnapshot, saveCloudSnapshot } from '../../backend/cloudSync';
import { firebaseAuth, isFirebaseConfigured } from '../../backend/firebase';
import { useFinanceStore } from '../../store/useFinanceStore';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOutCurrent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isConfigured: false,
  signInEmail: async () => {},
  signUpEmail: async () => {},
  signOutCurrent: async () => {},
});

const mergeById = <T extends { id: string }>(cloudList: T[] | undefined, localList: T[]): T[] => {
  const safeCloud = Array.isArray(cloudList) ? cloudList : [];
  const map = new Map<string, T>();
  for (const item of safeCloud) {
    if (item && typeof item.id === 'string') map.set(item.id, item);
  }
  for (const item of localList) {
    if (item && typeof item.id === 'string' && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

const mergeStringLists = (cloudList: string[] | undefined, localList: string[], exclude: string[] = []): string[] => {
  const combined = [...(Array.isArray(cloudList) ? cloudList : []), ...localList];
  const unique: string[] = [];
  for (const raw of combined) {
    if (typeof raw !== 'string') continue;
    const item = raw.trim();
    if (!item || exclude.includes(item)) continue;
    if (!unique.some((u) => u.toLowerCase() === item.toLowerCase())) {
      unique.push(item);
    }
  }
  return unique;
};

const extractSnapshot = (): FinanceCloudSnapshot => {
  const state = useFinanceStore.getState();
  return {
    onboardingDone: state.onboardingDone,
    transactions: state.transactions,
    transactionCategories: state.transactionCategories,
    incomeCategories: state.incomeCategories,
    categoryIcons: state.categoryIcons,
    accounts: state.accounts,
    budgets: state.budgets,
    goals: state.goals,
    cards: state.cards,
    smsDetections: state.smsDetections,
    settings: state.settings,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const syncPausedRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setLoading(false);
        return;
      }

      try {
        syncPausedRef.current = true;
        const cloud = await loadCloudSnapshot(nextUser.uid);
        if (cloud) {
          const current = useFinanceStore.getState();
          const mergedTransactions = mergeById(cloud.transactions, current.transactions).sort(
            (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
          );
          const mergedExpenseCategories = mergeStringLists(
            cloud.transactionCategories,
            current.transactionCategories,
            ['Salario'],
          );
          const mergedIncomeCategories = mergeStringLists(
            cloud.incomeCategories,
            current.incomeCategories,
          );
          useFinanceStore.setState({
            onboardingDone: Boolean(cloud.onboardingDone || current.onboardingDone),
            transactions: mergedTransactions,
            transactionCategories:
              mergedExpenseCategories.length > 0 ? mergedExpenseCategories : current.transactionCategories,
            incomeCategories:
              mergedIncomeCategories.length > 0 ? mergedIncomeCategories : current.incomeCategories,
            categoryIcons: {
              ...current.categoryIcons,
              ...(cloud.categoryIcons ?? {}),
            },
            accounts: mergeById(cloud.accounts, current.accounts),
            budgets: mergeById(cloud.budgets, current.budgets),
            goals: mergeById(cloud.goals, current.goals),
            cards: mergeById(cloud.cards, current.cards),
            smsDetections: mergeById(cloud.smsDetections, current.smsDetections).slice(0, 80),
            settings: {
              ...current.settings,
              ...(cloud.settings ?? {}),
            },
          });
          await saveCloudSnapshot(nextUser.uid, extractSnapshot());
        } else {
          await saveCloudSnapshot(nextUser.uid, extractSnapshot());
        }
      } catch (error) {
        Alert.alert('Sync', 'No se pudo sincronizar con la nube.');
      } finally {
        syncPausedRef.current = false;
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useFinanceStore.subscribe(() => {
      if (syncPausedRef.current) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        saveCloudSnapshot(user.uid, extractSnapshot()).catch(() => {
          // silent background sync failure
        });
      }, 900);
    });
    return () => {
      unsub();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isConfigured: isFirebaseConfigured,
      signInEmail: async (email, password) => {
        if (!firebaseAuth) return;
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      },
      signUpEmail: async (email, password) => {
        if (!firebaseAuth) return;
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      },
      signOutCurrent: async () => {
        if (!firebaseAuth) return;
        await signOut(firebaseAuth);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
