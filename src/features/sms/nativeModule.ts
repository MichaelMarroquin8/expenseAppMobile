import { NativeModules, Platform } from 'react-native';

export function resolveNativeModule<T>(name: string): T | undefined {
  if (Platform.OS !== 'android') return undefined;
  try {
    const native = NativeModules?.[name] as T | undefined;
    return native ?? undefined;
  } catch {
    return undefined;
  }
}
