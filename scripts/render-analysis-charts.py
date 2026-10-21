#!/usr/bin/env python3
"""Render the two publication figures directly from the saved model results.

Run from any directory. Requires matplotlib and a Korean font.
Outputs default to the repository's build/ directory (or BCA_OUTPUT_DIR).
Uses installed Korean fonts; set BCA_FONT_DIR to use a font directory instead.
No generated or invented observed price data.
Future curves are the forecast model's expressly conditional interpolations.
"""
import datetime as dt
import json
import os
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = Path(os.environ.get("BCA_OUTPUT_DIR") or PROJECT / "build").expanduser()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(PROJECT / "build/.matplotlib"))

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ft2font import FT2Font
from matplotlib.lines import Line2D
from matplotlib.patches import Patch
from matplotlib.ticker import FuncFormatter

def register_font(font_dir=None):
    guidance = (
        "Install Nanum Gothic or Noto Sans CJK, or set BCA_FONT_DIR to a directory "
        "containing Korean .ttf/.otf/.ttc fonts."
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


FAMILY = register_font(os.environ.get("BCA_FONT_DIR") or None)
plt.rcParams.update({
    "font.family": FAMILY, "font.size": 17, "axes.unicode_minus": False,
    "figure.facecolor": "white", "axes.facecolor": "white", "savefig.facecolor": "white",
    "text.color": "#1d2c3b", "axes.labelcolor": "#1d2c3b", "xtick.color": "#52606e",
    "ytick.color": "#52606e", "axes.edgecolor": "#bfc8cf", "axes.titleweight": "bold",
    "axes.labelsize": 17, "xtick.labelsize": 15, "ytick.labelsize": 16,
    "legend.frameon": False, "legend.fontsize": 15,
})

INK = "#253a4e"
MUTED = "#596879"
GOLD = "#b67a14"
LIGHT_GOLD = "#f1dfb8"
TEAL = "#087d77"
GRID = "#e6ebef"
DATE = dt.date.fromisoformat


def read_json(name):
    return json.loads((PROJECT / name).read_text())


def style_axes(ax, grid="y"):
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis=grid, color=GRID, lw=.8, zorder=0)
    ax.set_axisbelow(True)
    ax.tick_params(axis="both", length=0, pad=9)


def dollars_k(value, _):
    return f"${value / 1000:,.0f}k"


def callout(ax, text, xy, xytext, color=INK, ha="left", size=17):
    return ax.annotate(
        text, xy=xy, xytext=xytext, textcoords="data", ha=ha, va="center",
        fontsize=size, color=color, linespacing=1.45,
        bbox={"boxstyle": "round,pad=.35", "fc": "white", "ec": "none", "alpha": .97},
        arrowprops={"arrowstyle": "-", "color": color, "lw": 1.15, "shrinkA": 6, "shrinkB": 5},
        annotation_clip=False, zorder=8,
    )


