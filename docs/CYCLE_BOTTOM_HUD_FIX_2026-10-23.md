# Cycle period bottom layout, compact context HUD, and crosshair stability

Date: 2026-10-23 · package `1.12.1` · assets `1.12.1-cursor-hud.1`

## Scope / 요청 사항

This change addresses three connected chart issues:

1. **사이클 기간 비교:** keep every duration line in the lower part of the existing price graph when zooming or panning, without increasing the chart height.
2. **가격·색상 원 범례:** move the actual-price, future-assumption, assumption-range, high/low, and six milestone keys into a compact context area beside the upper-right D-day information.
3. **크로스헤어 반복 복귀:** stop the mouse-following crosshair from repeatedly returning to the observation cutoff while the pointer moves across the chart.

The implementation and preview checks below do not constitute a deployment record. Final aggregate gates and release information are recorded separately at the end of this document.

## Confirmed crosshair feedback loop

The chart has two separate concepts: the **committed selection** used by the inspector, and the **live pointer preview** shown while the mouse moves. Before this change, every complete SVG redraw initialized the crosshair from the committed selection. The default committed date was the observation cutoff.

The problematic event sequence was:

1. Moving the pointer updated the source readout, including the observed/future label and OHLC fields.
2. The readout's rendered width or height changed. This is particularly visible when moving between actual candles and the conditional future path.
3. The HUD `ResizeObserver` dispatched `atlas:hud-layout-change`.
4. The listener scheduled a complete chart redraw to reposition cycle-period labels around the HUD.
5. The redraw discarded the live pointer preview and painted the committed date again.
6. The next pointer event painted the hover date again. Further readout geometry changes could restart the sequence.

This produced the reported impression that the crosshair repeatedly attached to and detached from the observation's vertical dashed line.

### Isolated renderer reproduction

The failure was reproduced with one SVG, unchanged rows, unchanged viewport, and a fixed pointer at `(750, 180)`. Repeating `pointermove → redraw` produced:

| Step | Readout date | SVG crosshair x | Preview status |
| --- | --- | ---: | --- |
| Initial committed selection | 2026-10-15 | 465 | Selected |
| Pointer move | 2026-10-18 | 736.8 | Hovered |
| Redraw | 2026-10-15 | 465 | Selected |
| Same pointer move | 2026-10-18 | 736.8 | Hovered |
| Same redraw | 2026-10-15 | 465 | Selected |

The reproduction did not require the magnet tool or cycle annotations. It established that resetting the preview during redraw was sufficient to cause the jump.

### Real browser comparison

The public baseline and the local preview were compared with the same near-term six-month range and candle display. Real pointer movement was performed through the supported browser control surface using a zero-amount scroll at each coordinate. The visible time range was checked and remained unchanged.

All input positions below used screen `y = 300`. The chart's top was at screen `y = 40`, so the correct free horizontal crosshair position was SVG `y = 260`. The x coordinate follows the chart's displayed bar/date selection.

| Pointer screen x | Baseline settled SVG crosshair x | Preview SVG crosshair x | Preview SVG crosshair y |
| ---: | ---: | ---: | ---: |
| 180 | 137.50 | 137.50 | 260 |
| 520 | 242.079 | 477.39 | 260 |
| 190 | 242.079 | 147.96 | 260 |
| 550 | 242.079 | 503.53 | 260 |
| 210 | 242.079 | 163.64 | 260 |
| 600 | 242.079 | 555.82 | 260 |

The first baseline movement displayed the correct crosshair near x = 137.50. Each of the next five movements returned to the observation cutoff at x = 242.079 and y = 441.86. The preview retained the pointer's horizontal price position and followed the corresponding dates across the observed/future boundary. Its readouts matched those dates. No zoom or pan was used to produce this comparison. The [browser observation record](screenshots/cycle-bottom-hud-20261023/qa-observations.json) includes the original measurements and a second check of the final version, including three actual 1h pointer positions.

## 1. Stable period rows at the bottom of the price graph

[`cycle-interval-overlay.js`](../dist/cycle-interval-overlay.js) now derives a bottom band only from the price plot's bounds:

```text
bandHeight = min(200px, pricePlotHeight × 0.40)
bandBottom = priceBottom
bandTop = priceBottom − bandHeight
```

The lower edge is the **price** plot's lower edge. It does not use the lower edge of a volume or other secondary pane.

