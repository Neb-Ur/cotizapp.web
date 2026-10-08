import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialDocuments,classifyCommercialDocuments} from '../scripts/lib/commercial-catalog.mjs';
const batch=JSON.parse(readFileSync(new URL('../../docs/catalogo/productos-comerciales-tanda-01.json',import.meta.url)));
const plan=JSON.parse(readFileSync(new URL('../../docs/catalogo/inventario-propuesto.json',import.meta.url)));
test('commercial batch has verified identities, correct taxonomy, structured measures and no fictitious offers or images',()=>{
 const docs=buildCommercialDocuments(batch,plan,'2026-10-07');
 const products=docs.filter(d=>d.collection==='productosMaestro');
 assert.equal(products.length,40);assert.equal(docs.filter(d=>d.collection==='marcas').length,8);
 for(const product of products){
  assert.equal(product.data.estado,'activo');assert.ok(product.data.marcaId);assert.ok(product.data.fuenteContenidoUrl.startsWith('https://'));
  assert.equal(product.data.imagenPrincipalUrl,'');assert.deepEqual(product.data.galeriaJson,[]);
  assert.equal(product.data.codigoBarras,'');assert.equal(product.data.price,undefined);assert.equal(product.data.stock,undefined);
 }
 const plates=products.filter(d=>d.data.marca==='Volcanita');assert.equal(plates.length,7);
 for(const plate of plates){assert.equal(docs.find(d=>d.id===`${plate.id}--ancho_mm`).data.valorNumero,1200)}
 assert.equal(docs.filter(d=>d.collection==='productosFerreteria').length,0);
});
test('rejects incompatible brand-family pairings, untrusted sources, duplicate products and invalid dimensions',()=>{
 for(const change of [p=>p.familyId='fam-pinturas-de-muro-y-fachada',p=>p.brand='Adidas',p=>p.sourceUrl='https://example.com/product',p=>p.attributes['potencia W']='650']) {
  const copy=structuredClone(batch);change(copy.products[0]);assert.throws(()=>buildCommercialDocuments(copy,plan,'date'));
 }
 const copy=structuredClone(batch);copy.products.push(copy.products[0]);assert.throws(()=>buildCommercialDocuments(copy,plan,'date'));
});
test('repeat imports preserve administrator edits and detect identity conflicts',()=>{
 const docs=buildCommercialDocuments(batch,plan,'date');
 const existing=new Map(docs.map(d=>[`${d.collection}/${d.id}`,{...d.data,descripcionCorta:'Edición del admin'}]));
 assert.equal(classifyCommercialDocuments(docs,existing).create.length,0);
 const product=docs.find(d=>d.collection==='productosMaestro');existing.get(`productosMaestro/${product.id}`).marcaId='wrong';
 assert.equal(classifyCommercialDocuments(docs,existing).conflicts.length,1);
});
