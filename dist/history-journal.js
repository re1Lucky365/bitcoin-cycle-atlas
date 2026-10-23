import { chartBottomBarFor } from './chart-bottom-bar.js?v=1.14.0-mobile.1';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/** The timeline is a disclosure above the shared footer, not another chart row. */
export function mountHistoryJournal({stage,events,categories,colors,onEvent,openReader,bottomBar=chartBottomBarFor(stage)}){
  const bar=bottomBar;if(!bar)throw new Error('The chart bottom bar must be mounted before its history journal');
  const doc=stage.ownerDocument,win=doc.defaultView||globalThis,make=(tag,className,text)=>{const node=doc.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const toggle=make('button','workbench-history-toggle');toggle.id='history-journal-toggle';toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','history-journal');toggle.setAttribute('aria-haspopup','dialog');
  const chevron=make('span','journal-chevron','⌃'),name=make('span','','사건'),count=make('span','journal-count',String(events.length));chevron.setAttribute('aria-hidden','true');toggle.append(chevron,name,count);bar.eventSlot.append(toggle);
  const journal=make('section','history-journal history-journal-popover chart-bottom-popover');journal.id='history-journal';journal.hidden=true;journal.setAttribute('role','dialog');journal.setAttribute('aria-modal','false');journal.setAttribute('aria-labelledby','history-journal-title');
  const heading=make('div','journal-popover-heading'),title=make('strong','','주요 사건');title.id='history-journal-title';
  const closeButton=make('button','journal-popover-close','×');closeButton.type='button';closeButton.title='주요 사건 접기';closeButton.setAttribute('aria-label',closeButton.title);heading.append(title,closeButton);
  const context=make('p','journal-context');context.id='journal-context';
  const items=make('div','journal-items');items.id='history-journal-items';
  const links=make('div','journal-popover-actions');
  const all=make('button','','검색·전체 목록'),volume=make('button','','거래량 출처');all.id='history-journal-all';volume.id='history-volume-source';for(const node of [all,volume])node.type='button';links.append(all,volume);
  journal.append(heading,context,items,links);stage.append(journal);
  let state=null,asOf='9999-12-31',visible=[],renderedKey=null,destroyed=false;
  function close(focus=false){if(journal.hidden)return;journal.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
  function openPanel(kind,opener){close();openReader(kind,{focus:true,opener});}
  const allMenu=bar.addAction({id:'workbench-bottom-events',label:'사건 검색·전체 목록',onActivate:opener=>openPanel('events',opener)});
  const volumeMenu=bar.addAction({id:'workbench-bottom-volume',label:'거래량 출처',onActivate:opener=>openPanel('volume',opener)});
  all.onclick=()=>openPanel('events',toggle);volume.onclick=()=>openPanel('volume',toggle);
  function paintItems(){
    const key=visible.map(event=>event.id).join('|');if(key===renderedKey)return;renderedKey=key;
    const focused=items.contains(doc.activeElement)?doc.activeElement?.dataset?.historyJump:null;
    items.innerHTML=visible.length?visible.map(event=>`<button type="button" class="journal-event" data-history-jump="${esc(event.id)}" style="--event-color:${colors[event.category]}"><time>${event.date}</time><strong>${esc(event.label)}</strong><span>${esc(categories[event.category])}</span></button>`).join(''):'<p>이 기간에는 기록된 사건이 없습니다. 검색·전체 목록에서 다른 날짜를 선택하세요.</p>';
    if(focused)(items.querySelector(`[data-history-jump="${focused}"]`)||all).focus({preventScroll:true});
  }
  function open(){
    if(destroyed||toggle.hidden)return;if(!journal.hidden){close(true);return;}
    const Event=win.CustomEvent||globalThis.CustomEvent;if(Event)doc.dispatchEvent(new Event('atlas:modal-open',{detail:{id:journal.id}}));
    paintItems();journal.hidden=false;toggle.setAttribute('aria-expanded','true');(items.querySelector('button')||all).focus({preventScroll:true});
  }
  toggle.onclick=open;closeButton.onclick=()=>close(true);
  const onItem=event=>{const node=event.target.closest?.('[data-history-jump]');if(node){close(true);onEvent(node.dataset.historyJump);}};
  const onKey=event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close(true);}};
  const dismiss=event=>{if(!journal.hidden&&!journal.contains(event.target)&&!toggle.contains(event.target))close();};
  const onModal=event=>{if(event.detail?.id!==journal.id)close();},onPanel=event=>{if(event.detail?.open)close();},onResize=()=>close();
  items.addEventListener('click',onItem);journal.addEventListener('keydown',onKey);doc.addEventListener('pointerdown',dismiss,true);doc.addEventListener('focusin',dismiss);doc.addEventListener('atlas:modal-open',onModal);doc.addEventListener('atlas:panel-state',onPanel);win.addEventListener?.('resize',onResize);
  function update(next){
    state=next||state;const price=!state||state.mode==='price';toggle.hidden=!price;if(!price)close();
    if(state?.asOf)asOf=state.asOf;
    const allEvents=events.filter(event=>event.date<=asOf),range=state&&!state.intraday&&typeof state.start==='string'?{start:state.start,end:state.end}:null;
    visible=range?allEvents.filter(event=>event.date>=range.start&&event.date<=range.end):allEvents;count.textContent=String(allEvents.length);
    const meta=state?.historicalLabelMeta;
    context.textContent=state?.intraday?'사건은 하루 단위 · 일봉에서 탐색':state?.historicalEventsVisible===false?'차트 사건 표시 꺼짐 · 목록에서 탐색':meta&&Number.isFinite(meta.total)?`차트 사건 ${meta.total}개 · 이름 ${meta.labels}개${meta.hidden>0?' · 확대하면 더 표시':''}`:`${visible.length}개 사건이 표시 기간에 포함`;
    context.title='축소하면 이름을 줄이고, 확대하면 더 자세히 표시합니다. 점에 마우스를 올리거나 키보드로 선택하면 숨긴 이름도 볼 수 있습니다.';
    toggle.title=`주요 사건 ${allEvents.length}개 · ${context.textContent}`;toggle.setAttribute('aria-label',toggle.title);if(!journal.hidden)paintItems();
  }
  update(null);
  return {element:journal,update,close,destroy(){if(destroyed)return;destroyed=true;close();items.removeEventListener('click',onItem);journal.removeEventListener('keydown',onKey);doc.removeEventListener('pointerdown',dismiss,true);doc.removeEventListener('focusin',dismiss);doc.removeEventListener('atlas:modal-open',onModal);doc.removeEventListener('atlas:panel-state',onPanel);win.removeEventListener?.('resize',onResize);toggle.remove();journal.remove();allMenu.remove();volumeMenu.remove();}};
}
