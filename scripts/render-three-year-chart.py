#!/usr/bin/env python3
"""Render the exact conditional paths in THREE_YEAR_RESULTS.json.

No price data is fetched and no forecast is refitted by this renderer.
Outputs default to the repository's build/ directory (or BCA_OUTPUT_DIR).
Uses an installed Korean font, or fonts from --font-dir / BCA_FONT_DIR.
Usage: python scripts/render-three-year-chart.py [--output /path/chart.png] [--font-dir /path/fonts]
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(os.environ.get("BCA_OUTPUT_DIR") or ROOT / "build").expanduser()
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / "build/.matplotlib"))
import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ft2font import FT2Font
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.ticker import FixedLocator, NullLocator, ScalarFormatter


COLORS = {
    "base": "#ffb454",
    "early-arrival-6": "#65c9ff",
    "early-arrival-9": "#b59bff",
    "early-turn": "#ff7893",
    "delayed": "#55d6b3",
    "stress": "#bccbdd",
}
LABELS = {
    "base": "기본 · A3 / D3",
    "early-arrival-6": "6개월 조기 도달 · A6 / D6",
    "early-arrival-9": "9개월 조기 도달 · A9 / D9",
    "early-turn": "4개월 조기 전환 · A9 / D5",
    "delayed": "3개월 지연 전환 · A3 / D6",
    "stress": "저점 이탈 스트레스 · A3 / D3",
}
TABLE_LABELS = {
    "base": "기본",
    "early-arrival-6": "6개월 조기 도달",
    "early-arrival-9": "9개월 조기 도달",
    "early-turn": "4개월 조기 전환",
    "delayed": "3개월 지연 전환",
    "stress": "저점 이탈 스트레스",
}
STYLES = {
    "base": (0, (6, 2.6)),
    "early-arrival-6": (0, (4, 2.5)),
    "early-arrival-9": (0, (2, 2)),
    "early-turn": (0, (6, 2, 1, 2)),
    "delayed": (0, (9, 3)),
    "stress": (0, (3, 2, 1, 2)),
}


def day(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%d")


def register_font(font_dir=None) -> str:
    guidance = (
        "Install Nanum Gothic or Noto Sans CJK, or provide a directory containing "
        "Korean .ttf/.otf/.ttc fonts with --font-dir or BCA_FONT_DIR."
    )
    selected_paths = None
    if font_dir is not None:
        font_dir = Path(font_dir).expanduser()
        if not font_dir.is_dir():
            raise FileNotFoundError(f"Font directory does not exist: {font_dir}. {guidance}")
        selected_paths = set()
        for path in sorted(font_dir.rglob("*")):
            if path.is_file() and path.suffix.lower() in {".ttf", ".otf", ".ttc"}:
                try:
                    font_manager.fontManager.addfont(str(path))
                    selected_paths.add(path.resolve())
                except (OSError, RuntimeError, ValueError):
                    continue
    preferred = (
        "NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic",
        "Apple SD Gothic Neo", "AppleGothic", "Noto Sans CJK JP",
    )
    ranks = {name: index for index, name in enumerate(preferred)}
    candidates = sorted(font_manager.fontManager.ttflist, key=lambda entry: (
        ranks.get(entry.name, len(ranks)), entry.style != "normal",
        entry.weight not in ("normal", "regular", 400), entry.fname,
    ))
    required_glyphs = {ord(char) for char in "비트코인고점저점전망조건부시나리오"}
    for entry in candidates:
        if selected_paths is not None and Path(entry.fname).resolve() not in selected_paths:
            continue
        try:
            if required_glyphs.issubset(FT2Font(entry.fname).get_charmap()):
                return entry.name
        except (OSError, RuntimeError, ValueError):
            continue
    raise RuntimeError(f"No usable Korean font was found. {guidance}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR / "Bitcoin_Three_Year_Outlook.png")
    parser.add_argument("--model", type=Path, default=ROOT / "docs/THREE_YEAR_RESULTS.json")
    parser.add_argument("--data", type=Path, default=ROOT / "dist/data/btc-daily.json")
    parser.add_argument("--font-dir", type=Path, default=os.environ.get("BCA_FONT_DIR") or None,
                        help="Korean font directory; defaults to BCA_FONT_DIR, then installed fonts")
    args = parser.parse_args()
    model = json.loads(args.model.read_text())
    data = json.loads(args.data.read_text())
    scenarios = {scenario["id"]: scenario for scenario in model["scenarios"]}
    if set(scenarios) != set(COLORS):
        raise ValueError("The renderer expects the six documented scenario IDs")
    font = register_font(args.font_dir)
    plt.rcParams.update({
        "font.family": font,
        "axes.unicode_minus": False,
        "text.color": "#e7edf8",
        "axes.labelcolor": "#b9c8de",
        "xtick.color": "#9db0ca",
        "ytick.color": "#9db0ca",
        "font.size": 10,
        "savefig.facecolor": "#0b1221",
    })

    # Exact 2200×1500 output. Layout uses figure fractions to avoid resize drift.
    fig = plt.figure(figsize=(2200 / 150, 1500 / 150), dpi=150, facecolor="#0b1221")
    fig.text(0.055, 0.962, "BTC 3년 전망", fontsize=23, fontweight="bold", va="top")
    fig.text(0.974, 0.958, "조건부 시나리오 · 확률 예측 아님", ha="right", va="top", fontsize=10.5,
             color="#ffce83", bbox={"boxstyle": "round,pad=0.45", "fc": "#2b241d", "ec": "#695035", "lw": 0.7})
    fig.text(0.057, 0.923,
             f"기준 {model['referenceDate']}  |  관측 종료 {model['asOf']} UTC  |  표시 종료 {model['displayEnd']}  |  현재 = 100 (${model['observables']['current']['price']:,.2f})",
             fontsize=10.2, color="#9fb1cb")

    ax = fig.add_axes([0.067, 0.466, 0.905, 0.396], facecolor="#111c2d")
    current = model["observables"]["current"]["price"]
    start_date = "2025-06-01"
    actual = [(date, price) for date, price in data["prices"] if start_date <= date <= model["asOf"]]
    if not actual or actual[-1][0] != model["asOf"]:
        raise ValueError("The observed series does not end at the model's asOf")
    ax.set_yscale("log")
    ax.set_xlim(day(start_date), day(model["displayEnd"]))
    all_band = [point["indexedHigh"] for point in scenarios["base"]["path"]]
    all_low = [point["indexedLow"] for scenario in scenarios.values() for point in scenario["path"]]
    y_min = min(45, min(all_low) * 0.86)
    y_max = max(370, max(all_band) * 1.19)
    ax.set_ylim(y_min, y_max)
    ax.axvspan(day(start_date), day(model["asOf"]), color="#24334b", alpha=0.23, zorder=0)
    for spine in ax.spines.values():
        spine.set_color("#31425c")
        spine.set_linewidth(0.7)
    ax.grid(axis="y", color="#57708f", alpha=0.24, linewidth=0.6)
    ax.grid(axis="x", color="#46617d", alpha=0.13, linewidth=0.5)
    ax.axhline(100, color="#b9cce2", alpha=0.42, linewidth=0.85, zorder=1)
    ax.axvline(day(model["asOf"]), color="#b0c4df", alpha=0.72, linestyle=(0, (2, 3)), linewidth=1.0)
    for date in (model["nominalClock"]["nominalTroughDate"], model["nominalClock"]["nominalPeakDate"]):
        ax.axvline(day(date), color="#8795ae", alpha=0.28, linestyle=(0, (1, 4)), linewidth=0.8)

    base = scenarios["base"]
    dates = [day(point["date"]) for point in base["path"]]
    ax.fill_between(dates, [p["indexedLow"] for p in base["path"]], [p["indexedHigh"] for p in base["path"]],
                    color=COLORS["base"], alpha=0.105, linewidth=0, zorder=1)
    # Draw overlapping alternatives first; the orange base remains readable.
    for scenario_id in ["stress", "delayed", "early-turn", "early-arrival-9", "early-arrival-6", "base"]:
        scenario = scenarios[scenario_id]
        path = scenario["path"]
        ax.plot([day(p["date"]) for p in path], [p["indexedPrice"] for p in path],
                color=COLORS[scenario_id], linestyle=STYLES[scenario_id],
                linewidth=2.0 if scenario_id == "base" else 1.35,
                alpha=1 if scenario_id == "base" else 0.9, zorder=5 if scenario_id == "base" else 3)
        peak = next(event for event in scenario["events"] if event["id"] == "peak")
        if peak["inHorizon"] and scenario_id in ("base", "early-turn"):
            ax.scatter(day(peak["date"]), 100 * peak["price"] / current, s=34, marker="^",
                       color=COLORS[scenario_id], edgecolors="#0b1221", linewidths=0.7, zorder=7)
    ax.plot([day(date) for date, _ in actual], [100 * price / current for _, price in actual],
            color="#edf3ff", linewidth=1.8, solid_capstyle="round", zorder=6)

    observed_peak = model["observables"]["peak"]
    low = model["observables"]["troughCandidate"]
    for point in (observed_peak, low, model["observables"]["current"]):
        ax.scatter(day(point["date"]), 100 * point["price"] / current, s=29,
                   color="#eff4ff", edgecolors="#0b1221", linewidths=0.9, zorder=8)
    box = {"boxstyle": "round,pad=0.35", "fc": "#142035", "ec": "#354965", "lw": 0.6, "alpha": 0.98}
    arrow = {"arrowstyle": "-", "color": "#8ba2c2", "lw": 0.8}
    ax.annotate(f"관측 고점 기준\n{observed_peak['date']}", xy=(day(observed_peak["date"]), 100 * observed_peak["price"] / current),
                xytext=(day("2025-07-01"), 192), fontsize=9.4, color="#d7e1f1", bbox=box, arrowprops=arrow)
    ax.annotate(f"관측 저점 후보\n{low['date']}", xy=(day(low["date"]), 100 * low["price"] / current),
                xytext=(day("2026-02-15"), 52.0), fontsize=9.4, color="#d7e1f1", bbox=box, arrowprops=arrow)
    ax.annotate("마지막 관측 100", xy=(day(model["asOf"]), 100), xytext=(day("2026-11-10"), 126),
                fontsize=9.5, color="#edf3ff", bbox=box, arrowprops=arrow)
    base_peak_index = 100 * base["summary"]["peakPrice"] / current
    ax.annotate(f"기본 최고가 가정 · {base_peak_index:.1f}\n{base['summary']['peakDate']} · ${base['summary']['peakPrice']:,.0f}",
                xy=(day(base["summary"]["peakDate"]), base_peak_index),
                xytext=(day("2029-01-20"), 311), fontsize=9.5, color=COLORS["base"],
                bbox={**box, "ec": "#7f5b34"}, arrowprops={**arrow, "color": COLORS["base"]})
    stress_low = next(event for event in scenarios["stress"]["events"] if event["id"] == "stress-low")
    stress_index = 100 * stress_low["price"] / current
    ax.scatter(day(stress_low["date"]), stress_index, s=34, marker="v", color=COLORS["stress"],
               edgecolors="#0b1221", linewidths=0.7, zorder=7)
    ax.annotate(f"스트레스 저점 가정\n{stress_low['date']} · {stress_index:.1f}",
                xy=(day(stress_low["date"]), stress_index), xytext=(day("2027-04-01"), 48.8),
                fontsize=9.4, color=COLORS["stress"], bbox=box, arrowprops=arrow)
    ax.text(day("2027-03-01"), 331, f"명목 시계: {model['nominalClock']['nominalTroughDate']} 저점 → {model['nominalClock']['nominalPeakDate']} 고점",
            fontsize=9.7, color="#92a6c3", va="center")

    tick_dates = ["2025-07-01", "2026-01-01", "2026-07-01", "2027-01-01", "2027-07-01", "2028-01-01", "2028-07-01", "2029-01-01", "2029-07-01"]
    ax.xaxis.set_major_locator(FixedLocator([mdates.date2num(day(value)) for value in tick_dates]))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y.%m"))
    ax.tick_params(axis="both", labelsize=9.6, length=3.5, pad=6)
    ax.yaxis.set_major_locator(FixedLocator([50, 75, 100, 150, 200, 300]))
    ax.yaxis.set_major_formatter(ScalarFormatter())
    ax.yaxis.set_minor_locator(NullLocator())
    ax.set_ylabel("상대 가격 · 현재 = 100 / 로그축", fontsize=10.0, labelpad=10)

    handles = [Line2D([0], [0], color="#edf3ff", lw=1.8, label="실제 관측 · UTC 일말")]
    handles += [Line2D([0], [0], color=COLORS[key], lw=1.7, linestyle=STYLES[key], label=LABELS[key]) for key in COLORS]
    handles += [Patch(facecolor=COLORS["base"], edgecolor="none", alpha=0.22, label="기본 가격 감도 ±25% · 확률 아님")]
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(-0.004, 1.018), ncol=4,
              frameon=False, fontsize=9.0, labelcolor="#b8c7dd", handlelength=2.8,
              columnspacing=1.65, handletextpad=0.55, borderaxespad=0, labelspacing=0.7)
    fig.text(0.068, 0.416,
             f"관측 후보 저점 뒤 {model['observables']['recoveryDays']}일 동안 +{model['observables']['recoveryPct']:.2f}% 회복. 점선의 소파동은 설명용 연결이며 날짜별 수익률 예측이 아닙니다.",
             fontsize=9.8, color="#a3b5cf")

    fig.text(0.057, 0.386, "시나리오별 주요 날짜", fontsize=12, fontweight="bold")
    fig.text(0.973, 0.385, f"A: 도달 선행 개월  /  D: 고점 형성 개월  ·  (범위 밖) = {model['displayEnd']} 이후", fontsize=9.3,
             ha="right", color="#9fb1ca")
    table_ax = fig.add_axes([0.055, 0.185, 0.92, 0.184])
    table_ax.axis("off")
    rows = []
    for scenario_id in COLORS:
        scenario = scenarios[scenario_id]
        timing = scenario["timing"]
        values = []
        for key in ("zoneEntryDate", "effectivePeakDate", "nextLowDate"):
            date = timing[key]
            values.append(date + ("  (범위 밖)" if date > model["displayEnd"] else ""))
        rows.append([TABLE_LABELS[scenario_id], f"{timing['arrivalLeadMonths']} / {timing['dwellMonths']}", *values])
    table = table_ax.table(cellText=rows, colLabels=["시간 가정", "A / D", "고점권 최초 도달", "최고가 전환", "그 고점 12개월 후 저점"],
                           colWidths=[0.236, 0.08, 0.205, 0.224, 0.255], loc="center", cellLoc="center", bbox=[0, 0, 1, 1])
    table.auto_set_font_size(False)
    table.set_fontsize(9.6)
    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#30415b")
        cell.set_linewidth(0.55)
        cell.PAD = 0.035
        if row == 0:
            cell.set_facecolor("#1b2b43")
            cell.get_text().set_color("#dbe6f6")
            cell.get_text().set_fontweight("bold")
        else:
            cell.set_facecolor("#121e30" if row % 2 else "#101a2a")
            cell.get_text().set_color("#bdcce1" if col > 0 else COLORS[list(COLORS)[row - 1]])
        if col == 0:
            cell.get_text().set_ha("left")
            cell.PAD = 0.055

    fig.text(0.058, 0.151,
             "수학적 관계: 도달일 = 명목 고점 - A  /  최고점 = 명목 고점 + (D - A).  A = D이면 도달만 빨라지고 최고점은 유지됩니다.",
             fontsize=10.1, color="#d8e2f2")
    fig.text(0.058, 0.124,
             "D는 연속 95% 이상 체류가 아닙니다. 기본 g=0.75, 최고가 ±25%, 이후 낙폭 50%, 스트레스 후보 이탈 15%는 모두 편집 가능한 가정입니다.",
             fontsize=9.5, color="#a3b5ce")
    fig.text(0.058, 0.097,
             "명목 ‘약 3년 상승 · 약 1년 하락’을 둔 민감도 모형입니다. 항등식과 양수·연속 경로를 검증한 것이며 미래 시장 법칙을 증명한 것은 아닙니다.",
             fontsize=9.5, color="#a3b5ce")
    final_validation = next(item for item in model["validation"]["summary"] if item["horizonMonths"] == 36)
    fig.text(0.058, 0.067,
             f"검증 한계: 과거 기준점 2개 · 사후 설계. 36개월 MAPE 모형 {final_validation['scenarioMAPEPct']:.2f}% / 현재가격 고정 {final_validation['flatMAPEPct']:.2f}%. 가격 예측력은 입증되지 않았습니다.",
             fontsize=9.6, color="#e6bba5")
    fig.text(0.058, 0.036,
             "데이터: Coin Metrics Community API · PriceUSD (UTC 일말)  |  계산: THREE_YEAR_RESULTS.json / outlook-engine.js",
             fontsize=9.0, color="#8398b6")
    fig.text(0.058, 0.016,
             "출처: https://community-api.coinmetrics.io  ·  https://docs.coinmetrics.io  |  선·음영은 모두 동일 모형의 가정 조합이며 독립 예측들의 합의가 아닙니다.",
             fontsize=9.0, color="#8398b6")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.output, dpi=150, metadata={
        "Title": "Bitcoin three-year conditional outlook",
        "Description": "UTC data through 2026-10-20. Daily conditional paths from THREE_YEAR_RESULTS.json. Sensitivity bands are assumptions, not prediction intervals.",
        "Source": "Coin Metrics Community API PriceUSD; outlook-engine.js three-year-outlook-v1",
    })
    plt.close(fig)
    print(json.dumps({"output": str(args.output), "width": 2200, "height": 1500, "asOf": model["asOf"], "displayEnd": model["displayEnd"], "scenarios": len(scenarios)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
