/** Immutable model/base identities keep full-history preparation off zoom/drag. */
const prepared=new WeakMap();

export function preparePriceViewData(model,baseRows,pivots=[]) {
  const cached=prepared.get(model);
  if(cached?.baseRows===baseRows&&cached?.pivots===pivots)return cached.value;
  let peak=0;
  for(const row of baseRows)peak=Math.max(peak,row.price);
  const future=[];
  for(const row of model.path){
    if(row.date<=model.asOf)continue;
    peak=Math.max(peak,row.price);future.push({...row,drawdownPct:(row.price/peak-1)*100});
  }
  const actualTurns=pivots.map(p=>({date:p.eventDate,price:p.eventPrice,type:p.type,confirmationDate:p.confirmationDate}));
  const value={future,rows:[...baseRows,...future],actualTurns,turns:[...actualTurns,...model.localTurns],events:model.events.filter(event=>event.inHorizon)};
  prepared.set(model,{baseRows,pivots,value});return value;
}
