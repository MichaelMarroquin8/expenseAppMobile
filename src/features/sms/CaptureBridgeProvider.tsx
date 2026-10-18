import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useFinanceStore } from "../../store/useFinanceStore";
import {
  fetchRecentWalletNotifications,
  fetchNotificationBridgeStatus,
  isAndroidNotificationAutoAvailable,
  isNotificationAccessEnabled,
  markNotificationsConsumed,
  NotificationBridgeStatus,
  openNotificationAccessSettings,
  setNativeBackgroundSyncEnabled,
  setNativeBridgeDebugEnabled,
  subscribeWalletNotifications,
  syncNativeNotificationPackages,
} from "./androidNotificationAuto";
import {
  fetchRecentBancolombiaSms,
  fetchSmsBridgeStatus,
  isAndroidSmsAutoAvailable,
  markSmsConsumed,
  requestAndroidSmsPermissions,
  SmsBridgeStatus,
  subscribeBankSms,
  syncNativeSmsShortCodes,
} from "./androidSmsAuto";

interface CaptureBridgeValue {
  notifAvailable: boolean;
  smsAvailable: boolean;
  walletAccess: boolean;
  walletListening: boolean;
  walletSyncing: boolean;
  walletError: string | null;
  walletLastSync: string | null;
  notifStatus: NotificationBridgeStatus | null;
  smsEnabled: boolean;
  smsSyncing: boolean;
  smsError: string | null;
  smsLastSync: string | null;
  smsStatus: SmsBridgeStatus | null;
  enableWalletAuto: () => Promise<void>;
  runWalletSync: () => Promise<void>;
  enableSmsAuto: () => Promise<void>;
  runSmsSync: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const CaptureBridgeContext = createContext<CaptureBridgeValue | null>(null);

export function CaptureBridgeProvider({ children }: { children: React.ReactNode }) {
  const bankSmsShortCodes = useFinanceStore((state) => state.settings.bankSmsShortCodes);
  const notificationPackages = useFinanceStore((state) => state.settings.notificationPackages);
  const bridgeDebugEnabled = useFinanceStore((state) => state.settings.bridgeDebugEnabled);
  const backgroundSyncEnabled = useFinanceStore((state) => state.settings.backgroundSyncEnabled);
  const processSmsBatch = useFinanceStore((state) => state.processSmsBatch);
  const processNotificationBatch = useFinanceStore((state) => state.processNotificationBatch);

  const [walletAccess, setWalletAccess] = useState(false);
  const [walletListening, setWalletListening] = useState(false);
  const [walletSyncing, setWalletSyncing] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLastSync, setWalletLastSync] = useState<string | null>(null);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [smsSyncing, setSmsSyncing] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsLastSync, setSmsLastSync] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<NotificationBridgeStatus | null>(null);
  const [smsStatus, setSmsStatus] = useState<SmsBridgeStatus | null>(null);

  const smsSinceRef = useRef<number | undefined>(undefined);
  const walletSinceRef = useRef<number | undefined>(undefined);

  const notifAvailable = isAndroidNotificationAutoAvailable();
  const smsAvailable = isAndroidSmsAutoAvailable();

  const refreshStatus = useCallback(async () => {
    if (!notifAvailable) {
      setWalletAccess(false);
      setNotifStatus(null);
    } else {
      const [enabled, status] = await Promise.all([
        isNotificationAccessEnabled(),
        fetchNotificationBridgeStatus(),
      ]);
      setWalletAccess(enabled);
      setNotifStatus(status);
    }

    if (!smsAvailable) {
      setSmsStatus(null);
      return;
    }
    setSmsStatus(await fetchSmsBridgeStatus());
  }, [notifAvailable, smsAvailable]);

  const runWalletSync = useCallback(async () => {
    if (!notifAvailable) return;
    setWalletSyncing(true);
    setWalletError(null);
    try {
      const batch = await fetchRecentWalletNotifications({
        sinceTimestamp: walletSinceRef.current,
        limit: 40,
      });
      if (batch.length > 0) {
        processNotificationBatch(batch);
        const ids = batch.map((item) => item.id).filter((id): id is string => Boolean(id));
        await markNotificationsConsumed(ids);
        const newest = batch.reduce((max, item) => {
          const ts = item.postedAt ?? 0;
          return ts > max ? ts : max;
        }, walletSinceRef.current ?? 0);
        if (newest > 0) walletSinceRef.current = newest + 1;
      }
      setWalletLastSync(new Date().toLocaleTimeString("es-CO"));
    } catch {
      setWalletError("No se pudieron leer las notificaciones. Revisa el permiso.");
    } finally {
      setWalletSyncing(false);
    }
  }, [notifAvailable, processNotificationBatch]);

  const runSmsSync = useCallback(async () => {
    if (!smsAvailable) return;
    setSmsSyncing(true);
    setSmsError(null);
    try {
      const batch = await fetchRecentBancolombiaSms({
        shortCodes: bankSmsShortCodes,
        sinceTimestamp: smsSinceRef.current,
        limit: 20,
      });
      if (batch.length > 0) {
        processSmsBatch(batch);
        const ids = batch.map((item) => item.id).filter((id): id is string => Boolean(id));
        await markSmsConsumed(ids);
        const newest = batch.reduce((max, item) => {
          const ts = item.receivedAt ?? 0;
          return ts > max ? ts : max;
        }, smsSinceRef.current ?? 0);
        if (newest > 0) smsSinceRef.current = newest + 1;
      }
      setSmsLastSync(new Date().toLocaleTimeString("es-CO"));
    } catch {
      setSmsError("No fue posible leer los SMS. Revisa el permiso.");
    } finally {
      setSmsSyncing(false);
    }
  }, [smsAvailable, processSmsBatch, bankSmsShortCodes]);

  const enableWalletAuto = useCallback(async () => {
    setWalletError(null);
    if (!notifAvailable) {
      setWalletError("Hace falta un build Android con el módulo de notificaciones.");
      return;
    }
    const enabled = await isNotificationAccessEnabled();
    if (!enabled) {
      setWalletError("Activa ExpenseApp en el acceso a notificaciones y vuelve a la app.");
      await openNotificationAccessSettings();
      return;
    }
    setWalletAccess(true);
    setWalletListening(true);
    await runWalletSync();
  }, [notifAvailable, runWalletSync]);

  const enableSmsAuto = useCallback(async () => {
    setSmsError(null);
    if (!smsAvailable) {
      setSmsError("Hace falta un build Android con el módulo de SMS.");
      return;
    }
    const granted = await requestAndroidSmsPermissions();
    if (!granted) {
      setSmsError("Permiso de SMS denegado.");
      return;
    }
    setSmsEnabled(true);
    await runSmsSync();
  }, [smsAvailable, runSmsSync]);

  useEffect(() => {
    void syncNativeSmsShortCodes(bankSmsShortCodes);
    void syncNativeNotificationPackages(notificationPackages);
  }, [bankSmsShortCodes, notificationPackages]);

  useEffect(() => {
    void setNativeBridgeDebugEnabled(bridgeDebugEnabled);
    void setNativeBackgroundSyncEnabled(backgroundSyncEnabled);
    void refreshStatus();
  }, [bridgeDebugEnabled, backgroundSyncEnabled, refreshStatus]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshStatus();
    });
    return () => sub.remove();
  }, [refreshStatus]);

  useEffect(() => {
    if (!walletListening || !notifAvailable || !walletAccess) return;
    const unsubscribe = subscribeWalletNotifications((item) => {
      processNotificationBatch([item]);
      if (item.id) void markNotificationsConsumed([item.id]);
      if (typeof item.postedAt === "number" && item.postedAt > 0) {
        walletSinceRef.current = Math.max(walletSinceRef.current ?? 0, item.postedAt + 1);
      }
      setWalletLastSync(new Date().toLocaleTimeString("es-CO"));
    });
    const timer = setInterval(() => {
      void runWalletSync();
    }, 60000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [walletListening, notifAvailable, walletAccess, processNotificationBatch, runWalletSync]);

  useEffect(() => {
    if (!smsEnabled || !smsAvailable) return;
    const unsubscribe = subscribeBankSms((item) => {
      processSmsBatch([item]);
      if (item.id) void markSmsConsumed([item.id]);
      if (typeof item.receivedAt === "number" && item.receivedAt > 0) {
        smsSinceRef.current = Math.max(smsSinceRef.current ?? 0, item.receivedAt + 1);
      }
      setSmsLastSync(new Date().toLocaleTimeString("es-CO"));
    });
    const timer = setInterval(() => {
      void runSmsSync();
    }, 60000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [smsEnabled, smsAvailable, processSmsBatch, runSmsSync]);

  const value = useMemo<CaptureBridgeValue>(
    () => ({
      notifAvailable,
      smsAvailable,
      walletAccess,
      walletListening,
      walletSyncing,
      walletError,
      walletLastSync,
      notifStatus,
      smsEnabled,
      smsSyncing,
      smsError,
      smsLastSync,
      smsStatus,
      enableWalletAuto,
      runWalletSync,
      enableSmsAuto,
      runSmsSync,
      refreshStatus,
    }),
    [
      notifAvailable,
      smsAvailable,
      walletAccess,
      walletListening,
      walletSyncing,
      walletError,
      walletLastSync,
      notifStatus,
      smsEnabled,
      smsSyncing,
      smsError,
      smsLastSync,
      smsStatus,
      enableWalletAuto,
      runWalletSync,
      enableSmsAuto,
      runSmsSync,
      refreshStatus,
    ],
  );

  return <CaptureBridgeContext.Provider value={value}>{children}</CaptureBridgeContext.Provider>;
}

export function useCaptureBridge() {
  const value = useContext(CaptureBridgeContext);
  if (!value) {
    throw new Error("useCaptureBridge debe usarse dentro de CaptureBridgeProvider");
  }
  return value;
}
