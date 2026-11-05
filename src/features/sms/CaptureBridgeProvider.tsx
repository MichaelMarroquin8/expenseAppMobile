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
  hasAndroidSmsPermissions,
  isAndroidSmsAutoAvailable,
  markSmsConsumed,
  requestAndroidSmsPermissions,
  SmsBridgeStatus,
  subscribeBankSms,
  syncNativeSmsShortCodes,
} from "./androidSmsAuto";
import {
  areCapturePromptsEnabled,
  buildCapturePrompt,
  dismissCapturePrompts,
  drainAndApplyCapturePrompts,
  isAndroidCapturePromptAvailable,
  isPromptableDetection,
  isRecentCaptureDetection,
  requestCapturePromptPermission,
  showCapturePrompt,
  subscribeCapturePromptActions,
  type CapturePromptAction,
} from "./androidCapturePrompt";

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
  const currency = useFinanceStore((state) => state.settings.currency);
  const smsDetections = useFinanceStore((state) => state.smsDetections);

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
  const promptBaselineRef = useRef<Set<string> | null>(null);
  const promptedIdsRef = useRef<Set<string>>(new Set());
  const promptingIdsRef = useRef<Set<string>>(new Set());
  const promptPermissionAskedRef = useRef(false);
  const [promptTick, setPromptTick] = useState(0);
  const [settingsReady, setSettingsReady] = useState(() => useFinanceStore.persist.hasHydrated());

  const notifAvailable = isAndroidNotificationAutoAvailable();
  const smsAvailable = isAndroidSmsAutoAvailable();

  useEffect(() => {
    if (useFinanceStore.persist.hasHydrated()) {
      setSettingsReady(true);
      return;
    }
    return useFinanceStore.persist.onFinishHydration(() => {
      setSettingsReady(true);
    });
  }, []);

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
    void requestCapturePromptPermission();
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
    void requestCapturePromptPermission();
    await runSmsSync();
  }, [smsAvailable, runSmsSync]);

  const resumeGrantedCapture = useCallback(async () => {
    try {
      const settings = useFinanceStore.getState().settings;
      await Promise.all([
        syncNativeNotificationPackages(settings.notificationPackages),
        syncNativeSmsShortCodes(settings.bankSmsShortCodes),
      ]);
    } catch {
      // Si el puente nativo no responde, igual se intenta leer con la lista anterior.
    }

    let captureOn = false;

    if (notifAvailable) {
      try {
        const enabled = await isNotificationAccessEnabled();
        setWalletAccess(enabled);
        if (enabled) {
          captureOn = true;
          setWalletError(null);
          setWalletListening(true);
          await runWalletSync();
        } else {
          setWalletListening(false);
        }
      } catch {
        setWalletError("No se pudo comprobar el acceso a notificaciones.");
      }
    }

    if (smsAvailable) {
      try {
        const granted = await hasAndroidSmsPermissions();
        if (granted) {
          captureOn = true;
          setSmsError(null);
          setSmsEnabled(true);
          await runSmsSync();
        } else {
          setSmsEnabled(false);
        }
      } catch {
        setSmsError("No se pudo comprobar el permiso de SMS.");
      }
    }

    if (
      captureOn &&
      isAndroidCapturePromptAvailable() &&
      AppState.currentState === "active" &&
      !promptPermissionAskedRef.current
    ) {
      promptPermissionAskedRef.current = true;
      void requestCapturePromptPermission().finally(() => {
        setPromptTick((tick) => tick + 1);
      });
    }

    await refreshStatus();
  }, [notifAvailable, smsAvailable, refreshStatus, runSmsSync, runWalletSync]);

  const resumeRef = useRef(resumeGrantedCapture);
  resumeRef.current = resumeGrantedCapture;

  useEffect(() => {
    if (!settingsReady) return;
    void syncNativeSmsShortCodes(bankSmsShortCodes);
    void syncNativeNotificationPackages(notificationPackages);
  }, [settingsReady, bankSmsShortCodes, notificationPackages]);

  useEffect(() => {
    if (!settingsReady) return;
    void setNativeBridgeDebugEnabled(bridgeDebugEnabled);
    void setNativeBackgroundSyncEnabled(backgroundSyncEnabled);
  }, [settingsReady, bridgeDebugEnabled, backgroundSyncEnabled]);

  useEffect(() => {
    if (!settingsReady) return;
    void resumeRef.current();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void resumeRef.current();
    });
    return () => sub.remove();
  }, [settingsReady, notifAvailable, smsAvailable]);

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

  const applyPromptAction = useCallback((action: CapturePromptAction) => {
    const state = useFinanceStore.getState();
    const detection = state.smsDetections.find((item) => item.id === action.id);
    if (!detection || detection.status !== "pending" || detection.duplicate) return;
    if (!detection.amount || detection.amount <= 0) return;
    if (action.action === "accept") state.acceptSms(detection.id);
    else state.discardSms(detection.id);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setPromptTick((tick) => tick + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!settingsReady || !isAndroidCapturePromptAvailable()) return;
    const apply = () => drainAndApplyCapturePrompts(applyPromptAction);
    void apply();
    const unsubscribe = subscribeCapturePromptActions(() => {
      void apply();
    });
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void apply();
    });
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [settingsReady, applyPromptAction]);

  useEffect(() => {
    if (!settingsReady || !isAndroidCapturePromptAvailable()) return;
    if (promptBaselineRef.current === null) {
      promptBaselineRef.current = new Set(smsDetections.map((item) => item.id));
      return;
    }

    const baseline = promptBaselineRef.current;
    const pendingIds = new Set(
      smsDetections.filter((item) => item.status === "pending").map((item) => item.id),
    );
    const stale = [...promptedIdsRef.current].filter((id) => !pendingIds.has(id));
    if (stale.length > 0) {
      stale.forEach((id) => promptedIdsRef.current.delete(id));
      void dismissCapturePrompts(stale);
    }

    const fresh = smsDetections.filter((item) => {
      if (baseline.has(item.id) || promptedIdsRef.current.has(item.id) || promptingIdsRef.current.has(item.id)) {
        return false;
      }
      if (!isPromptableDetection(item) || !isRecentCaptureDetection(item)) {
        baseline.add(item.id);
        return false;
      }
      return true;
    });
    if (fresh.length === 0) return;

    let cancelled = false;
    void (async () => {
      let allowed = await areCapturePromptsEnabled();
      if (!allowed) {
        if (cancelled || AppState.currentState !== "active" || promptPermissionAskedRef.current) return;
        promptPermissionAskedRef.current = true;
        allowed = await requestCapturePromptPermission();
      }
      if (!allowed || cancelled) return;
      for (const detection of fresh) {
        if (cancelled) return;
        const prompt = buildCapturePrompt(detection, currency);
        if (!prompt) {
          baseline.add(detection.id);
          continue;
        }
        promptingIdsRef.current.add(detection.id);
        try {
          const posted = await showCapturePrompt(prompt);
          if (posted) promptedIdsRef.current.add(detection.id);
        } finally {
          promptingIdsRef.current.delete(detection.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settingsReady, smsDetections, currency, promptTick]);

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
