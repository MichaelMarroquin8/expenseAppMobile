import { User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  cacheCloudTransactions,
  clearCloudTransactionCache,
  FinanceCloudSnapshot,
  loadCloudRecord,
  loadCloudTransactions,
  saveCloudSnapshot,
  StoredFinanceSnapshot,
  syncCloudTransactions,
} from '../../backend/cloudSync';
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from '../../backend/firebase';
import { Transaction } from '../../domain/models';
import { reconcileDetections } from '../../domain/smsParser';
import { useFinanceStore } from '../../store/useFinanceStore';

export type CloudSyncStatus = 'unknown' | 'checking' | 'synced' | 'out-of-sync' | 'error';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  syncStatus: CloudSyncStatus;
  syncError: string | null;
  lastSyncedAt: number | null;
  checkAndSync: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signOutCurrent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isConfigured: false,
  syncStatus: 'unknown',
  syncError: null,
  lastSyncedAt: null,
  checkAndSync: async () => {},
  signInEmail: async () => {},
  signUpEmail: async () => {},
  signOutCurrent: async () => {},
});

const waitForLocalHydration = () =>
  new Promise<void>((resolve) => {
    if (useFinanceStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    const unsub = useFinanceStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
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

const legacyTransactions = (snapshot: StoredFinanceSnapshot | null): Transaction[] => {
  if (!snapshot || !Array.isArray(snapshot.transactions)) return [];
  return snapshot.transactions.filter((item) => item && typeof item.id === 'string');
};

const profileOf = (snapshot: StoredFinanceSnapshot): FinanceCloudSnapshot => {
  const profile = { ...snapshot };
  delete profile.transactions;
  return profile;
};

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
};

const sortById = <T extends { id: string }>(list: T[] | undefined): T[] =>
  [...(Array.isArray(list) ? list : [])]
    .filter((item) => item && typeof item.id === 'string')
    .sort((left, right) => left.id.localeCompare(right.id));

const snapshotsMatch = (cloud: StoredFinanceSnapshot | null, local: FinanceCloudSnapshot): boolean => {
  if (!cloud) return false;
  const normalize = (snapshot: FinanceCloudSnapshot) =>
    sortValue({
      ...snapshot,
      accounts: sortById(snapshot.accounts),
      budgets: sortById(snapshot.budgets),
      goals: sortById(snapshot.goals),
      cards: sortById(snapshot.cards),
      smsDetections: sortById(snapshot.smsDetections),
      transactionCategories: [...(snapshot.transactionCategories ?? [])].sort((a, b) => a.localeCompare(b)),
      incomeCategories: [...(snapshot.incomeCategories ?? [])].sort((a, b) => a.localeCompare(b)),
    });
  return JSON.stringify(normalize(profileOf(cloud))) === JSON.stringify(normalize(local));
};

const transactionsMatch = (cloud: Transaction[], local: Transaction[]): boolean =>
  JSON.stringify(sortValue(sortById(cloud))) === JSON.stringify(sortValue(sortById(local)));

const syncErrorMessage = (error: unknown): string => {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
  const raw = error instanceof Error ? error.message : '';
  if (raw.includes("Database '(default)' not found") || code === 'not-found') {
    return 'Firestore no tiene la base (default). Créala en Firebase y vuelve a intentar.';
  }
  if (code === 'permission-denied') return 'La nube rechazó el acceso. Revisa las reglas de Firestore.';
  if (raw.includes('Unsupported field value: undefined') || code === 'invalid-argument') {
    return 'Hay un dato vacío que la nube no acepta. Vuelve a intentar.';
  }
  if (code === 'unavailable' || code === 'auth/network-request-failed' || raw.includes('network')) {
    return 'Sin conexión. Revisa la red e inténtalo de nuevo.';
  }
  return 'No se pudo sincronizar con la nube.';
};

const applyCloudMerge = (cloud: StoredFinanceSnapshot | null, transactions: Transaction[]) => {
  const current = useFinanceStore.getState();
  const mergedTransactions = mergeById(transactions, current.transactions).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  const mergedExpenseCategories = mergeStringLists(cloud?.transactionCategories, current.transactionCategories, [
    'Salario',
  ]);
  const mergedIncomeCategories = mergeStringLists(cloud?.incomeCategories, current.incomeCategories);
  useFinanceStore.setState({
    onboardingDone: Boolean(cloud?.onboardingDone || current.onboardingDone),
    transactions: mergedTransactions,
    transactionCategories: mergedExpenseCategories.length > 0 ? mergedExpenseCategories : current.transactionCategories,
    incomeCategories: mergedIncomeCategories.length > 0 ? mergedIncomeCategories : current.incomeCategories,
            categoryIcons: {
              ...current.categoryIcons,
              ...(cloud?.categoryIcons ?? {}),
            },
            accounts: mergeById(cloud?.accounts, current.accounts),
            budgets: mergeById(cloud?.budgets, current.budgets),
            goals: mergeById(cloud?.goals, current.goals),
            cards: mergeById(cloud?.cards, current.cards),
            smsDetections: reconcileDetections(
              mergeById(cloud?.smsDetections, current.smsDetections),
              mergedTransactions,
            ).slice(0, 80),
            settings: {
              ...current.settings,
              ...(cloud?.settings ?? {}),
            },
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('unknown');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncPausedRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGenRef = useRef(0);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const markSynced = useCallback((at: number) => {
    setSyncStatus('synced');
    setSyncError(null);
    setLastSyncedAt(at);
  }, []);

  const markSyncError = useCallback((error: unknown) => {
    setSyncStatus('error');
    setSyncError(syncErrorMessage(error));
  }, []);

  const persistCloud = useCallback(async (uid: string) => {
    await saveCloudSnapshot(uid, extractSnapshot());
    await syncCloudTransactions(uid, useFinanceStore.getState().transactions);
  }, []);

  const checkAndSync = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) {
      setSyncStatus('error');
      setSyncError('Inicia sesión para sincronizar tus finanzas.');
      return;
    }
    if (!firebaseDb) {
      setSyncStatus('error');
      setSyncError('La nube no está configurada en esta compilación.');
      return;
    }

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    const startGen = syncGenRef.current;
    syncPausedRef.current = true;
    setSyncStatus('checking');
    setSyncError(null);
    try {
      await waitForLocalHydration();
      const record = await loadCloudRecord(currentUser.uid);
      const remoteTransactions = await loadCloudTransactions(currentUser.uid);
      cacheCloudTransactions(currentUser.uid, remoteTransactions);
      const cloudTransactions = mergeById(remoteTransactions, legacyTransactions(record?.snapshot ?? null));
      const localTransactions = useFinanceStore.getState().transactions;
      const legacyEmbedded = Array.isArray(record?.snapshot?.transactions);
      if (
        record?.snapshot &&
        !legacyEmbedded &&
        snapshotsMatch(record.snapshot, extractSnapshot()) &&
        transactionsMatch(cloudTransactions, localTransactions)
      ) {
        markSynced(record.updatedAtMs ?? Date.now());
        return;
      }
      applyCloudMerge(record?.snapshot ?? null, cloudTransactions);
      await persistCloud(currentUser.uid);
      if (syncGenRef.current === startGen) markSynced(Date.now());
    } catch (error) {
      markSyncError(error);
    } finally {
      syncPausedRef.current = false;
      if (syncGenRef.current !== startGen && userRef.current) {
        const uid = userRef.current.uid;
        const gen = syncGenRef.current;
        setSyncStatus((current) => (current === 'error' ? current : 'out-of-sync'));
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => {
          if (syncPausedRef.current || syncGenRef.current !== gen) return;
          persistCloud(uid)
            .then(() => {
              if (syncGenRef.current !== gen) return;
              markSynced(Date.now());
            })
            .catch((error) => {
              if (syncGenRef.current !== gen) return;
              markSyncError(error);
            });
        }, 900);
      }
    }
  }, [markSyncError, markSynced, persistCloud]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        clearCloudTransactionCache();
        setSyncStatus('unknown');
        setSyncError(null);
        setLastSyncedAt(null);
        setLoading(false);
        return;
      }

      syncPausedRef.current = true;
      setSyncStatus('checking');
      setSyncError(null);
      try {
        await waitForLocalHydration();
        const record = await loadCloudRecord(nextUser.uid);
        const remoteTransactions = await loadCloudTransactions(nextUser.uid);
        cacheCloudTransactions(nextUser.uid, remoteTransactions);
        const cloudTransactions = mergeById(remoteTransactions, legacyTransactions(record?.snapshot ?? null));
        if (record?.snapshot || cloudTransactions.length > 0) {
          applyCloudMerge(record?.snapshot ?? null, cloudTransactions);
        }
        await persistCloud(nextUser.uid);
        markSynced(Date.now());
      } catch (error) {
        markSyncError(error);
      } finally {
        syncPausedRef.current = false;
        setLoading(false);
      }
    });

    return () => unsub();
  }, [markSyncError, markSynced, persistCloud]);

  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const unsub = useFinanceStore.subscribe(() => {
      syncGenRef.current += 1;
      if (syncPausedRef.current) return;
      const gen = syncGenRef.current;
      setSyncStatus('out-of-sync');
      setSyncError(null);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        if (syncPausedRef.current || syncGenRef.current !== gen) return;
        persistCloud(user.uid)
          .then(() => {
            if (syncGenRef.current !== gen) return;
            markSynced(Date.now());
          })
          .catch((error) => {
            if (syncGenRef.current !== gen) return;
            markSyncError(error);
          });
      }, 900);
    });
    return () => {
      unsub();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [markSyncError, markSynced, persistCloud, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isConfigured: isFirebaseConfigured,
      syncStatus,
      syncError,
      lastSyncedAt,
      checkAndSync,
      signInEmail: async (email, password) => {
        if (!firebaseAuth) throw new Error('auth/not-configured');
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      },
      signUpEmail: async (email, password) => {
        if (!firebaseAuth) throw new Error('auth/not-configured');
        await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      },
      signOutCurrent: async () => {
        if (!firebaseAuth) return;
        await signOut(firebaseAuth);
      },
    }),
    [checkAndSync, lastSyncedAt, loading, syncError, syncStatus, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
