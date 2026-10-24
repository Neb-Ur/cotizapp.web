import test from 'node:test';import assert from 'node:assert/strict';
import {homeCatalog,AUTOMOTIVE_CATEGORY_ID} from '../lib/domain/home-catalog.js';
const product=(id,category,name)=>({id,nombre:name,categoriaId:category,estado:'activo',imagenPrincipalUrl:'https://example.invalid/'+id+'.webp'});
test('home prioritizes construction and tools and excludes former auto parts',()=>{
 const products=[product('mat','materials','Material'),product('tool','cat-herramientas-y-consumibles','Herramienta'),product('auto1',AUTOMOTIVE_CATEGORY_ID,'Alternador'),product('auto2',AUTOMOTIVE_CATEGORY_ID,'Amortiguador'),product('extra','materials','Otro material')];
 const snapshot={version:'test',updatedAt:'',products,searchRows:[],taxonomy:{categories:[{id:'materials',nombre:'Materiales'},{id:'cat-herramientas-y-consumibles',nombre:'Herramientas'},{id:AUTOMOTIVE_CATEGORY_ID,nombre:'Repuestos automotrices'}],subcategories:[],families:[]}};
 const preview=homeCatalog(snapshot);assert.deepEqual(preview.products.map(p=>p.productoMaestroId),['mat','tool','extra']);assert.ok(preview.products.every(p=>p.storeCount===0&&p.minPrice===0));assert.ok(preview.categories.every(c=>c.id!==AUTOMOTIVE_CATEGORY_ID));
});
test('home fills available slots without duplicates and excludes inactive products',()=>{
 const p=product('p','materials','Producto');const preview=homeCatalog({version:'test',updatedAt:'',products:[p,{...p,id:'inactive',estado:'inactivo'}],searchRows:[],taxonomy:{categories:[],subcategories:[],families:[]}});
 assert.equal(preview.products.length,1);assert.equal(preview.products[0].productoMaestroId,'p');
});
