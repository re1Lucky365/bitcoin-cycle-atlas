/** Session history stores only explicitly supplied UI state, never prices or requests. */
export function createWorkspaceHistory({ read, apply, onChange = () => {}, limit = 50 } = {}) {
  if (typeof read !== 'function' || typeof apply !== 'function') throw new TypeError('History requires state readers');
  const copy = value => JSON.parse(JSON.stringify(value));
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const maximum = Math.max(1, Math.min(100, Math.floor(limit) || 50));
  let undo = [], redo = [], transaction = null, depth = 0, restoring = false;
  const status = () => ({ canUndo:undo.length>0, canRedo:redo.length>0, undoLabel:undo.at(-1)?.label || '', redoLabel:redo.at(-1)?.label || '', undoCount:undo.length, redoCount:redo.length });
  const publish = () => onChange(status());
  function begin(label = '차트 변경') {
    if (restoring) return;
    if (!depth) transaction = { before:copy(read()), label:String(label).slice(0,100) };
    depth++;
  }
  function commit() {
    if (restoring || !depth) return false;
    if (--depth) return false;
    const pending=transaction;transaction=null;
    const after=copy(read());
    if (equal(pending.before,after)) return false;
    undo.push({...pending,after});if(undo.length>maximum)undo.shift();redo=[];publish();return true;
  }
  function restore(direction) {
    if (depth || restoring) return false;
    const source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo,entry=source.at(-1);
    if(!entry)return false;
    restoring=true;
    try { apply(copy(direction==='undo'?entry.before:entry.after), {direction,label:entry.label}); }
    finally { restoring=false; }
    source.pop();target.push(entry);publish();return true;
  }
  return {begin,commit,status,undo:()=>restore('undo'),redo:()=>restore('redo'),
    run(label,change){begin(label);try{return change();}finally{commit();}},
    clear(){undo=[];redo=[];transaction=null;depth=0;publish();},
    get active(){return depth>0;},get restoring(){return restoring;},
  };
}

/** Capture one synchronous user command, including nested delegated commands. */
export function captureHistoryCommand(history,label,queue=queueMicrotask) {
  history.begin(label);queue(()=>history.commit());
}

export function historyShortcut(event) {
  if(event.defaultPrevented||event.altKey||!(event.ctrlKey||event.metaKey)||event.target?.closest?.('input,textarea,select,[contenteditable="true"],dialog[open]'))return null;
  const key=String(event.key).toLowerCase();
  return key==='z'?(event.shiftKey?'redo':'undo'):key==='y'&&!event.shiftKey?'redo':null;
}
