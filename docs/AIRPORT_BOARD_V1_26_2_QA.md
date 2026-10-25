# v1.26.2 · airport board usability

Baseline: `9e874e02d4bbd684be89f4e417d28ab37c9e6c1c` (v1.26.1).

## Changed user journeys
- The bounded table viewport owns both scroll axes and keeps column headings pinned; the ticker/name corner stays above ordinary headers on mobile.
- Ticker codes occupy a consistent position. The identity button opens the same sourced judgment explanation as the final judgment button.
- Mobile quick moves go to the first or last columns, without filtering, reordering or recomputing the 18 rows.
- Mobile group/category columns are compacted out of the grid but their values remain available in each asset explanation and the unchanged CSV.
- The selected explanation gives three key figures first; general methodology is a native collapsed disclosure. The normal Read method action still shows the complete method.
- Numeric column widths use the actual scroll viewport as their query container, including the scrollbar gutter, so the final YTD/judgment columns meet the pinned name without fragments of the previous price column.

## Verified locally
- Controller lifecycle, unavailable data, escaping, CSV, fresh and superseded requests, unchanged-render work, and three new interaction/layout regressions passed.
- Real isolated Chromium, served from a Node static server, at 1440×1000, 390×844, 320×700, 700×600, 620×420 and 800×420.
- BTC first and 18 rows; one-line heading; no document overflow; last row reachable via the table viewport; column header top remains within 2px of its viewport after vertical scrolling.
- Actual mobile quick end/start controls; full final figures; pinned name does not overlap YTD/judgment; 320px custom 16px scrollbar-gutter probe.
- Keyboard Tab focus ring, native Escape, dark method dialog, reduced-motion override, chart return and a fresh CSV browser download (18 rows/34 fields).
- This is browser simulation, not a claim of physical phone or all-browser compatibility.
- Data, calculation engine, classification thresholds and the default 18-asset order are unchanged. No new forecast, confidence score or trading rule was introduced.

## Remote acceptance
PR CI, Pages/release and post-deploy checks remain separate from these local results and will be checked after the change is published.
