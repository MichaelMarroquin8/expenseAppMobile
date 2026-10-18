/**
 * Fuentes bancarias / billetera conocidas (Colombia).
 * Mantener alineado con WalletNotificationListenerService.kt y BankSmsReceiver.kt.
 */

export interface BankSourcePreset {
  id: string;
  label: string;
  packages: string[];
  shortCodes: string[];
}

export const BANK_SOURCE_PRESETS: BankSourcePreset[] = [
  {
    id: 'wallet',
    label: 'Google Wallet / Pay',
    packages: [
      'com.google.android.apps.walletnfcrel',
      'com.google.android.gms',
      'com.google.android.apps.nbu.paisa.user',
    ],
    shortCodes: [],
  },
  {
    id: 'bancolombia',
    label: 'Bancolombia',
    packages: ['com.bancolombia.bancolombia'],
    shortCodes: ['85540', '85784'],
  },
  {
    id: 'nu',
    label: 'Nu',
    packages: ['com.nu.production'],
    shortCodes: ['NU'],
  },
  {
    id: 'nequi',
    label: 'Nequi',
    packages: ['com.nequi.MobileApp'],
    shortCodes: ['NEQUI', '4455637'],
  },
  {
    id: 'bbva',
    label: 'BBVA',
    packages: ['com.bbva.bbvacontigo'],
    shortCodes: ['BBVA'],
  },
  {
    id: 'daviplata',
    label: 'Daviplata',
    packages: ['com.davivienda.daviplata'],
    shortCodes: ['DAVIPLATA'],
  },
];

export const DEFAULT_NOTIFICATION_PACKAGES: string[] = [
  ...new Set(BANK_SOURCE_PRESETS.flatMap((p) => p.packages)),
];

export const DEFAULT_BANK_SMS_SHORT_CODES: string[] = [
  ...new Set(BANK_SOURCE_PRESETS.flatMap((p) => p.shortCodes)),
];

export const DEFAULT_ENABLED_BANK_SOURCE_IDS: string[] = BANK_SOURCE_PRESETS.map((p) => p.id);

export const resolveBankSources = (
  enabledIds?: string[],
): { packages: string[]; shortCodes: string[]; enabledIds: string[] } => {
  const ids =
    Array.isArray(enabledIds) && enabledIds.length > 0
      ? enabledIds
      : DEFAULT_ENABLED_BANK_SOURCE_IDS;
  const idSet = new Set(ids);
  const selected = BANK_SOURCE_PRESETS.filter((p) => idSet.has(p.id));
  return {
    enabledIds: ids,
    packages: [...new Set(selected.flatMap((p) => p.packages))],
    shortCodes: [...new Set(selected.flatMap((p) => p.shortCodes))],
  };
};

export const packageDisplayName = (packageName: string): string => {
  const preset = BANK_SOURCE_PRESETS.find((p) => p.packages.includes(packageName));
  if (preset) return preset.label;
  if (packageName.includes('wallet') || packageName.includes('gms')) return 'Google Wallet';
  return packageName;
};
