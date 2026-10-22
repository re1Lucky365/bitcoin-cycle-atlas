import { validateFullSeries, COMMUNITY_ENDPOINT } from './data-source.js?v=1.11.0';

export const PUBLISHED_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

function retrievalTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|\+00:00)$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value.slice(0, 10) ? time : NaN;
}

/** Validate a same-origin published snapshot before invalidating model caches. */
export function inspectPublishedDataset(candidate, current, { now = new Date() } = {}) {
  // The general model validator also accepts object rows. The public bundle
  // and browser consumers deliberately require the serialized tuple schema.
  if (!Array.isArray(candidate?.prices) || candidate.prices.some(row => !Array.isArray(row) || row.length !== 2)) throw new TypeError('Published prices must contain [UTC date, numeric price] rows');
  const rows = validateFullSeries(candidate?.prices), meta = candidate?.meta;
  const lastDate = rows.at(-1).date, today = now.toISOString().slice(0, 10);
  if (lastDate >= today) throw new Error('Published data contains an unfinished UTC day');
  if (!meta || meta.metric !== 'PriceUSD' || meta.frequency !== '1d' || meta.timezone !== 'UTC' || meta.sourceName !== 'Coin Metrics Community API') throw new Error('Published price provenance is inconsistent');
  const source = new URL(meta.source);
  if (`${source.origin}${source.pathname}` !== COMMUNITY_ENDPOINT || source.username || source.password) throw new Error('Published price source changed');
  if (meta.firstDate !== rows[0].date || meta.lastDate !== lastDate || meta.count !== rows.length || meta.missingDayCount !== 0) throw new Error('Published price metadata does not match its rows');
  for (let index = 1; index < rows.length; index++) if (rows[index].epochDay !== rows[index - 1].epochDay + 1) throw new Error('Published daily observations have a gap');
  const retrievedAt = retrievalTime(meta.retrievedAt);
  if (!Number.isFinite(retrievedAt) || retrievedAt > now.getTime() + 5_000 || meta.retrievedAt.slice(0, 10) <= lastDate) throw new Error('Published retrieval time is inconsistent with completed observations');
  const previous = current?.prices;
  // A manual provider refresh may already be newer than the deployed bundle.
  if (previous?.length && lastDate < previous.at(-1)[0]) return { changed: false, reason: 'published-snapshot-older', lastDate };
  let changed = !previous || previous.length !== candidate.prices.length;
  if (!changed) for (let index = 0; index < previous.length; index++) {
    if (previous[index][0] !== candidate.prices[index][0] || previous[index][1] !== candidate.prices[index][1]) { changed = true; break; }
  }
  // A same-day source correction fetched manually is newer evidence than an
  // older deployed copy, even when both series end on the same UTC date.
  if (changed && previous?.length && lastDate === previous.at(-1)[0]) {
    const previousRetrievedAt = retrievalTime(current?.meta?.retrievedAt);
    if (Number.isFinite(previousRetrievedAt) && retrievedAt < previousRetrievedAt) return { changed: false, reason: 'published-revision-older', lastDate };
  }
  return { changed, reason: changed ? 'published-observations-changed' : 'same-observations', lastDate };
}

export function shouldCheckPublishedSnapshot(lastAttempt, now = Date.now(), visible = true) {
  return visible && Number.isFinite(now) && (!Number.isFinite(lastAttempt) || now - lastAttempt >= PUBLISHED_REFRESH_INTERVAL_MS);
}