def peak_figure(peak, prices):
    fig = plt.figure(figsize=(14, 12.4), dpi=200)
    fig.text(.075, .962, "7월에 고점권 도달, 10월에 최고가", fontsize=29, weight="bold")
    fig.text(.075, .927, "첫 진입 · 머문 시간 · 절대 최고가를 나누어 본 2025년 고점 형성", fontsize=18, color=MUTED)

    ax = fig.add_axes([.085, .505, .855, .355])
    style_axes(ax)
    series = [(DATE(date), value) for date, value in prices if "2025-07-01" <= date <= "2025-10-31"]
    peak_point = peak["current"]["peak"]
    peak_price = peak_point["price"]
    q95 = peak["current"]["firstEntry"]
    july = peak["july2025"]
    ax.axhspan(.90 * peak_price, peak_price, color=LIGHT_GOLD, alpha=.24, zorder=0)
    ax.axhspan(.95 * peak_price, peak_price, color=LIGHT_GOLD, alpha=.45, zorder=0)
    ax.plot([p[0] for p in series], [p[1] for p in series], color=INK, lw=2.25, zorder=3)
    for q, dash in [(.90, (0, (3, 4))), (.95, (0, (7, 4)))]:
        ax.axhline(q * peak_price, color=GOLD, lw=1.4, ls=dash, alpha=.85)
        ax.text(DATE("2025-10-29"), q * peak_price + 620,
                f"{q:.0%}  ${q * peak_price:,.0f}", ha="right", va="bottom", color=GOLD,
                fontsize=16, bbox={"fc": "white", "ec": "none", "pad": 2, "alpha": .9})
    ax.scatter(DATE(q95["date"]), q95["price"], s=100, marker="D", facecolor="white", edgecolor=GOLD, lw=2.2, zorder=7)
    ax.scatter(DATE(july["date"]), july["price"], s=108, color=GOLD, edgecolor="white", lw=1.5, zorder=7)
    ax.scatter(DATE(peak_point["date"]), peak_price, s=150, marker="^", color=GOLD, edgecolor="white", lw=1.5, zorder=7)
    callout(ax, "95% 첫 진입  07.13\n최고가보다 85일 먼저",
            (DATE(q95["date"]), q95["price"]), (DATE("2025-07-04"), 103900), GOLD, size=17)
    callout(ax, f"7월 최고가  07.22\n${july['price']:,.0f} · 최종의 {july['pctOfPeak']:.2f}%",
            (DATE(july["date"]), july["price"]), (DATE("2025-07-24"), 130000), GOLD, size=17)
    callout(ax, f"관측 최고가  10.06\n${peak_price:,.0f}",
            (DATE(peak_point["date"]), peak_price), (DATE("2025-10-27"), 130000), GOLD, ha="right", size=17)
    ax.set_ylim(100000, 134000)
    ax.set_xlim(DATE("2025-07-01"), DATE("2025-10-31"))
    ax.set_yticks([100000, 110000, 120000, 130000])
    ax.yaxis.set_major_formatter(FuncFormatter(dollars_k))
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("2025.%m"))
    ax.set_ylabel("BTC 가격 · USD", labelpad=12)
    ax.set_title("A  |  7월 최고가 이후 남은 상승은 3.96%", loc="left", fontsize=20, pad=19)
    fig.text(.085, .456,
             "7/10~10/6의 89일 중 90% 고점권 체류 69일(77.53%)  ·  구간 내 최대 낙폭 -12.25%",
             fontsize=16, color=INK)

    bx = fig.add_axes([.085, .160, .855, .215])
    style_axes(bx)
    sensitivity = peak["sensitivity"]
    x = list(range(len(sensitivity)))
    width = .32
    h_values = [s["leadDays"] for s in sensitivity]
    cal_values = [s["calendarLeadDays"] for s in sensitivity]
    bx.bar([i - width / 2 for i in x], h_values, width, color=INK, label="반감기 시계 · 최근 두 회차 중앙값", zorder=3)
    bx.bar([i + width / 2 for i in x], cal_values, width, color=GOLD, label="달력 시계 · 직전 사건 +4년", zorder=3)
    bx.axhline(0, color="#8c98a3", lw=1.3, zorder=2)
    for offset, values in [(-width / 2, h_values), (width / 2, cal_values)]:
        for i, value in enumerate(values):
            bx.text(i + offset, value + (6 if value >= 0 else -7), f"{value:+g}",
                    ha="center", va="bottom" if value >= 0 else "top", fontsize=17, weight="bold")
    bx.set_xticks(x, [f"{s['threshold']:.0%}" for s in sensitivity])
    bx.set_xlim(-.6, 4.6)
    bx.set_ylim(-150, 139)
    bx.set_yticks([-100, -50, 0, 50, 100])
    bx.set_ylabel("앞당김 · 일", labelpad=10, fontsize=16)
    bx.set_xlabel("사후 최고가 대비 고점권 기준", labelpad=12, fontsize=16)
    bx.set_title("B  |  같은 기준을 적용해도 앞당김의 크기는 달라집니다", loc="left", fontsize=20, pad=44)
    bx.legend(loc="lower left", bbox_to_anchor=(-.004, 1.01), ncol=2, fontsize=14.5, handlelength=1.7, columnspacing=2)
    bx.text(.995, 1.065, "양수: 빠름 / 음수: 늦음", transform=bx.transAxes,
            ha="right", va="center", fontsize=13, color=MUTED)

    fig.text(.085, .080, "2021년 봄 고점은 최종의 93.9354%: 93%에는 포함, 94%부터 제외되어 결론이 바뀝니다.", fontsize=16, color=INK)
    fig.text(.085, .050, "95% 첫 진입: 달력 98일(3.22개월) / 반감기 76.5일(2.51개월) 선행. 절대 최고가는 반감기 기준 1.5일 선행.", fontsize=14, color=MUTED)
    fig.text(.085, .020, f"출처: Coin Metrics PriceUSD · 자체 계산  |  기준: {peak['asOf']} UTC 일말  |  고점권은 최종 관측 최고가를 사용하는 사후 정의", fontsize=12.5, color=MUTED)
    output = OUTPUT_DIR / "Bitcoin_Peak_Zone_Analysis.png"
    staged = output.with_suffix('.rendering.png')
    fig.savefig(staged, dpi=200)
    staged.replace(output)
    plt.close(fig)
    return output


