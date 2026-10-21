#!/usr/bin/env python3
"""Render exact saved daily conditional paths and the full 2010–2029 chart.

Requires matplotlib and an installed Korean font or --font-dir. No network,
refitting, interpolation of prices, or image-generation service is used.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import os
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('MPLCONFIGDIR', str(ROOT / 'build/.matplotlib'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter, FixedLocator, NullLocator
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

spec = importlib.util.spec_from_file_location('existing_chart', ROOT / 'scripts/render-three-year-chart.py')
fonts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fonts)
day = lambda s: datetime.strptime(s, '%Y-%m-%d')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT/'build/Bitcoin_Detailed_Outlook.png')
    parser.add_argument('--font-dir', type=Path, default=os.environ.get('BCA_FONT_DIR'))
    args=parser.parse_args()
    payload=json.loads((ROOT/'docs/DETAILED_FORECAST_RESULTS.json').read_text())
    data=json.loads((ROOT/'dist/data/btc-daily.json').read_text())
    model=next(s for s in payload['scenarios'] if s['scenario']['id']=='base')
    plt.rcParams.update({'font.family':fonts.register_font(args.font_dir),'axes.unicode_minus':False,'font.size':10,'text.color':'#dfe6ef','axes.labelcolor':'#a8b5c8','xtick.color':'#9dabbe','ytick.color':'#9dabbe'})
    fig=plt.figure(figsize=(14,10),dpi=160,facecolor='#0d131c')
    fig.text(.06,.965,'비트코인 · 앞으로의 3년',fontsize=23,fontweight='bold',va='top')
    fig.text(.94,.963,'조건부 모의 경로 · 예측 우위 미확인',ha='right',fontsize=11,color='#e3b77a',va='top')
    low=model['diagnostics']['firstTurnWindows']['low']; high=model['diagnostics']['firstTurnWindows']['high']
    next_date=low['medianDate']; days=(day(next_date)-day(model['referenceDate'])).days
    fig.text(.06,.916,f"다음 저점 후보  {next_date}  ·  D-{days}  |  모의 후보 구간 {low['lowerDate']} — {low['upperDate']}",fontsize=12,color='#a7c9e5')
    fig.text(.06,.891,f"현재 $82,899  ·  좁은 횡보  |  다음 고점 후보 중앙일 {high['medianDate']}  |  기준 {model['referenceDate']} KST / 마지막 가격 {model['asOf']} UTC",fontsize=9.8,color='#a2adbd')
    ax=fig.add_axes([.075,.43,.87,.405],facecolor='#111923')
    dd=fig.add_axes([.075,.32,.87,.087],facecolor='#111923',sharex=ax)
    full=fig.add_axes([.075,.115,.87,.145],facecolor='#111923')
    for panel in [ax,dd,full]:
        for spine in panel.spines.values():spine.set_color('#2a3544');spine.set_linewidth(.6)
        panel.grid(color='#3c4b61',alpha=.3,linewidth=.6)
        panel.tick_params(labelsize=9,length=0,pad=7)
    paths=model['path']; future_dates=[day(p['date']) for p in paths]
    actual=[(day(d),p) for d,p in data['prices'] if '2025-10-01'<=d<=model['asOf']]
    ax.plot([d for d,p in actual],[p for d,p in actual],color='#dce5f1',lw=1.3,label='관측 · UTC 일말')
    ax.fill_between(future_dates,[p['lower'] for p in paths],[p['upper'] for p in paths],color='#e9a952',alpha=.13,lw=0)
    ax.plot(future_dates,[p['price'] for p in paths],color='#f2b15a',lw=1.2,ls=(0,(4,2)),label='대표 모의 경로')
    for kind,col in [('high','#e9be7e'),('low','#8cb7d5')]:
        points=[p for p in model['localTurns'] if p['type']==kind]
        ax.scatter([day(p['date']) for p in points],[p['price'] for p in points],s=14,facecolors='#111923',edgecolors=col,lw=.8,zorder=4)
    ax.set_yscale('log');ax.set_xlim(day('2025-10-01'),day(model['displayEnd']));ax.set_ylim(40000,max(p['upper'] for p in paths)*1.2)
    ax.yaxis.set_major_locator(FixedLocator([50000,100000,200000,400000]));ax.yaxis.set_major_formatter(FuncFormatter(lambda y,_:f'${y/1000:,.0f}k'));ax.yaxis.set_minor_locator(NullLocator())
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=6));ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y.%m'));plt.setp(ax.get_xticklabels(),visible=False)
    ax.axvline(day(model['asOf']),color='#7d91ac',lw=.9,ls=(0,(3,4)))
    ax.axvspan(day(low['lowerDate']),day(low['upperDate']),color='#8bb3dd',alpha=.04)
    ax.axvline(day(next_date),color='#a4c5e7',lw=.9,ls=(0,(3,5)))
    ax.annotate(f'다음 저점 후보\nD-{days}',xy=(day(next_date),95000),xytext=(day('2027-02-10'),140000),fontsize=10,color='#b1d1ed',arrowprops={'arrowstyle':'-','color':'#91adcc','lw':.8})
    for i,event in enumerate(e for e in model['events'] if e['inHorizon']):
        ax.axvline(day(event['date']),color='#a18e73',alpha=.55,lw=.7,ls=(0,(2,4)))
        ax.annotate(event['label']+'\n'+event['date'],xy=(day(event['date']),event['price']),xytext=(-7,-37-32*(i%2)),textcoords='offset points',ha='right',color='#baa58a',fontsize=9)
    dd_values=[];running=0
    for d,p in data['prices']:
        running=max(running,p)
        if d>='2025-10-01':dd_values.append((day(d),(p/running-1)*100))
    dd.plot([d for d,v in dd_values],[v for d,v in dd_values],color='#a9b8ce',lw=.8)
    dd.plot(future_dates,[p['athDrawdownPct'] for p in paths],color='#d5a66c',lw=.8)
    dd.set_ylim(-65,3);dd.set_yticks([-50,-25,0]);dd.yaxis.set_major_formatter(FuncFormatter(lambda y,_:f'{y:.0f}%'))
    dd.set_title('전고점 대비 낙폭 · 일말 기준',fontsize=9.5,color='#a4b2c4',loc='left',pad=7)
    handles=[Line2D([0],[0],color='#dce5f1',lw=1.3,label='실제 관측'),Line2D([0],[0],color='#f2b15a',lw=1.3,ls='--',label='대표 모의 경로'),Patch(facecolor='#e9a952',alpha=.25,label='10–90% 조건부 경로 범위')]
    ax.legend(handles=handles,loc='upper left',frameon=False,fontsize=9.5,ncol=3,labelcolor='#b7c4d5')
    full.set_title('전체 차트 · 2010년부터 향후 3년까지',fontsize=11,loc='left',pad=10,color='#d7e0eb')
    full.plot([day(d) for d,p in data['prices']],[p for d,p in data['prices']],color='#c9d6e6',lw=.85)
    full.fill_between(future_dates,[p['lower'] for p in paths],[p['upper'] for p in paths],color='#e9a952',alpha=.15,lw=0)
    full.plot(future_dates,[p['price'] for p in paths],color='#f2b15a',lw=.9,ls='--')
    full.axvline(day(model['asOf']),color='#8a9db7',ls='--',lw=.7)
    full.axvline(day(next_date),color='#9ebfe1',ls=':',lw=.7)
    full.set_yscale('log');full.set_xlim(day('2010-07-18'),day(model['displayEnd']))
    full.yaxis.set_major_locator(FixedLocator([1,100,10000,1000000]));full.yaxis.set_major_formatter(FuncFormatter(lambda y,_:f'${y:,.0f}'));full.yaxis.set_minor_locator(NullLocator())
    full.xaxis.set_major_locator(mdates.YearLocator(2));full.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))
    fig.text(.06,.053,'후보일은 128개 조건부 경로의 첫 12% 전환점 날짜 중앙값이며 확정 일정이 아닙니다. 실제 확인에는 이후 반대 방향 움직임이 필요합니다.',fontsize=9.1,color='#a3afc0')
    fig.text(.06,.032,'가격·시간 범위는 확률 보정 전입니다. 과거 3년 검증 MAPE: 모형 203.09% / 가격 유지 86.25% (6기점, 2회차).  Data © Coin Metrics · CC BY-NC 4.0',fontsize=8.8,color='#93a1b4')
    args.output.parent.mkdir(parents=True,exist_ok=True);fig.savefig(args.output,dpi=160,facecolor=fig.get_facecolor());plt.close(fig)
    print(json.dumps({'file':str(args.output),'width':2240,'height':1600,'model':model['version'],'nextLowMedian':next_date,'daysFromReference':days}))

if __name__=='__main__':main()
