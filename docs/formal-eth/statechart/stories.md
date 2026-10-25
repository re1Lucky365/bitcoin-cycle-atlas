## 1. Hidden page published updates

Rule broken: A suspended page must publish neither chart updates nor readiness, even if an old queued callback runs. Guarded by dist/eth-view.js:131,163,233.
Why: An old frame or layout callback publishes while the page is suspended.
In the model, 2 different steps lead into this bug: "render available content" and "initial loader finishes". The steps below are the shortest path that TLC found.

0. Start: Loading shell
1. Open ETH chart. Now: Loading shell
2. Leave the page. Now: Page suspended
3. Layout notification. Now: Page suspended
4. Render available content. Now: Hidden page published updates

With ETH lifecycle fix, step 4 (render available content) cannot happen, so you stay at: Page suspended.

## 2. Empty chart announced ready

Rule broken: Readiness may be announced only when the selected chart has prices or a rendered actionable error. Guarded by dist/eth-view.js:129,152,161,246.
Why: A revoked initializer announces readiness before restored data or a retry error exists.
In the model, one step leads into this bug: "initial loader finishes". The steps below are the shortest path that TLC found.

0. Start: Loading shell
1. Open ETH chart. Now: Loading shell
2. Leave the page. Now: Page suspended
3. Saved prices arrive. Now: Page suspended
4. Initial loader finishes. Now: Empty chart announced ready

With ETH lifecycle fix, step 4 (initial loader finishes) keeps you at: Page suspended.

## 3. Refresh reset the chosen range

Rule broken: A completed refresh may not reset navigation chosen after that request began. Guarded by dist/eth-view.js:90-91,98,106,174,185,192-193,203,205,215.
Why: A live response resets a date range the user selected while waiting.
In the model, one step leads into this bug: "live prices arrive". The steps below are the shortest path that TLC found.

0. Start: Loading shell
1. Open ETH chart. Now: Loading shell
2. Saved prices arrive. Now: Prices waiting for first display
3. Initial loader finishes. Now: Observed chart ready
4. Refresh or retry. Now: Refreshing observed prices
5. Choose a date range. Now: Refreshing with a new range
6. Live prices arrive. Now: Refresh reset the chosen range

With ETH lifecycle fix, step 6 (live prices arrive) takes you to: Observed chart at chosen range.
