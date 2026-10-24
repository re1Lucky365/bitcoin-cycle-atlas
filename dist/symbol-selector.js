import { mountDialogViewport } from './dialog-viewport.js?v=1.14.0-mobile.1';

/** Supported instruments are explicit: equity, spot USD and USDT are distinct. */
export const SYMBOLS = Object.freeze([
  Object.freeze({ symbol:'BTCUSD', product:'BTC-USD', name:'Bitcoin', koreanName:'비트코인', source:'지수·거래소', description:'Coin Metrics · Bitstamp · Coinbase', base:'BTC' }),
  Object.freeze({ symbol:'ETHUSD', product:'ETH-USD', name:'Ethereum', koreanName:'이더리움', source:'Coinbase', description:'Coinbase Exchange · 현물 USD', base:'ETH' }),
  Object.freeze({ symbol:'MSTR', product:'MSTR', name:'Strategy', koreanName:'스트래티지', source:'Nasdaq', description:'MicroStrategy · Michael Saylor · 마이클 세일러 · 미국 주식', base:'MSTR', assetClass:'equity' }),
  Object.freeze({ symbol:'BMNR', product:'BMNR', name:'Bitmine', koreanName:'비트마인', source:'NYSE', description:'Bitmine Immersion Technologies · Tom Lee · 톰 리 · 미국 주식', base:'BMNR', assetClass:'equity' }),
]);
const intervals = new Set(['1m','5m','15m','30m','1h','4h','daily','weekly']);
const symbolValue = value => typeof value === 'string' ? value.toUpperCase().replace(/[\s/\-]/g,'') : '';

export function normalizeSymbol(value) {
  return SYMBOLS.find(item => item.symbol === symbolValue(value))?.symbol || 'BTCUSD';
}

export function searchSymbols(query = '') {
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return SYMBOLS.filter(item => terms.every(term => `${item.symbol} ${item.product} ${item.base}/USD ${item.name} ${item.koreanName} 미국 달러 ${item.source} ${item.description}`.toLocaleLowerCase().includes(term)));
}

/** A symbol change keeps presentation choices, but resets asset-owned ranges,
 * price bounds, research layers and scenarios. Navigation also resets pending
 * requests, so a late BTC response cannot paint over the ETH chart. */
export function createSymbolUrl(currentUrl, targetSymbol) {
  const instrument = SYMBOLS.find(item => item.symbol === symbolValue(targetSymbol));
  if (!instrument) throw new RangeError('Unsupported chart symbol');
  const current = new URL(currentUrl), next = new URL(current);
  if (!['https:','http:','file:'].includes(current.protocol)) throw new TypeError('Invalid chart URL');
  next.search = ''; next.hash = '';
  if (instrument.symbol !== 'BTCUSD') next.searchParams.set('symbol',instrument.symbol);
  for (const [key, allowed] of [['granularity',intervals],['type',new Set(['line','candles'])],['axis',new Set(['log','linear'])]]) {
    let value = current.searchParams.get(key);
    if(key==='granularity'&&instrument.assetClass==='equity'&&!['daily','weekly'].includes(value))value='daily';
    if (allowed.has(value)) next.searchParams.set(key,value);
  }
  return next.href;
}

const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const chevronIcon = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m4 6 4 4 4-4"/></svg>';
const ethIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 6 10-6 3-6-3Z" fill="currentColor"/><path d="m6 14 6 8 6-8-6 3Z" fill="currentColor" opacity=".75"/><path d="M12 2v13l6-3Z" fill="#fff" opacity=".2"/></svg>';

