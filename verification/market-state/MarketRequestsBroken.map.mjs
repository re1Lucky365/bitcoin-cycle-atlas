export const readerActions = ['Load', 'Cancel'];
const labels = {
  idle: 'No candles loaded',
  loading: 'Loading candles',
  ready: 'Live candles displayed',
  snapshot: 'Saved candles displayed',
  error: 'Candle request failed',
};
export function state(v) {
  const bad = Object.values(v.displayed).some(id => v.cancelled.includes(id));
  if (bad) return 'Cancelled request replaced chart';
  const waitingForSaved = v.active > 0 && v.phase[v.active - 1] === 'fallback';
  return waitingForSaved ? 'Reading saved candles' : labels[v.status[v.selected]];
}
export function step(action, before, after) {
  return {
    Load: before.issued ? 'change interval or refresh' : 'open candle chart',
    Cancel: 'cancel candle request',
    LiveSuccess: 'exchange candles arrive',
    LiveFailure: 'exchange fails; read saved candles',
    SavedSuccess: 'saved candles arrive',
    SavedFailure: 'saved candles fail',
  }[action] ?? action;
}
export function cause() {
  return 'A saved response returns after cancellation without checking who owns the request';
}
