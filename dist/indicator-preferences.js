import { INDICATORS, normalizeIndicatorState, searchIndicators } from './indicator-state.js?v=1.14.1-touch.1';

export const INDICATOR_PREFERENCES_KEY='bitcoin-cycle-atlas.indicator-preferences.v1';
export const MAX_INDICATOR_TEMPLATES=8;
export const MAX_TEMPLATE_NAME=40;
const ids=new Set(INDICATORS.map(item=>item.id));
const templateName=value=>typeof value==='string'?value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/gu,' ').trim().replace(/\s+/gu,' '):'';
const nameKey=value=>templateName(value).toLocaleLowerCase();

/** Personal favorites/templates never override a chart URL on startup. */
export function normalizeIndicatorPreferences(value={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const favorites=INDICATORS.filter(item=>Array.isArray(value.favorites)&&value.favorites.includes(item.id)).map(item=>item.id);
  const templates=[],seen=new Set();
  for(const entry of Array.isArray(value.templates)?value.templates:[]){
    if(!entry||typeof entry!=='object'||!Array.isArray(entry.state?.added))continue;
    const name=templateName(entry.name).slice(0,MAX_TEMPLATE_NAME),key=nameKey(name);
    if(!name||seen.has(key))continue;
    seen.add(key);templates.push({name,state:normalizeIndicatorState(entry.state)});
    if(templates.length===MAX_INDICATOR_TEMPLATES)break;
  }
  return {version:1,favorites,templates};
}

export function readIndicatorPreferences(storageProvider) {
  try{return normalizeIndicatorPreferences(JSON.parse(storageProvider()?.getItem(INDICATOR_PREFERENCES_KEY)||'{}'));}
  catch{return normalizeIndicatorPreferences();}
}

export function writeIndicatorPreferences(value,storageProvider) {
  try{const storage=storageProvider();if(!storage)return false;storage.setItem(INDICATOR_PREFERENCES_KEY,JSON.stringify(normalizeIndicatorPreferences(value)));return true;}
  catch{return false;}
}

export function toggleIndicatorFavorite(value,id) {
  const next=normalizeIndicatorPreferences(value);
  if(ids.has(id))next.favorites=next.favorites.includes(id)?next.favorites.filter(item=>item!==id):[...next.favorites,id];
  return normalizeIndicatorPreferences(next);
}

export function saveIndicatorTemplate(value,name,state) {
  const preferences=normalizeIndicatorPreferences(value),clean=templateName(name),key=nameKey(clean);
  if(!clean)return {preferences,error:'이름을 입력하세요.'};
  if(clean.length>MAX_TEMPLATE_NAME)return {preferences,error:`이름은 ${MAX_TEMPLATE_NAME}자 이내로 입력하세요.`};
  const index=preferences.templates.findIndex(item=>nameKey(item.name)===key);
  if(index<0&&preferences.templates.length>=MAX_INDICATOR_TEMPLATES)return {preferences,error:`템플릿은 ${MAX_INDICATOR_TEMPLATES}개까지 저장할 수 있습니다. 사용하지 않는 항목을 삭제해 주세요.`};
  const template={name:clean,state:normalizeIndicatorState(state)};
  if(index<0)preferences.templates.push(template);else preferences.templates[index]=template;
  return {preferences,template,replaced:index>=0,error:null};
}

export function deleteIndicatorTemplate(value,name) {
  const next=normalizeIndicatorPreferences(value),key=nameKey(name);
  next.templates=next.templates.filter(item=>nameKey(item.name)!==key);return next;
}

export function indicatorLibraryItems({query='',category='전체',view='all',state,preferences}={}) {
  const current=normalizeIndicatorState(state),personal=normalizeIndicatorPreferences(preferences);
  return searchIndicators(query,category).filter(item=>view==='added'?current.added.includes(item.id):view==='favorites'?personal.favorites.includes(item.id):true);
}

export function hasIndicatorTemplate(value,name){return normalizeIndicatorPreferences(value).templates.some(item=>nameKey(item.name)===nameKey(name));}
