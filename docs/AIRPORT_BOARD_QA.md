# Airport-style dark asset board · v1.26.0

Scope: BTC-first 18-asset comparison, preserving the existing chart and 17 assets. The user requested direct implementation and authorized push, PR checks/merge and Pages/release deployment. The old cloud run was stopped before this local implementation.

## Local acceptance
- Full Node suite: 1,020 passed; 0 failures, cancelled or skipped.
- Real isolated Chromium: 1440×1000, 390×844, 320×700 and 800×420. Actual page renders, not a resized image.
- All 18 rows load with BTC first; table and method dialog remain dark.
- Return, title and all three actions fit a single header row. Mobile global fallback return control and its reserved 52px row are excluded only for the comparison page.
- No document horizontal overflow. Table horizontal scrolling stays internal; sticky asset name does not overlap complete YTD/judgment at the final scroll position.
- PDBC final row remains accessible at all tested sizes, including short landscape.
- BTC method dialog opens/closes, return action navigates back to the chart.
- Actual browser CSV download: 18 data rows, 34 fields, BTC first.
- Existing 17 raw asset objects and full engine result rows are deep-equal to baseline `2e3ba70bd5424f38a89ed0bd96346d8519e17e2d` at 2026-10-25.
- Independent numerical, research, treasury, calibration, performance, static and standalone gates passed. These do not establish future investment profitability.
- Formal/TLA+ local gate could not start because the local host has no Java runtime. No dependency was silently installed. Existing unchanged formal models are still required by the PR CI gate; CI acceptance is recorded separately.

## Remote acceptance
Pending PR checks, merge, Pages/release and post-deploy browser verification at the time of this implementation commit. Local browser evidence is not a claim of public deployment.