export function mountSymbolSelector({ button, symbol='BTCUSD', document=button?.ownerDocument || globalThis.document, onSelect=null, navigate=null, getUrl=null } = {}) {
  if (!button || !document) throw new TypeError('A symbol button and document are required');
  const currentSymbol = normalizeSymbol(symbol), current = SYMBOLS.find(item => item.symbol === currentSymbol);
  const win = document.defaultView || globalThis.window;
  const add = (parent,tag,className,text) => {
    const node = document.createElement(tag); if (className) node.className = className;
    if (text !== undefined) node.textContent = text; parent.append(node); return node;
  };
  button.type = 'button'; button.classList.add('symbol-selector-trigger');
  button.replaceChildren(); add(button,'span','symbol-selector-label',current.symbol);
  add(button,'span','symbol-selector-chevron').innerHTML = chevronIcon;
  button.title = `종목 선택 · ${current.koreanName} / 미국 달러`;
  button.setAttribute('aria-label',`${button.title} · ${current.symbol}`);
  button.setAttribute('aria-haspopup','dialog'); button.setAttribute('aria-controls','symbol-search-dialog'); button.setAttribute('aria-expanded','false');

  const dialog = document.createElement('dialog'); dialog.id = 'symbol-search-dialog'; dialog.className = 'symbol-search-dialog';
  dialog.setAttribute('aria-labelledby','symbol-search-title');
  const header = add(dialog,'header','symbol-search-heading');
  add(header,'h2','', '종목 검색').id = 'symbol-search-title';
  const dismiss = add(header,'button','symbol-search-close','×'); dismiss.type = 'button'; dismiss.setAttribute('aria-label','종목 검색 닫기');
  const search = add(dialog,'div','symbol-search-input'); add(search,'span','symbol-search-icon').innerHTML = searchIcon;
  const input = add(search,'input',''); input.type = 'search'; input.placeholder = '심볼 또는 이름 검색'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('aria-label','심볼 또는 이름 검색'); input.setAttribute('role','combobox'); input.setAttribute('aria-autocomplete','list'); input.setAttribute('aria-controls','symbol-search-results'); input.setAttribute('aria-expanded','true');
  const filters = add(dialog,'div','symbol-search-filters'); add(filters,'span','','암호화폐 · 미국 주식'); add(filters,'span','','USD');
  const results = add(dialog,'div','symbol-search-results'); results.id = 'symbol-search-results'; results.setAttribute('role','listbox'); results.setAttribute('aria-label','지원 종목');
  const empty = add(dialog,'p','symbol-search-empty','일치하는 종목이 없습니다. BTC · ETH · MSTR · BMNR를 검색해 보세요.'); empty.hidden = true; empty.setAttribute('role','status');
  const count = add(dialog,'span','symbol-search-count'); count.setAttribute('role','status'); count.setAttribute('aria-live','polite');
  const footer = add(dialog,'footer','symbol-search-footer');
  add(footer,'span','','4개 종목 · 출처별 실제 가격'); add(footer,'small','','↑ ↓ 이동 · Enter 선택 · Esc 닫기');
  document.body.append(dialog);
  const viewport = mountDialogViewport(dialog);
  let opened = false, activeIndex = 0, rows = [], matches = [];

  function activate(index,{focus=false}={}) {
    if (!rows.length) { input.removeAttribute('aria-activedescendant'); return; }
    activeIndex = (index + rows.length) % rows.length;
    rows.forEach((row,i) => { const active = i === activeIndex; row.setAttribute('aria-selected',String(active)); row.tabIndex = active ? 0 : -1; });
    input.setAttribute('aria-activedescendant',rows[activeIndex].id);
    if (focus) rows[activeIndex].focus({preventScroll:true});
  }
  function renderResults() {
    matches = searchSymbols(input.value || ''); results.replaceChildren(); rows = [];
    for (const instrument of matches) {
      const row = add(results,'button','symbol-search-row'); row.id = `symbol-option-${instrument.symbol}`; row.type = 'button'; row.setAttribute('role','option'); row.dataset.symbol = instrument.symbol;
      const mark = add(row,'span',`symbol-search-mark symbol-search-mark-${instrument.base.toLowerCase()}`); mark.setAttribute('aria-hidden','true');
      instrument.base === 'ETH' ? mark.innerHTML = ethIcon : mark.textContent = instrument.assetClass==='equity'?instrument.symbol==='MSTR'?'M':'B':'₿';
      const identity = add(row,'span','symbol-search-identity');
      const symbolLine = add(identity,'span','symbol-search-symbol'); add(symbolLine,'strong','',instrument.symbol);
      if (instrument.symbol === currentSymbol) add(symbolLine,'small','symbol-search-current','현재');
      add(identity,'span','symbol-search-name',`${instrument.name} · ${instrument.koreanName}`);
      const source = add(row,'span','symbol-search-source'); add(source,'span','',instrument.source); add(source,'small','',instrument.assetClass==='equity'?'주식 · USD':'현물 · USD');
      row.title = `${instrument.description} · ${instrument.koreanName} / 미국 달러`;
      row.onclick = () => choose(instrument.symbol);
      row.onfocus = () => activate(rows.indexOf(row));
      rows.push(row);
    }
    empty.hidden = matches.length > 0; count.textContent = `${matches.length}개 종목`;
    const currentIndex = matches.findIndex(item => item.symbol === currentSymbol);
    activate(currentIndex >= 0 ? currentIndex : 0);
  }
  function restoreFocus() { if (button.isConnected !== false && !button.disabled && !button.hidden) button.focus({preventScroll:true}); }
  function close() {
    if (!opened) return; opened = false; button.setAttribute('aria-expanded','false');
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    restoreFocus();
  }
  function choose(value) {
    if (!opened) return;
    const instrument = SYMBOLS.find(item => item.symbol === value); if (!instrument) return;
    close(); if (instrument.symbol === currentSymbol) return;
    const url = createSymbolUrl(getUrl ? getUrl() : win.location.href,instrument.symbol);
    if (onSelect) onSelect(instrument.symbol,url);
    else if (navigate) navigate(url);
    else win.location.assign(url);
  }
  function open() {
    if (opened) { input.focus({preventScroll:true}); return; }
    input.value = ''; renderResults(); opened = true; button.setAttribute('aria-expanded','true');
    const ModalEvent = win?.CustomEvent || globalThis.CustomEvent;
    if (ModalEvent) document.dispatchEvent(new ModalEvent('atlas:modal-open',{detail:{id:dialog.id}}));
    if (typeof dialog.showModal === 'function') dialog.showModal(); else { dialog.setAttribute('open',''); dialog.setAttribute('aria-modal','true'); }
    input.focus({preventScroll:true});
  }
  function onKey(event) {
    event.stopPropagation();
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault(); activate(activeIndex+(event.key === 'ArrowDown' ? 1 : -1),{focus:document.activeElement !== input}); return;
    }
    if (event.key === 'Enter' && document.activeElement === input) { event.preventDefault(); if (matches[activeIndex]) choose(matches[activeIndex].symbol); return; }
    if (event.key !== 'Tab') return;
    const controls = [dismiss,input,...rows.filter((_,index) => index === activeIndex)], index = controls.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus({preventScroll:true}); }
    else if (!event.shiftKey && (index < 0 || index === controls.length-1)) { event.preventDefault(); controls[0].focus({preventScroll:true}); }
  }
  function onOtherModal(event) { if (event.detail?.id !== dialog.id) close(); }
  function onNativeClose() { if (opened) { opened = false; button.setAttribute('aria-expanded','false'); restoreFocus(); } }
  button.addEventListener('click',open); dismiss.onclick = close; input.oninput = renderResults;
  dialog.addEventListener('keydown',onKey);
  dialog.addEventListener('cancel',event => { event.preventDefault(); close(); });
  dialog.addEventListener('close',onNativeClose);
  dialog.addEventListener('click',event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  document.addEventListener('atlas:modal-open',onOtherModal);
  return { open, close, isOpen:() => opened, element:dialog, destroy() { close(); viewport.destroy(); button.removeEventListener('click',open); document.removeEventListener('atlas:modal-open',onOtherModal); dialog.remove(); button.setAttribute('aria-expanded','false'); } };
}
