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

const extractSnapshot = (): FinanceCloudSnapshot => {
  const state = useFinanceStore.getState();
  return {
    onboardingDone: state.onboardingDone,
    transactions: state.transactions,
    transactionCategories: state.transactionCategories,
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
          useFinanceStore.setState(cloud);
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
