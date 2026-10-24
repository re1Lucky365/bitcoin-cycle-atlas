export const readerActions = ['Load', 'Hide', 'Show', 'Pan', 'ChangeInterval'];
export function state(v) {
  if (v.hiddenReady) return 'A hidden page announces readiness';
  if (v.staleWrite) return 'An old request changed the current chart';
  if (v.projection > 0 && v.projection !== v.prices) return 'Old forecast paired with new prices';
  if ((v.painted > 0 || v.errorPainted) && !v.ready) return 'Usable chart remains behind loading shell';
  if (!v.attached) return 'Page suspended';
  if (v.projection > 0) return 'Observed chart and forecast ready';
  if (v.prices > 0 && v.ready) return v.forecastError ? 'Observed chart ready; forecast failed' : 'Observed chart ready; forecast pending';
  if (v.priceError && v.ready) return 'Price error and retry button visible';
  return v.loading ? 'Loading price archive' : 'Waiting for usable chart';
}
export function step(action) {
  return {
    Load: 'open or retry the chart', PricesArrive: 'stock prices arrive', PricesFail: 'stock price request fails',
    CoinArrives: 'coin archive arrives', CoinFails: 'coin archive fails', FirstPaint: 'first paint yield runs',
    SecondPaint: 'second paint yield runs', Project: 'compute the three forecasts', ProjectFails: 'forecast calculation rejects its inputs', Render: 'render the available chart',
    InitialFrame: 'initial loader finishes', Hide: 'leave the page', Show: 'restore the page',
    Pan: 'pan to a chosen date range', ChangeInterval: 'change daily or weekly display',
  }[action] || action;
}
export function cause(v) {
  if (v.hiddenReady) return 'The final initialization callback publishes readiness while suspended';
  if (v.staleWrite) return 'A late continuation does not check its request generation';
  if (v.projection > 0 && v.projection !== v.prices) return 'A previous projection survives new stock prices';
  return 'The boot event waits for coin retrieval and forecast computation';
}
