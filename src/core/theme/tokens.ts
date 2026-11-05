export interface Theme {
  background: string;
  surface: string;
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
}

export const lightTheme: Theme = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#2563EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  border: '#E2E8F0',
};

export const darkTheme: Theme = {
  background: '#020617',
  surface: '#0B1220',
  card: '#111827',
  text: '#E2E8F0',
  textMuted: '#94A3B8',
  primary: '#60A5FA',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  border: '#1E293B',
};

/**
 * Pasos de tinta y neutros para distinguir series, cuentas y tarjetas.
 * No incluye verde, ámbar ni rojo: esos colores nombran el estado del dinero.
 */
export const inkSeries = [
  '#1E3A8A',
  '#1D4ED8',
  '#2563EB',
  '#3B82F6',
  '#0369A1',
  '#0284C7',
  '#334155',
  '#64748B',
] as const;
