import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import { DEFAULT_NOTIFICATION_PACKAGES } from '../../domain/bankSources';
import { NotificationRawInput } from '../../domain/notificationParser';

interface NativeNotificationPayload {
  id?: string;
  key?: string;
  packageName?: string;
  title?: string;
  text?: string;
  postedAt?: number;
}

export interface NotificationRejection {
  at: number;
  packageName?: string;
  title?: string;
  text?: string;
  score?: number;
  reasons?: string[];
}

export interface NotificationBridgeStatus {
  accessEnabled: boolean;
  bufferSize: number;
  watchedPackagesCount: number;
  debugEnabled: boolean;
  backgroundSyncEnabled: boolean;
  minPaymentScore: number;
  lastCapturedAt: number | null;
  lastBackgroundSyncAt: number | null;
  rejections: NotificationRejection[];
}

interface NotificationBridgeModule {
  isAccessEnabled: () => Promise<boolean>;
  openAccessSettings: () => Promise<boolean>;
  getRecentNotifications: (params?: {
    sinceTimestamp?: number;
    limit?: number;
  }) => Promise<NativeNotificationPayload[]>;
  clearBuffer: () => Promise<boolean>;
  markConsumed?: (params: { ids: string[] }) => Promise<boolean>;
  setWatchedPackages?: (params: { packages: string[] }) => Promise<boolean>;
  setDebugEnabled?: (enabled: boolean) => Promise<boolean>;
  setBackgroundSyncEnabled?: (enabled: boolean) => Promise<boolean>;
  getBridgeStatus?: () => Promise<NotificationBridgeStatus>;
  clearRejectionLog?: () => Promise<boolean>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

const NATIVE_MODULE = NativeModules.NotificationBridge as NotificationBridgeModule | undefined;

export const isAndroidNotificationAutoAvailable = (): boolean =>
  Platform.OS === 'android' && Boolean(NATIVE_MODULE?.getRecentNotifications);

export const isNotificationAccessEnabled = async (): Promise<boolean> => {
  if (!isAndroidNotificationAutoAvailable()) return false;
  return NATIVE_MODULE!.isAccessEnabled();
};

export const openNotificationAccessSettings = async (): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable()) return;
  await NATIVE_MODULE!.openAccessSettings();
};

const mapNative = (item: NativeNotificationPayload): NotificationRawInput | null => {
  if (!item.packageName) return null;
  return {
    id: item.id,
    packageName: item.packageName,
    title: item.title,
    text: item.text,
    postedAt: item.postedAt,
  };
};

export const fetchRecentWalletNotifications = async (params?: {
  sinceTimestamp?: number;
  limit?: number;
}): Promise<NotificationRawInput[]> => {
  if (!isAndroidNotificationAutoAvailable()) return [];
  const rows = await NATIVE_MODULE!.getRecentNotifications({
    sinceTimestamp: params?.sinceTimestamp,
    limit: params?.limit ?? 40,
  });
  return rows.map(mapNative).filter((item): item is NotificationRawInput => Boolean(item));
};

export const subscribeWalletNotifications = (
  onNotification: (item: NotificationRawInput) => void,
): (() => void) => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE) {
    return () => undefined;
  }

  const handler = (payload: NativeNotificationPayload) => {
    const mapped = mapNative(payload);
    if (mapped) onNotification(mapped);
  };

  let subscription: EmitterSubscription;
  try {
    const emitter = new NativeEventEmitter(NATIVE_MODULE as never);
    subscription = emitter.addListener('WalletNotificationCaptured', handler);
  } catch {
    subscription = DeviceEventEmitter.addListener('WalletNotificationCaptured', handler);
  }

  return () => subscription.remove();
};

export const syncNativeNotificationPackages = async (packages: string[]): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.setWatchedPackages) return;
  const watched = packages.length > 0 ? packages : [...DEFAULT_NOTIFICATION_PACKAGES];
  await NATIVE_MODULE.setWatchedPackages({ packages: watched });
};

export const markNotificationsConsumed = async (ids: string[]): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.markConsumed || ids.length === 0) return;
  await NATIVE_MODULE.markConsumed({ ids });
};

export const setNativeBridgeDebugEnabled = async (enabled: boolean): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.setDebugEnabled) return;
  await NATIVE_MODULE.setDebugEnabled(enabled);
};

export const setNativeBackgroundSyncEnabled = async (enabled: boolean): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.setBackgroundSyncEnabled) return;
  await NATIVE_MODULE.setBackgroundSyncEnabled(enabled);
};

export const fetchNotificationBridgeStatus = async (): Promise<NotificationBridgeStatus | null> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.getBridgeStatus) return null;
  const status = await NATIVE_MODULE.getBridgeStatus();
  return {
    ...status,
    lastCapturedAt: status.lastCapturedAt ?? null,
    lastBackgroundSyncAt: status.lastBackgroundSyncAt ?? null,
    rejections: Array.isArray(status.rejections) ? status.rejections : [],
  };
};

export const clearNativeRejectionLog = async (): Promise<void> => {
  if (!isAndroidNotificationAutoAvailable() || !NATIVE_MODULE?.clearRejectionLog) return;
  await NATIVE_MODULE.clearRejectionLog();
};
