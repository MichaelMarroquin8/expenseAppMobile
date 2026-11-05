import {
  DeviceEventEmitter,
  EmitterSubscription,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { SmsDetection } from '../../domain/models';
import { formatMoney } from '../../core/utils/format';
import { resolveNativeModule } from './nativeModule';

const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export interface CapturePromptPayload {
  id: string;
  title: string;
  body: string;
}

export interface CapturePromptAction {
  id: string;
  action: 'accept' | 'reject';
}

interface CapturePromptModule {
  areNotificationsEnabled: () => Promise<boolean>;
  showPrompt: (params: CapturePromptPayload) => Promise<boolean>;
  dismissPrompts: (params: { ids: string[] }) => Promise<boolean>;
  drainActions: () => Promise<Array<{ id?: string; action?: string }>>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

const NATIVE_MODULE = resolveNativeModule<CapturePromptModule>('CapturePromptBridge');

export const isAndroidCapturePromptAvailable = (): boolean =>
  Platform.OS === 'android' && Boolean(NATIVE_MODULE?.showPrompt && NATIVE_MODULE?.drainActions);

export const isPromptableDetection = (detection: SmsDetection): boolean =>
  detection.status === 'pending' &&
  !detection.duplicate &&
  (detection.channel === 'sms' || detection.channel === 'notification') &&
  typeof detection.amount === 'number' &&
  detection.amount > 0;

export const isRecentCaptureDetection = (detection: SmsDetection, now = Date.now()): boolean => {
  if (!detection.occurredAt) return true;
  const ts = Date.parse(detection.occurredAt);
  if (Number.isNaN(ts)) return true;
  return ts <= now + 5 * 60 * 1000 && now - ts <= MAX_AGE_MS;
};

export const buildCapturePrompt = (
  detection: SmsDetection,
  currency: string,
): CapturePromptPayload | null => {
  if (!isPromptableDetection(detection) || !detection.amount) return null;
  const merchant = detection.merchant?.trim();
  const incoming = detection.direction === 'in';
  const title = incoming
    ? merchant
      ? `Ingreso · ${merchant}`
      : 'Ingreso detectado'
    : merchant || 'Gasto detectado';
  const mask = detection.accountLast4
    ? `cuenta •••• ${detection.accountLast4}`
    : detection.last4
      ? `•••• ${detection.last4}`
      : undefined;
  const source = detection.channel === 'notification' ? detection.bank || 'Wallet' : detection.bank || 'SMS';
  const body = [formatMoney(detection.amount, currency), source, mask, detection.categoryGuess]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  return { id: detection.id, title, body };
};

export const areCapturePromptsEnabled = async (): Promise<boolean> => {
  if (!isAndroidCapturePromptAvailable() || !NATIVE_MODULE?.areNotificationsEnabled) return false;
  try {
    return Boolean(await NATIVE_MODULE.areNotificationsEnabled());
  } catch {
    return false;
  }
};

export const requestCapturePromptPermission = async (): Promise<boolean> => {
  if (!isAndroidCapturePromptAvailable()) return false;
  if (await areCapturePromptsEnabled()) return true;
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return false;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
  return areCapturePromptsEnabled();
};

export const showCapturePrompt = async (prompt: CapturePromptPayload): Promise<boolean> => {
  if (!isAndroidCapturePromptAvailable() || !NATIVE_MODULE?.showPrompt) return false;
  try {
    return Boolean(await NATIVE_MODULE.showPrompt(prompt));
  } catch {
    return false;
  }
};

export const dismissCapturePrompts = async (ids: string[]): Promise<void> => {
  if (!isAndroidCapturePromptAvailable() || !NATIVE_MODULE?.dismissPrompts || ids.length === 0) return;
  try {
    await NATIVE_MODULE.dismissPrompts({ ids });
  } catch {
    // Si el aviso ya se cerró, el pendiente sigue en la bandeja.
  }
};

const isAction = (row: { id?: string; action?: string }): CapturePromptAction | null => {
  const id = row.id?.trim() ?? '';
  if (!id || (row.action !== 'accept' && row.action !== 'reject')) return null;
  return { id, action: row.action };
};

export const drainCapturePromptActions = async (): Promise<CapturePromptAction[]> => {
  if (!isAndroidCapturePromptAvailable() || !NATIVE_MODULE?.drainActions) return [];
  try {
    const rows = await NATIVE_MODULE.drainActions();
    return rows.map(isAction).filter((item): item is CapturePromptAction => Boolean(item));
  } catch {
    return [];
  }
};

let drainChain: Promise<void> = Promise.resolve();

export const drainAndApplyCapturePrompts = (
  apply: (action: CapturePromptAction) => void,
): Promise<void> => {
  const run = drainChain.then(async () => {
    const actions = await drainCapturePromptActions();
    for (const action of actions) apply(action);
  });
  drainChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
};

export const subscribeCapturePromptActions = (onAction: () => void): (() => void) => {
  if (!isAndroidCapturePromptAvailable() || !NATIVE_MODULE) return () => undefined;

  let subscription: EmitterSubscription;
  try {
    const emitter = new NativeEventEmitter(NATIVE_MODULE as never);
    subscription = emitter.addListener('CapturePromptAction', onAction);
  } catch {
    subscription = DeviceEventEmitter.addListener('CapturePromptAction', onAction);
  }
  return () => subscription.remove();
};
