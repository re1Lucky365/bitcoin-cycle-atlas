/** Display units never change the underlying USD prices or manual viewport. */
export const PRICE_UNITS = Object.freeze(['usd', 'indexed', 'percent', 'indexed-start']);
export const isStartPriceUnit = unit => unit === 'percent' || unit === 'indexed-start';
const positive = value => Number.isFinite(value) && value > 0;
const formats = new Map();

export function createPriceDisplay({ unit = 'usd', rows = [], denominator = null, denominatorDate = null, scale = 'log' } = {}) {
  if (!PRICE_UNITS.includes(unit)) throw new RangeError('Unknown price display unit');
  const first = rows.find(row => positive(row.price ?? row.close));
  const start = isStartPriceUnit(unit), basePrice = unit === 'usd' ? null : start ? first?.price ?? first?.close ?? null : denominator;
  const baseDate = unit === 'usd' ? null : start ? first?.date ?? null : denominatorDate;
  const available = unit === 'usd' || positive(basePrice);
  const factor = unit === 'usd' || !available ? 1 : 100 / basePrice, offset = unit === 'percent' ? -100 : 0;
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Price display basis cannot be represented');
  const effectiveScale = start ? 'linear' : scale;
  const label = { usd: '가격 · USD', indexed: '최근 관측 = 100', percent: '표시 시작 대비 %', 'indexed-start': '표시 시작 = 100' }[unit];
  const metadata = { unit, basePrice: positive(basePrice) ? basePrice : null, baseDate, factor, offset, effectiveScale, available, label };
  return { ...metadata, metadata,
    toDisplay: value => available && Number.isFinite(value) ? value * factor + offset : null,
    fromDisplay: value => available && Number.isFinite(value) ? (value - offset) / factor : null,
  };
}

export function formatDisplayPrice(value, display, digits = 2) {
  const shown = display?.toDisplay ? display.toDisplay(value) : display?.available !== false && Number.isFinite(value) ? value * (display?.factor ?? 1) + (display?.offset ?? 0) : null;
  if (!Number.isFinite(shown)) return '—';
  const precision = Math.max(0, Math.min(12, digits));
  if (!formats.has(precision)) formats.set(precision, new Intl.NumberFormat('en-US', { maximumFractionDigits: precision }));
  const text = formats.get(precision).format(shown);
  return `${display?.unit === 'usd' ? '$' : ''}${text}${display?.unit === 'percent' ? '%' : ''}`;
}
