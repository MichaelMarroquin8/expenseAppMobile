import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { SmsRawInput } from '../../domain/smsParser';

interface NativeSmsMessage {
  id?: string;
  address?: string;
  body?: string;
  date?: number;
}

interface BancolombiaSmsBridgeModule {
  listRecentBySenders: (params: {
    senders: string[];
    sinceTimestamp?: number;
    limit?: number;
  }) => Promise<NativeSmsMessage[]>;
}

const NATIVE_MODULE = NativeModules.BancolombiaSmsBridge as BancolombiaSmsBridgeModule | undefined;

export const isAndroidSmsAutoAvailable = (): boolean =>
  Platform.OS === 'android' && Boolean(NATIVE_MODULE?.listRecentBySenders);

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

export const fetchRecentBancolombiaSms = async (params: {
  shortCodes: string[];
  sinceTimestamp?: number;
  limit?: number;
}): Promise<SmsRawInput[]> => {
  if (!isAndroidSmsAutoAvailable()) return [];
  const messages = await NATIVE_MODULE!.listRecentBySenders({
    senders: params.shortCodes,
    sinceTimestamp: params.sinceTimestamp,
    limit: params.limit ?? 50,
  });

  return messages
    .filter((msg) => Boolean(msg.body))
    .map((msg) => ({
      channel: 'sms',
      sender: msg.address,
      message: msg.body ?? '',
    }));
};
