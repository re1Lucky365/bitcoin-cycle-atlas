/** Provenance markers explain the future line. They never inject prices or
 * manufacture a dated market catalyst from an undated investment thesis. */
export function bitcoinForecastEvidence(model){
  if(!model?.path?.length)return [];
  const byDate=new Map(model.path.map(point=>[point.date,point]));
  const first=model.path.find(point=>Date.parse(point.date)-Date.parse(model.asOf)>=90*86400000);
  const entries=first?[{id:'btc-forecast-method',date:first.date,price:first.price,title:'모델 근거',sourceIds:['btc-model-method'],description:'가격·주기·변동성 가정을 분리한 모형 설명. 시장 사건의 예정일이 아닙니다.'}]:[];
  for(const event of model.events||[]){
    const point=byDate.get(event.date);if(!point||event.date<=model.asOf)continue;
    entries.push({id:`btc-evidence-${event.id}`,date:event.date,price:point.price,title:`${event.date.slice(0,4)} 근거`,
      sourceIds:event.valuationOrigin==='analyst-derived'?['btc-model-method',`long-${event.sourceId}`]:[`long-${event.sourceId}`,'btc-model-method'],
      description:event.isPublishedSourcePrice?'발행사 가치평가 조건과 앱 경로는 다릅니다. 연말은 표시 기준일입니다.':'앱의 파생·스트레스 가정입니다. 원문 가격 목표와 구분합니다.'});
  }
  return entries;
}
