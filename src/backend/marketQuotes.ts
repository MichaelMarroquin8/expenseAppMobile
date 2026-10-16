export type MarketQuote = {
  symbol: string;
  price: number;
  currency: string;
  asOf: string;
};

type QuoteCacheEntry = {
  quote: MarketQuote;
  fetchedAt: number;
};

const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map<string, QuoteCacheEntry>();
const inflight = new Map<string, Promise<MarketQuote>>();

const normalizeSymbol = (symbol: string): string => symbol.trim().toUpperCase();

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        regularMarketTime?: number;
      };
    }>;
    error?: { description?: string } | null;
  };
};

const fetchQuoteFromYahoo = async (symbol: string): Promise<MarketQuote> => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ExpenseApp/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`No se pudo obtener el precio de ${symbol} (${response.status})`);
  }
  const data = (await response.json()) as YahooChartResponse;
  if (data.chart?.error) {
    throw new Error(data.chart.error.description ?? `Símbolo no encontrado: ${symbol}`);
  }
  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? meta?.previousClose;
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
    throw new Error(`Precio inválido para ${symbol}`);
  }
  const asOf =
    typeof meta?.regularMarketTime === 'number'
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString();
  return {
    symbol: meta?.symbol ?? symbol,
    price,
    currency: (meta?.currency ?? 'USD').toUpperCase(),
    asOf,
  };
};

export const fetchQuote = async (rawSymbol: string): Promise<MarketQuote> => {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) {
    throw new Error('Símbolo vacío');
  }

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.quote;
  }

  const existing = inflight.get(symbol);
  if (existing) return existing;

  const promise = fetchQuoteFromYahoo(symbol)
    .then((quote) => {
      cache.set(symbol, { quote, fetchedAt: Date.now() });
      return quote;
    })
    .finally(() => {
      inflight.delete(symbol);
    });

  inflight.set(symbol, promise);
  return promise;
};

export type QuoteBatchResult = {
  ok: MarketQuote[];
  failed: Array<{ symbol: string; error: string }>;
};

export const fetchQuotes = async (symbols: string[]): Promise<QuoteBatchResult> => {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  const settled = await Promise.allSettled(unique.map((symbol) => fetchQuote(symbol)));
  const ok: MarketQuote[] = [];
  const failed: QuoteBatchResult['failed'] = [];
  settled.forEach((result, index) => {
    const symbol = unique[index];
    if (result.status === 'fulfilled') {
      ok.push(result.value);
    } else {
      failed.push({
        symbol,
        error: result.reason instanceof Error ? result.reason.message : 'Error desconocido',
      });
    }
  });
  return { ok, failed };
};