In the all-relations view, the nine relation families use a canonical row order. Overlapping intervals within a relation receive subtracks from their complete original UTC date ranges. Their vertical positions therefore do not depend on the visible clipped width, selected annotation, price scale, displayed price unit, price-curve intersections, or HUD obstacles.

Zooming and panning still recalculate each interval's x coordinates against the same time projection used by the price path and milestone circles. They do not change the original endpoint dates or elapsed duration. A viewport boundary uses continuation chevrons when the real endpoint is outside the view; it does not create a new endpoint at that boundary.

Every valid intersecting duration line remains present. Labels use the available horizontal space and can be shortened or omitted when necessary. Their full relationship, dates, elapsed days, and observed/provisional/scenario status remain available through the accessible label, focus preview, and selection details. Label and preview geometry also stays inside the bottom band.

The real-data integration fixture contains **44 intervals and 30 milestones**, with all nine relationship families represented across observed history and a conditional future path. Tests verify that enabling periods does not change the source prices, future path, price domain, time projection, SVG viewBox, or allocated chart height.

### Space limits

The band is capped at 200px and uses no more than 40% of the existing price height. On a short mobile chart with secondary panes enabled, nine families can become dense. The implementation preserves their lines and uses compact text or selection details instead of increasing the chart height. Selecting a single relation can pack that relation closer to the bottom and provide more readable labels; the exact row position is guaranteed across zoom, pan, and content changes within the same relation view.

## 2. Compact D-day and legend context area

The existing price and milestone legend is positioned with the D-day information at the upper right, aligned with the chart's price-axis margin. It remains part of the chart HUD and does not allocate another chart pane.

On wide plots, the price readout and study list keep their left-side space. On narrow plots, the context information wraps below the price/provenance readout, with the D-day, legend, and indicator list following a defined vertical order. Countdown and legend visibility remain independent.

The HUD observer measures the actual border-box heights of the legend and countdown. The legend's height has its own `--chart-legend-height` property and cannot overwrite the source/provenance height. Repeated measurements of the same geometry do not repeatedly publish layout changes.

The displayed keys retain their meanings and colors. Actual prices, conditional future paths and ranges, high/low markers, and the six cycle-marker types remain distinguishable. Visibility follows the enabled chart features.

Actual browser layout checks confirmed a 430px-wide desktop group (32px D-day + 66px legend). At 390px and 320px viewport widths, the group was 297px and 227px wide, respectively, with the six colored keys in three columns. Plot height stayed 833px on desktop, 693px at 390×844, and 589px at 320×740. Hiding either D-day or the legend removed its space while retaining the other piece and restoring the outside rounded corners.

The mobile check caught a CSS specificity regression during review: a wide-plot maximum-width selector also applied to the narrow study list and reduced its width to zero. Wide left-column rules now apply only inside a container wider than 850px. The 320px expanded list was rechecked at 227px wide, with body and scroll widths both 320px; the D-day and legend positions and chart height remained unchanged.

## 3. Update annotations without resetting the live cursor

The daily renderer exposes `controller.updateCycleOverlayObstacles(obstacles)`. HUD changes call this method through `refreshCycleHudPlacement()` instead of scheduling a complete price-chart redraw.

The method reuses the existing dates, x/y transforms, marker obstacles, price samples, and selected cycle annotation. It updates only `.cycle-interval-overlay-layer` when the generated annotation markup changes. The price path, crosshair nodes, current pointer coordinates, committed selection, and inspection callbacks remain untouched. If a period had keyboard focus, its replacement group receives focus without scrolling. A controller from an older drawing cannot modify a newer chart.

Complete redraws are still needed for zoom, scale changes, refreshed data, and other chart operations. Both daily and intraday renderers therefore preserve a valid live pointer's coordinates separately from its committed selection and reproject those coordinates through the new chart geometry. They do not first publish an intermediate readout from the observation cutoff.

Only coordinates and semantic scope are retained; a detached SVG event target is never reused. Source identity, interval, chart type, tool, measurement state, and selection intent limit reuse. Pointer leave, explicit selection, keyboard selection, a tool change, or a replacement data/scenario scope invalidates the old preview. Pending callbacks from the previous drawing are cancelled.

