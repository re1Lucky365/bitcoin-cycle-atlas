import { utcDay } from './cycle-engine.js?v=1.11.0';
import { CHART_INTERVALS, isIntradayInterval } from './ohlc-data.js?v=1.11.0';
import { INTRADAY_MAX_VISIBLE_BARS } from './intraday-history.js?v=1.11.0';

export const WORKSPACE_STORAGE_KEY = 'atlas.workspaces.v1';
export const MAX_WORKSPACES = 8;
const keys = new Set(['span','magnet','assumption','granularity','axis','align','interval','measure','scope','phase','audit','type','indicators','indicator-hide','indicator-list','indicator-primary','cycle-relation','cycle-panel','chart','unit','view-start','view-end']);
const validDate = value => {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  try { utcDay(value); return true; } catch { return false; }
};

/** Public links describe a bounded viewport, never executable content or a destination URL. */
export function normalizeWorkspaceRange(range, frequency = 'daily') {
  if (!range || typeof range !== 'object') return null;
  if (isIntradayInterval(frequency)) {
    const step = CHART_INTERVALS.find(item => item.id === frequency).seconds;
    const { start, end } = range;
    if (![start,end].every(value => Number.isSafeInteger(value) && value >= 1230940800 && value < 4102444800 && value % step === 0) || end <= start || (end-start)/step+1 > INTRADAY_MAX_VISIBLE_BARS) return null;
    return { start, end };
  }
  if (!validDate(range.start) || !validDate(range.end) || range.end <= range.start) return null;
  return { start:range.start, end:range.end };
}

export function readWorkspaceViewport(params) {
  const frequency = params.get('granularity') || 'daily';
  const read = key => isIntradayInterval(frequency) ? (/^\d{10}$/.test(params.get(key) || '') ? Number(params.get(key)) : NaN) : params.get(key);
  return { unit:params.get('unit') === 'indexed' ? 'indexed' : 'usd', range:normalizeWorkspaceRange({start:read('view-start'),end:read('view-end')},frequency) };
}

export function writeWorkspaceViewport(params, { frequency = 'daily', unit = 'usd', range = null } = {}) {
  unit === 'indexed' ? params.set('unit','indexed') : params.delete('unit');
  const valid = normalizeWorkspaceRange(range,frequency);
  for (const key of ['start','end']) valid ? params.set(`view-${key}`,String(valid[key])) : params.delete(`view-${key}`);
  return params;
}

export function cleanWorkspaceQuery(query) {
  if (typeof query !== 'string' || query.length > 5000) return '';
  const source = new URLSearchParams(query), result = new URLSearchParams();
  for (const [key,value] of source) if (keys.has(key) && value.length <= 500) result.set(key,value);
  const view = readWorkspaceViewport(result);
  writeWorkspaceViewport(result,{frequency:result.get('granularity') || 'daily',...view});
  result.sort();
  return result.toString();
}

export function workspaceQuery(params, view) {
  const copy = new URLSearchParams(params);
  writeWorkspaceViewport(copy,view);
  return cleanWorkspaceQuery(copy.toString());
}

export function readWorkspaces(storage) {
  try {
    const payload = JSON.parse(storage?.getItem(WORKSPACE_STORAGE_KEY) || 'null');
    if (payload?.version !== 1 || !Array.isArray(payload.items)) return [];
    const used = new Set();
    return payload.items.slice(0,MAX_WORKSPACES).flatMap(item => {
      if (!item || typeof item.name !== 'string' || typeof item.query !== 'string') return [];
      const name = item.name.trim().slice(0,40);
      if (!name || used.has(name)) return [];
      used.add(name);
      return [{name,query:cleanWorkspaceQuery(item.query)}];
    });
  } catch { return []; }
}

export function saveWorkspace(storage, items, {name,query}, {overwrite=false} = {}) {
  const label = String(name ?? '').trim().slice(0,40);
  if (!label) return {ok:false,error:'작업 화면 이름을 입력해 주세요.'};
  const previous = items.findIndex(item => item.name === label);
  if (previous >= 0 && !overwrite) return {ok:false,error:'같은 이름이 있습니다. 저장 목록의 덮어쓰기를 사용해 주세요.'};
  if (previous < 0 && items.length >= MAX_WORKSPACES) return {ok:false,error:`작업 화면은 ${MAX_WORKSPACES}개까지 저장합니다. 기존 항목을 삭제하거나 덮어써 주세요.`};
  const next = items.map(item => ({...item})), value = {name:label,query:cleanWorkspaceQuery(query)};
  if (previous >= 0) next[previous] = value; else next.push(value);
  return writeWorkspaces(storage,next);
}

export function writeWorkspaces(storage, items) {
  try {
    if (!storage) throw new Error('unavailable');
    storage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify({version:1,items}));
    return {ok:true,items};
  } catch { return {ok:false,error:'이 브라우저에서 저장할 수 없습니다. 공유 링크를 복사해 보관해 주세요.'}; }
}

export function searchWorkspaceCommands(commands, query = '') {
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return commands.filter(command => !command.hidden && terms.every(term => `${command.label} ${command.description || ''} ${command.keywords || ''}`.toLocaleLowerCase().includes(term)));
}
