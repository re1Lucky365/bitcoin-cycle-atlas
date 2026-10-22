const picker=document.getElementById('preview-size'),frame=document.getElementById('mobile-preview');
picker.addEventListener('change',()=>{const [width,height]=picker.value.split('x').map(Number);frame.width=String(width);frame.height=String(height);});

const modePicker=document.getElementById('preview-mode'),caption=document.getElementById('preview-caption');
const actualCaption=caption.textContent,actualTitle=frame.title;
const sourceUrl=new URL(frame.getAttribute('src'),document.baseURI);
let generation=0,pending=null;

function bootPreview(html,mode){
  const page=new DOMParser().parseFromString(html,'text/html');
  for(const node of page.querySelectorAll('script,noscript,base'))node.remove();
  const base=page.createElement('base');base.href=sourceUrl.href;page.head.prepend(base);
  const shell=page.getElementById('atlas-boot-shell'),status=page.getElementById('atlas-boot-status'),error=page.getElementById('atlas-boot-error');
  if(!shell||!status||!error)throw new Error('The source page has no boot shell');
  page.documentElement.dataset.boot=mode;
  shell.hidden=false;status.hidden=mode==='error';error.hidden=mode!=='error';
  status.setAttribute('aria-busy',String(mode==='loading'));
  for(const node of page.querySelectorAll('[data-boot-content]')){
    node.setAttribute('inert','');node.setAttribute('aria-hidden','true');
  }
  return '<!doctype html>\n'+page.documentElement.outerHTML;
}

modePicker.addEventListener('change',async()=>{
  const request=++generation,mode=modePicker.value;
  pending?.abort();pending=null;
  if(mode==='actual'){
    frame.removeAttribute('srcdoc');frame.hidden=false;frame.title=actualTitle;
    frame.removeAttribute('aria-busy');caption.textContent=actualCaption;return;
  }
  const controller=new AbortController();pending=controller;
  frame.hidden=true;frame.setAttribute('aria-busy','true');
  caption.textContent='같은 페이지의 원본 로딩 화면을 읽고 있습니다.';
  try{
    const response=await fetch(sourceUrl,{cache:'no-cache',signal:controller.signal});
    if(!response.ok)throw new Error(`Preview source HTTP ${response.status}`);
    const html=await response.text();
    if(request!==generation)return;
    frame.srcdoc=bootPreview(html,mode);frame.hidden=false;
    frame.title=`비트코인 ${mode==='loading'?'초기 로딩':'로딩 실패'} 화면 미리보기`;
    caption.textContent='선택한 로딩 상태를 멈춘 표시 미리보기 · 실제 로딩 시간·기기 성능 측정은 아닙니다.';
  }catch(error){
    if(request!==generation||controller.signal.aborted)return;
    caption.textContent='미리보기 원본을 읽지 못했습니다. 실제 페이지를 열어 확인하거나 화면 상태를 다시 선택해 주세요.';
  }finally{
    if(request===generation){pending=null;frame.removeAttribute('aria-busy');}
  }
});