An independent review also reproduced a selection-owner edge case: when cycle/countdown/analysis inspection rejects automatic price inspection, an offscreen caller-selected date must remain distinct from the nearest visible date. The retained preview records both as permitted aliases. This supports callers that accept or reject automatic selection updates while still rejecting a different explicit offscreen date, even if both dates clamp to the same visible endpoint.

## Regression coverage

| Test file | Checked behavior |
| --- | --- |
| [`cycle-interval-overlay.test.mjs`](../tests/cycle-interval-overlay.test.mjs) | Fixed bottom band, canonical rows/subtracks, exact dates and duration, clipping, compact labels, mobile bounds |
| [`cycle-period-bottom-layout.test.mjs`](../tests/cycle-period-bottom-layout.test.mjs) | Actual renderer with 44 intervals; scale/unit/manual domain/HUD/selection/zoom invariants; scenario replacement; keyboard activation; SVG export; annotation-only HUD updates |
| [`chart-cursor.test.mjs`](../tests/chart-cursor.test.mjs) | Repeated redraw stability in daily/intraday charts; pointer re-projection; explicit selection and leave; obsolete RAF cancellation; non-price inspection ownership |
| [`chart-hover.test.mjs`](../tests/chart-hover.test.mjs) | One pending pointer frame per chart and invalidation of retired handlers |
| [`chart-tradingview-parity.test.mjs`](../tests/chart-tradingview-parity.test.mjs) | Weekly/source alignment, previous-close readouts, annotation key ownership, manual price clipping |
| [`indicator-workbench.test.mjs`](../tests/indicator-workbench.test.mjs) | Border-box measurement, independent legend/source heights, hide/restore, geometry-change notifications and duplicate suppression |
| [`chart-performance.test.mjs`](../tests/chart-performance.test.mjs) | Windowed source access, exact displayed data, bounded redraw work and pane allocation |

The SVG integration harness checks generated coordinates, DOM identity boundaries, selection delegation, and export cloning. It does not claim to measure browser font layout. The real-browser comparison above covers the reported mouse-motion failure; desktop/mobile screenshots cover the visible layout. PNG export continues to use the same composed SVG export path.

## Screenshots

- [`01-before-zoom.jpg`](screenshots/cycle-bottom-hud-20261023/01-before-zoom.jpg): public baseline; BOTTOM → ATH has moved near the chart top.
- [`02-after-zoom.jpg`](screenshots/cycle-bottom-hud-20261023/02-after-zoom.jpg): same six-month range after the fix; all four intersecting periods remain below SVG y = 520, inside the y = 415–615 price-bottom band, with the legend beside D-day.
- [`03-after-mobile.jpg`](screenshots/cycle-bottom-hud-20261023/03-after-mobile.jpg): actual app in a 390×844 browser viewport wrapper; upper context group, colored markers and lower duration lines.

Each saved image was opened and visually checked. The wrapper checks responsive browser layout, not physical-device performance or mobile TradingView behavior.

## Final verification and release

| Gate | Final local result |
| --- | --- |
| Whole suite | `npm test`: 56/56 files exit 0. Direct runs: 485/485 node:test cases + 44/44 named legacy checks = **529 passed**, none skipped/cancelled/failed. File-level results are not added to the case count. |
| Static paths | 86 files, 163 references, Pages base path valid. |
| Daily calibration | 5,941 observations, asOf 2026-10-22; generated calibration matches the committed data. |
| Bounded chart work | 104 SVG elements against a 120-element budget; windowed source-access checks pass. This is a Node boundary gate, not browser FPS or input-latency measurement. |
| Standalone | 13,839,697 bytes, 61 modules, 5,941 embedded observations; generated standalone passes static validation. |
| Formal request ownership | TLC 1.7.4 checksum verified; normal model passes at 5,955 generated / 2,081 distinct states. Broken model produces the expected invariant violation; implementation mutation produces the expected assertion failure. |
| Browser | Reported pointer failure reproduced on baseline and absent after fix; zoom/pan/linear scale rows stable; 320/390 responsive checks, separate HUD visibility, and 1h pointer checks pass. No captured local-app console errors/warnings. |

The 136 source/test/package hashes were identical before and after the full test run. The formal gate covers bounded request ownership, not a whole-program, price-accuracy, wall-clock or liveness proof. Remote CI and Pages publication are recorded by the associated pull request and GitHub Actions runs; the table above records the local pre-publication evidence.
