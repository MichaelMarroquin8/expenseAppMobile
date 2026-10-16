type RatesCache = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: RatesCache | null = null;
let inflight: Promise<RatesCache> | null = null;

const fetchRatesFromApi = async (base: string): Promise<RatesCache> => {
  const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
  if (!response.ok) {
    throw new Error(`No se pudieron cargar las tasas (${response.status})`);
  }
  const data = (await response.json()) as {
    result?: string;
    base_code?: string;
    rates?: Record<string, number>;
  };
  if (data.result !== 'success' || !data.rates) {
    throw new Error('Respuesta inválida de tasas de cambio');
  }
  return {
    base: data.base_code ?? base,
    rates: { ...data.rates, [base]: 1 },
    fetchedAt: Date.now(),
  };
};

export const getExchangeRates = async (base: string): Promise<Record<string, number>> => {
  const normalizedBase = base.toUpperCase();
  if (cache && cache.base === normalizedBase && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  if (!inflight) {
    inflight = fetchRatesFromApi(normalizedBase)
      .then((result) => {
        cache = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const result = await inflight;
  return result.rates;
};

/**
 * Cuántas unidades de `base` equivalen a 1 unidad de `fromCurrency`.
 * Ej.: base=COP, from=USD → ~3185
 */
export const getUnitsOfBasePerOne = (
  rates: Record<string, number>,
  base: string,
  fromCurrency: string,
): number | null => {
  const from = fromCurrency.toUpperCase();
  const to = base.toUpperCase();
  if (from === to) return 1;
  const quote = rates[from];
  if (!quote || quote <= 0) return null;
  // API con base=`to`: rates[from] = unidades de `from` por 1 `to`
  return 1 / quote;
};

export const convertToBase = (
  amount: number,
  fromCurrency: string,
  base: string,
  rates: Record<string, number>,
): number | null => {
  const rate = getUnitsOfBasePerOne(rates, base, fromCurrency);
  if (rate == null) return null;
  return amount * rate;
};

export const formatExchangeRateLabel = (
  fromCurrency: string,
  base: string,
  unitsOfBasePerOne: number,
): string => {
  const formatted = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  }).format(unitsOfBasePerOne);
  return `${fromCurrency} 1 = ${base} ${formatted}`;
};
