## 1. Cancelled request replaced chart

Rule broken: A canceled or replaced request must never supply a displayed chart.
Why: A saved response returns after cancellation without checking who owns the request.
There are 774 ways to get here in the model. This is the shortest.

0. Start: No candles loaded
1. Open candle chart. Now: Loading candles
2. Exchange fails; read saved candles. Now: Reading saved candles
3. Change interval or refresh. Now: Loading candles
4. Saved candles arrive. Now: Cancelled request replaced chart

With the existing guard, step 4 (saved candles arrive) keeps you at: Loading candles.
