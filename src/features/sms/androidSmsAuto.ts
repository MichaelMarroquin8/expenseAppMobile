import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { DEFAULT_BANK_SMS_SHORT_CODES } from '../../domain/bankSources';
import { SmsRawInput } from '../../domain/smsParser';
import { resolveNativeModule } from './nativeModule';

interface NativeSmsMessage {
  id?: string;
  address?: string;
  body?: string;
  date?: number;
}

export interface SmsBridgeStatus {
  readPermission: boolean;
  receivePermission: boolean;
  bufferSize: number;
  watchedShortCodesCount: number;
  debugEnabled: boolean;
  backgroundSyncEnabled: boolean;
  lastCapturedAt: number | null;
  lastBackgroundSyncAt: number | null;
}

interface BancolombiaSmsBridgeModule {
  listRecentBySenders: (params: {
    senders: string[];
    sinceTimestamp?: number;
    limit?: number;
  }) => Promise<NativeSmsMessage[]>;
  clearBuffer?: () => Promise<boolean>;
  markConsumed?: (params: { ids: string[] }) => Promise<boolean>;
  setWatchedShortCodes?: (params: { shortCodes: string[] }) => Promise<boolean>;
  getWatchedShortCodes?: () => Promise<string[]>;
  getBridgeStatus?: () => Promise<SmsBridgeStatus>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

const NATIVE_MODULE =
  typeof resolveNativeModule === 'function'
    ? resolveNativeModule<BancolombiaSmsBridgeModule>('BancolombiaSmsBridge')
    : undefined;

export { DEFAULT_BANK_SMS_SHORT_CODES };

export const isAndroidSmsAutoAvailable = (): boolean =>
  Platform.OS === 'android' && Boolean(NATIVE_MODULE?.listRecentBySenders);

const mapNative = (msg: NativeSmsMessage): SmsRawInput | null => {
  if (!msg.body) return null;
  return {
    id: msg.id,
    channel: 'sms',
    sender: msg.address,
    message: msg.body,
    receivedAt: typeof msg.date === 'number' && msg.date > 0 ? msg.date : undefined,
  };
};

export const requestAndroidSmsPermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return false;
  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
  ]);
  return (
    results[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
    results[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED
  );
};

export const syncNativeSmsShortCodes = async (shortCodes: string[]): Promise<void> => {
  if (!isAndroidSmsAutoAvailable() || !NATIVE_MODULE?.setWatchedShortCodes) return;
  const codes = shortCodes.length > 0 ? shortCodes : [...DEFAULT_BANK_SMS_SHORT_CODES];
  await NATIVE_MODULE.setWatchedShortCodes({ shortCodes: codes });
};

export const fetchRecentBancolombiaSms = async (params: {
  shortCodes?: string[];
  sinceTimestamp?: number;
  limit?: number;
}): Promise<SmsRawInput[]> => {
  if (!isAndroidSmsAutoAvailable()) return [];
  const messages = await NATIVE_MODULE!.listRecentBySenders({
    senders: params.shortCodes?.length ? params.shortCodes : [...DEFAULT_BANK_SMS_SHORT_CODES],
    sinceTimestamp: params.sinceTimestamp,
    limit: params.limit ?? 50,
  });

  return messages.map(mapNative).filter((item): item is SmsRawInput => Boolean(item));
};

export const markSmsConsumed = async (ids: string[]): Promise<void> => {
  if (!isAndroidSmsAutoAvailable() || !NATIVE_MODULE?.markConsumed || ids.length === 0) return;
  await NATIVE_MODULE.markConsumed({ ids });
};

export const clearSmsBuffer = async (): Promise<void> => {
  if (!isAndroidSmsAutoAvailable() || !NATIVE_MODULE?.clearBuffer) return;
  await NATIVE_MODULE.clearBuffer();
};

export const fetchSmsBridgeStatus = async (): Promise<SmsBridgeStatus | null> => {
  if (!isAndroidSmsAutoAvailable() || !NATIVE_MODULE?.getBridgeStatus) return null;
  const status = await NATIVE_MODULE.getBridgeStatus();
  return {
    ...status,
    lastCapturedAt: status.lastCapturedAt ?? null,
    lastBackgroundSyncAt: status.lastBackgroundSyncAt ?? null,
  };
};

export const subscribeBankSms = (
  onSms: (item: SmsRawInput) => void,
): (() => void) => {
  if (!isAndroidSmsAutoAvailable() || !NATIVE_MODULE) {
    return () => undefined;
  }

  const handler = (payload: NativeSmsMessage) => {
    const mapped = mapNative(payload);
    if (mapped) onSms(mapped);
  };

  let subscription: EmitterSubscription;
  try {
    const emitter = new NativeEventEmitter(NATIVE_MODULE as never);
    subscription = emitter.addListener('BankSmsCaptured', handler);
  } catch {
    subscription = DeviceEventEmitter.addListener('BankSmsCaptured', handler);
  }

  return () => subscription.remove();
};
