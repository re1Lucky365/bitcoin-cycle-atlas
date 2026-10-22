# Magnet mode and measurement anchors

Research and implementation: 2026-10-22.

## Verified reference behavior

TradingView's [OHLC snapping help](https://www.tradingview.com/support/solutions/43000472715-drawing-points-don-t-snap-to-ohlc-values-correctly/) describes a left toolbar magnet that attaches **drawing anchors** to bar open, high, low, or close prices. Its weak mode acts near a price point; its strong mode acts regardless of the vertical distance to the price. The documentation does not publish a pixel threshold or the internal nearest-point algorithm.

The [Magnet Mode help](https://www.tradingview.com/support/solutions/43000722509-magnet-mode/) documents temporary Ctrl/Command inversion during drawing and editing. The [original product announcement](https://www.tradingview.com/blog/en/drawing-on-the-chart-just-got-easier-14315/) specifically identifies the temporarily enabled mode as **strong** when the magnet was off. These primary sources agree on the behavior used here.

During the live reference inspection for this change, the public TradingView chart's left toolbar menu showed Weak magnet and Strong magnet, plus a separate disabled “Snap to indicators” choice. The strong magnet icon included an additional small downward arrow. This observation informed the placement and state distinction; Atlas uses its own SVG paths and accessible labels.

## Atlas interaction

The left toolbar magnet opens a menu with **끄기 / 약한 자석 / 강한 자석**. The selected mode is visible through its highlight, small mode label, menu selection, and accessible name. `Alt+M` cycles the three modes; this is an Atlas shortcut. The menu supports arrow keys, Home/End, Enter, Escape, and ordinary Tab navigation. The same menu is usable from the mobile tool surface.

The magnet applies to **두 지점 측정**, available for daily, weekly, hourly, and minute charts. Select the ruler, then choose two anchors. A blue ring and `O/H/L/C · 자석` label identify an attached anchor. The measurement label records the actual chosen endpoint fields and prices, the absolute and percentage price change, and the elapsed UTC duration. A second completed measurement starts when another point is chosen. Escape or the clear button removes it.

| Mode | Measurement price |
| --- | --- |
| Off | Free vertical pointer price, with time aligned to the nearest actual chart point |
| Weak | The nearest available OHLC price when its displayed vertical distance is within 12 CSS pixels; otherwise a free pointer price |
| Strong | The nearest available OHLC price on the nearest time/bar, regardless of vertical distance |
| Ctrl/Command while off | Temporarily uses strong magnet |
| Ctrl/Command while weak or strong | Temporarily uses free placement |

For touch, the weak tolerance is 20 CSS pixels. These tolerances are explicit Atlas choices, not a claim about TradingView's unpublished thresholds. Screen distance is measured after the price-axis transformation, so logarithmic and linear axes behave consistently. The threshold is adjusted to the SVG's rendered CSS scale.

In a candle chart, the candidates come from that actual displayed candle's O/H/L/C. A close-only line has only its plotted price as a candidate. A future scenario never receives synthetic open/high/low values. A measurement spanning scenario dates is labeled `가정 포함`. The normal price readout continues to show the underlying market close and OHLC values; a free measurement coordinate is not reported as an observed market price.

Endpoint prices and fields remain fixed during zoom, pan, axis changes, or indicator redraw. Measurements use stored coordinates, not a freshly substituted close price. Minute and hourly duration is computed from the UTC timestamp difference; missing bars are not invented. “봉 간격” counts elapsed nominal intervals and does not claim that each interval contained a transaction.

Atlas currently has a two-point ruler, not TradingView's full drawing catalog. Indicator snapping and editing a completed line by dragging its handles are not implemented by this change. The mode is nevertheless applied to the actual supported drawing tool, with the documented weak/strong/temporary behavior.

## Performance and regression checks

- Finding the time anchor uses binary search. Comparing the candidate OHLC prices is constant work (at most four values), and only a constant set of SVG attributes changes for the measurement preview.
- Daily and intraday pointer painting is coalesced to one update per animation frame. A newer viewport, click, keyboard action, or pointer exit cancels an older queued hover. Repeated hover over the same unchanged point does not reformat the readout.
- The existing viewport source-read and dense-SVG regression gates continue to pass; magnet state does not rebuild the forecast model.
- `tests/chart-magnet.test.mjs` checks modifier behavior, weak-distance versus strong-distance behavior on both axis types, close-only/future safety, fixed endpoint preservation, same-bar measurements, reversed UTC intervals, and real daily/intraday renderer event handlers. It also verifies that measurement clicks do not invoke the detail-panel callback.
- `tests/chart-hover.test.mjs` checks frame coalescing, last-event behavior, click/leave cancellation, stale viewport rejection, and the synchronous non-browser test fallback.

Automated renderer checks use a controlled SVG fixture. Browser and mobile layout verification are recorded with the overall workspace release verification; these unit checks alone do not establish real-device latency.
