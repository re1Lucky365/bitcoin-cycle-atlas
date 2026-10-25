export const readerActions = ['Open', 'Refresh', 'ChangeInterval', 'Pan', 'Hide', 'Show'];
export function state({ s }) {
  if (s.badReadiness) return 'Empty chart announced ready';
  if (s.hiddenPublication) return 'Hidden page published updates';
  if (s.stalePublication) return 'Revoked request replaced current state';
  if (s.lostNavigation) return 'Refresh reset the chosen range';
  if (!s.attached) return 'Page suspended';
  if (!s.ready) return s.prices > 0 ? 'Prices waiting for first display' : s.priceError ? 'Retry waiting for first display' : 'Loading shell';
  if (s.prices === 0) return s.priceError ? 'Retry available' : 'Loading after retry';
  if (s.loading) return s.range === 'custom' ? 'Refreshing with a new range' : 'Refreshing observed prices';
  if (s.refreshError) return 'Observed chart with refresh error';
  return s.range === 'custom' ? 'Observed chart at chosen range' : 'Observed chart ready';
}
export function step(action) {
  return {
    Open: 'open ETH chart', Refresh: 'refresh or retry', ChangeInterval: 'change daily or weekly',
    ArchiveArrives: 'saved prices arrive', ArchiveFails: 'saved price request fails',
    LiveArrives: 'live prices arrive', LiveFails: 'live price request fails',
    Pan: 'choose a date range', Render: 'render available content', InitialFrame: 'initial loader finishes',
    Hide: 'leave the page', Show: 'restore the page', Resize: 'layout notification',
  }[action] || action;
}
export function cause(_state, _facts, invariant) {
  return {
    ReadyHasUsableView: 'A revoked initializer announces readiness before restored data or a retry error exists',
    NoHiddenPublication: 'An old frame or layout callback publishes while the page is suspended',
    NoStalePublication: 'A late response publishes without checking current request ownership',
    NavigationSurvivesRefresh: 'A live response resets a date range the user selected while waiting',
    ReadinessOnce: 'Readiness is emitted more than once for the same document',
  }[invariant] || invariant;
}
