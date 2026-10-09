export function catalogCacheIsFresh(meta:any,policy:string,now=Date.now()):boolean {
 if(meta?.policy!==policy)return false;
 if(meta.temporalValidityTracked===true){
  if(!meta.nextTransitionAt)return true;
  const transition=Date.parse(meta.nextTransitionAt);
  return Number.isFinite(transition)&&transition>now;
 }
 return now-Date.parse(meta.updatedAt||'')<60_000;
}
export function nextCatalogTransition(offers:any[],now=Date.now()):string|null {
 const times=offers.flatMap(item=>[item.vigenteDesde,item.vigenteHasta]).map(value=>Date.parse(String(value||''))).filter(value=>Number.isFinite(value)&&value>now);
 return times.length?new Date(Math.min(...times)).toISOString():null;
}
