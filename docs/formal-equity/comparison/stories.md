## 1. Usable chart remains behind loading shell

Rule broken: An observed or actionable-error render releases the loading shell immediately.
Why: The boot event waits for coin retrieval and forecast computation.
In the model, one step leads into this bug: "render the available chart". The steps below are the shortest path that TLC found.

0. Start: Waiting for usable chart
1. Open or retry the chart. Now: Loading price archive
   (1 hidden step: stock prices arrive)
2. Render the available chart. Now: Usable chart remains behind loading shell

With observed readiness fix, step 2 (render the available chart) takes you to: Observed chart ready; forecast pending.

## 2. A hidden page announces readiness

Rule broken: A suspended document never publishes its first ready event.
Why: The final initialization callback publishes readiness while suspended.
In the model, one step leads into this bug: "initial loader finishes". The steps below are the shortest path that TLC found.

0. Start: Waiting for usable chart
1. Open or retry the chart. Now: Loading price archive
2. Leave the page. Now: Page suspended
   (1 hidden step: stock prices arrive)
3. Initial loader finishes. Now: A hidden page announces readiness

With observed readiness fix, step 3 (initial loader finishes) keeps you at: Page suspended.
