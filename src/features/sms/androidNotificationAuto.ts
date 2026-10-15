import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';
import { NotificationRawInput } from '../../domain/notificationParser';

interface NativeNotificationPayload {
  id?: string;
  key?: string;
  packageName?: string;
  title?: string;
  text?: string;
  postedAt?: number;
}

interface NotificationBridgeModule {
  isAccessEnabled: () => Promise<boolean>;
  openAccessSettings: () => Promise<boolean>;
  getRecentNotifications: (params?: {
    sinceTimestamp?: number;
    limit?: number;
  }) => Promise<NativeNotificationPayload[]>;
  clearBuffer: () => Promise<boolean>;
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
