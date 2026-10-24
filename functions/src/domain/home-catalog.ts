import { hardwareSnapshot } from './market-scope.js';
import {paginateProductSearch} from './product-search.js';
import type {PublicCatalogSnapshot} from '../lib/public-catalog-cache.js';
export const AUTOMOTIVE_CATEGORY_ID = 'cat-repuestos-automotrices';
const TOOLS_CATEGORY_ID = 'cat-herramientas-y-consumibles';
export function homeCatalog(snapshot:PublicCatalogSnapshot) {
  snapshot = hardwareSnapshot(snapshot);
  const masters = new Map(snapshot.products.map(p=>[p.id,p]));
  const candidates=paginateProductSearch(snapshot,{sort:'stores',page:1,size:Math.max(4,snapshot.products.length)}).items;
  candidates.sort((a,b)=>Number(!!b.imageUrl&&!/placeholder|placehold/i.test(b.imageUrl))-Number(!!a.imageUrl&&!/placeholder|placehold/i.test(a.imageUrl)) || b.storeCount-a.storeCount || a.productName.localeCompare(b.productName,'es'));
  const selected:typeof candidates=[];
  const add=(rows:typeof candidates,count:number)=>{
    for(const candidate of rows){if(count===0)break;if(selected.some(p=>p.productoMaestroId===candidate.productoMaestroId))continue;selected.push(candidate);count--;}
  };
  const category=(p:typeof candidates[number])=>masters.get(p.productoMaestroId)?.categoriaId;
  add(candidates.filter(p=>category(p)!==AUTOMOTIVE_CATEGORY_ID&&category(p)!==TOOLS_CATEGORY_ID),1);
  add(candidates.filter(p=>category(p)===TOOLS_CATEGORY_ID),1);

  add(candidates,4-selected.length);
  const products=selected.map(p=>({...p,homeGroupLabel:category(p)===TOOLS_CATEGORY_ID?'Herramientas':'Materiales'}));
  const categories=snapshot.taxonomy.categories.map(c=>({id:c.id,name:c.nombre,icon:c.icono}));
  const auto=categories.find(c=>c.id===AUTOMOTIVE_CATEGORY_ID);
  const tools=categories.find(c=>c.id===TOOLS_CATEGORY_ID);
  const featured=categories.filter(c=>c.id!==AUTOMOTIVE_CATEGORY_ID&&c.id!==TOOLS_CATEGORY_ID).slice(0,4);
  if(tools)featured.push(tools);
  for(const c of categories)if(featured.length<8&&!featured.some(f=>f.id===c.id))featured.push(c);
  return {products,categories:featured};
}