def forecast_figure(forecast, prices):
    assert forecast["methodology"]["highZoneFraction"] == .95, "Figure requires the saved 95% model"
    scenarios = forecast["macro"]["scenarios"]
    main = next(s for s in scenarios if s["id"] == "bottom-holds")
    model = forecast["macro"]["priceModel"]
    current = forecast["current"]
    as_of = DATE(forecast["asOf"])
    fig = plt.figure(figsize=(14, 14.6), dpi=200)
    fig.text(.080, .969, "앞으로의 고점·저점은 조건별 날짜창으로", fontsize=28, weight="bold")
    fig.text(.080, .937, "기본 시나리오: 2026.06.30 저점 유지 + 과거 회복 기간 반복  |  고점권 기준 95%", fontsize=17, color=MUTED)

    ax = fig.add_axes([.090, .526, .845, .350])
    style_axes(ax)
    observed = [(DATE(date), value) for date, value in prices if "2025-01-01" <= date <= forecast["asOf"]]
    ax.plot([p[0] for p in observed], [p[1] for p in observed], color=INK, lw=2.0, zorder=5)
    path = main["path"]
    xs = [DATE(p["date"]) for p in path]
    ax.fill_between(xs, [p["low"] for p in path], [p["high"] for p in path], color=LIGHT_GOLD, alpha=.62, lw=0, zorder=1)
    ax.plot(xs, [p["price"] for p in path], color=GOLD, lw=2.15, ls=(0, (6, 4)), zorder=4)
    ax.axvline(as_of, color="#7c8995", ls=(0, (2, 4)), lw=1.1)
    ax.text(as_of - dt.timedelta(days=15), 248000, "관측", color=INK, ha="right", fontsize=15)
    ax.text(as_of + dt.timedelta(days=22), 248000, "가정", color=GOLD, ha="left", fontsize=15)
    for key, color in [("highZoneWindow", GOLD), ("peakWindow", GOLD), ("troughWindow", TEAL)]:
        window = main[key]
        ax.axvspan(DATE(window["startDate"]), DATE(window["endDate"]), color=color, alpha=.08, lw=0, zorder=0)
    anchors = {p["type"]: p for p in main["anchors"]}
    for kind, marker, color in [("high-zone", "D", GOLD), ("peak", "^", GOLD), ("trough", "v", TEAL)]:
        a = anchors[kind]
        ax.scatter(DATE(a["date"]), a["price"], s=115, marker=marker,
                   facecolor="white" if kind == "high-zone" else color, edgecolor=color, lw=1.8, zorder=7)
    for kind, color in [("peak", GOLD), ("trough", TEAL)]:
        a = anchors[kind]
        ax.errorbar(DATE(a["date"]), a["price"], yerr=[[a["price"] - a["low"]], [a["high"] - a["price"]]],
                    fmt="none", ecolor=color, elinewidth=1.4, capsize=5, alpha=.8, zorder=3)
    ax.scatter(as_of, current["price"], s=65, color=INK, edgecolor="white", lw=1, zorder=7)
    old_peak, old_low = current["peak"], current["troughCandidate"]
    ax.scatter(DATE(old_peak["date"]), old_peak["price"], s=80, marker="^", color=GOLD, zorder=7)
    ax.scatter(DATE(old_low["date"]), old_low["price"], s=80, marker="v", color=TEAL, zorder=7)
    callout(ax, "관측 고점 2025.10.06\n$124,824", (DATE(old_peak["date"]), old_peak["price"]),
            (DATE("2025-02-10"), 173000), GOLD, size=15)
    callout(ax, "저점 후보 2026.06.30\n$58,525", (DATE(old_low["date"]), old_low["price"]),
            (DATE("2025-02-10"), 28000), TEAL, size=15)
    callout(ax, f"기준일 ${current['price']:,.0f}", (as_of, current["price"]),
            (DATE("2027-02-01"), 52000), INK, size=15)
    callout(ax, "95% 고점권\n2029.02.28~03.08", (DATE(anchors["high-zone"]["date"]), anchors["high-zone"]["price"]),
            (DATE("2027-03-15"), 218000), GOLD, size=17)
    callout(ax, "최고값 후보 2029.05.24~06.01\n가정 가격 $170k~231k", (DATE(anchors["peak"]["date"]), anchors["peak"]["price"]),
            (DATE("2029-07-15"), 253000), GOLD, ha="center", size=16)
    callout(ax, "저점 후보 2030.05.23~07.12\n가정 가격 $26k~108k", (DATE(anchors["trough"]["date"]), anchors["trough"]["price"]),
            (DATE("2030-08-05"), 146000), TEAL, ha="right", size=16)
    ax.set_xlim(DATE("2025-01-01"), DATE("2030-09-01"))
    ax.set_ylim(12000, 275000)
    ax.set_yticks([50000, 100000, 150000, 200000, 250000])
    ax.yaxis.set_major_formatter(FuncFormatter(dollars_k))
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.set_ylabel("BTC 가격 · USD", labelpad=12)
    handles = [
        Line2D([0], [0], color=INK, lw=2.2, label="관측 가격"),
        Line2D([0], [0], color=GOLD, lw=2, ls=(0, (6, 4)), label="앵커 사이 로그 보간"),
        Patch(facecolor=LIGHT_GOLD, alpha=.7, label="가정 가격 민감도"),
    ]
    ax.legend(handles=handles, loc="lower left", bbox_to_anchor=(-.005, 1.035), ncol=3, fontsize=15, columnspacing=1.8)

    fig.text(.090, .470, "같은 관측에서 출발하는 다섯 가지 날짜 시나리오", fontsize=21, weight="bold")
    fig.text(.090, .440, "◇ 95% 고점권    ▲ 최고값 후보    ▼ 저점 후보     ·     달력 이동은 추가 가정이며 확률 순위가 아닙니다.", fontsize=14.5, color=MUTED)
    bx = fig.add_axes([.195, .198, .740, .215])
    style_axes(bx, grid="x")
    labels = {
        "bottom-holds": "저점 유지\n과거 기간 반복",
        "calendar-48m": "관측 사건\n+48개월",
        "calendar-minus-3m": "48개월 기준\n추가 -3개월",
        "calendar-minus-4m": "48개월 기준\n추가 -4개월",
        "calendar-minus-5m": "48개월 기준\n추가 -5개월",
    }
    for i, scenario in enumerate(scenarios):
        y = 4 - i
        first, last = scenario["highZoneWindow"], scenario["troughWindow"]
        bx.plot([DATE(first["centerDate"]), DATE(last["centerDate"])], [y, y], color="#d9e0e5", lw=1.2, zorder=1)
        for key, marker, color in [("highZoneWindow", "D", GOLD), ("peakWindow", "^", GOLD), ("troughWindow", "v", TEAL)]:
            window = scenario[key]
            center = DATE(window["centerDate"])
            if window["startDate"] != window["endDate"]:
                bx.plot([DATE(window["startDate"]), DATE(window["endDate"])], [y, y], color=color, lw=5.5, alpha=.3, solid_capstyle="round", zorder=2)
            bx.scatter(center, y, s=95, marker=marker, facecolor="white" if key == "highZoneWindow" else color,
                       edgecolor=color, lw=1.7, zorder=4)
            bx.text(center, y - .22, center.strftime("%Y.%m.%d"), color=color, ha="center", va="top", fontsize=13.5)
    bx.set_xlim(DATE("2029-01-01"), DATE("2030-08-25"))
    bx.set_ylim(-.58, 4.56)
    bx.set_yticks([4, 3, 2, 1, 0], [labels[s["id"]] for s in scenarios])
    bx.tick_params(axis="y", labelsize=15, pad=16)
    bx.xaxis.set_major_locator(mdates.MonthLocator(bymonth=[1, 4, 7, 10]))
    bx.xaxis.set_major_formatter(mdates.DateFormatter("%Y.%m"))
    bx.tick_params(axis="x", labelsize=13, pad=11)
    bx.spines["left"].set_visible(False)

    fig.text(.080, .139, "날짜창: 과거 저점→다음 고점 1,059~1,067일의 3개 사례 범위입니다. 좁은 8일 폭은 정밀 예측을 뜻하지 않습니다.", fontsize=13.5, color=INK)
    fig.text(.080, .112, f"대표선: a={model['representativeAlpha']:.2f}, 2022년 하락 후 잔존 비율 r={model['representativeRetention']:.4f}. 고점 $170k~231k는 전고점 갱신 가정입니다.", fontsize=13.5, color=INK)
    fig.text(.080, .085, "저점 $26k~108k는 넓은 가정 민감도입니다. 이번처럼 267일 하락을 반복하는 별도 저점창은 2030.02.15~02.23입니다.", fontsize=13.5, color=INK)
    fig.text(.080, .058, "점선은 가정 앵커 사이의 연결 도식입니다. 중간 날짜의 가격 예측 또는 확률구간이 아닙니다. 저점이 깨지면 다시 계산합니다.", fontsize=13.5, color=INK)
    fig.text(.080, .027, f"출처: Coin Metrics PriceUSD · 자체 계산  |  기준: {forecast['asOf']} UTC 일말  |  가격과 날짜 모두 조건부 가정이며 실제 결과는 범위를 벗어날 수 있습니다.", fontsize=12.3, color=MUTED)
    output = OUTPUT_DIR / "Bitcoin_Cycle_Forecast.png"
    staged = output.with_suffix('.rendering.png')
    fig.savefig(staged, dpi=200)
    staged.replace(output)
    plt.close(fig)
    return output


def main():
    peak = read_json("docs/PEAK_ZONE_RESULTS.json")
    forecast = read_json("docs/FORECAST_RESULTS.json")
    data = read_json("dist/data/btc-daily.json")
    assert peak["asOf"] == forecast["asOf"]
    assert peak["threshold"] == .95 and peak["baseline"] == "recent2"
    outputs = [peak_figure(peak, data["prices"]), forecast_figure(forecast, data["prices"])]
    print(json.dumps({"asOf": peak["asOf"], "outputs": [str(p) for p in outputs], "renderer": "matplotlib", "widthPixels": 2800}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
