import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {writeDocument} from '../lib/database/codec.js';

test('retirement physically deletes the former market while retaining hardware quotation lines and enforcing the new schema', async t => {
 const pg=new PGlite();t.after(()=>pg.close());
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','011-quotation-verification.sql','012-advisory-quotation-period.sql','013-store-reviews.sql','015-offer-condition.sql','016-store-business-type.sql','017-vehicle-reference-catalog.sql','018-offer-vehicle-applications.sql','019-product-vehicle-applications.sql','020-donor-vehicles.sql','021-donor-trigger-search-path.sql']) await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
 const client={query:pg.query.bind(pg)};
 const put=(c,id,data)=>writeDocument(client,c,id,data);
 await put('usuarios','owner',{rol:'ferreteria',nombre:'Local',correo:'owner@example.test',estadoCuenta:'activo'});
 await put('usuarios','customer',{rol:'maestro',nombre:'Cliente',correo:'customer@example.test',estadoCuenta:'activo'});
 for(const id of ['hardware','retired']) {
  const category=id==='retired'?'cat-repuestos-automotrices':'cat-hardware';
  await put('categorias',category,{nombre:id});
  await put('subcategorias','sub-'+id,{nombre:id,categoriaId:category});
  await put('familias','fam-'+id,{nombre:id,subcategoriaId:'sub-'+id});
  await put('productosMaestro',id,{nombre:id,familiaId:'fam-'+id,categoriaId:category,subcategoriaId:'sub-'+id,estado:'activo'});
  await put('real_ferreterias','store-'+id,{usuarioDuenoId:'owner',nombreComercial:id,estado:'activo'});
  await put('real_productosFerreteria','offer-'+id,{ferreteriaId:'store-'+id,productoMaestroId:id,precio:100,stock:1,activo:true,publicado:true});
 }
 await pg.query("UPDATE findi.products SET api_payload=api_payload || '{\"compatibilidadVehiculos\":null}' WHERE id='hardware'");
 await pg.query("UPDATE findi.stores SET business_type='desarmaduria',api_payload=api_payload || '{\"tipoNegocio\":\"desarmaduria\"}' WHERE id='store-retired'");
 await put('real_proyectos','quote',{ownerId:'customer',name:'Obra',createdAt:new Date().toISOString(),items:[{productoMaestroId:'hardware',productName:'hardware',quantity:2,storeId:'store-hardware',productoFerreteriaId:'offer-hardware'},{productoMaestroId:'retired',productName:'retired',quantity:1,storeId:'store-retired',productoFerreteriaId:'offer-retired'}]});
 await put('real_cotizacionesVerificables','TEST-CODE',{code:'TEST-CODE',quotationReference:'quote',issuedAt:new Date().toISOString(),recommendedUntil:new Date(Date.now()+60000).toISOString(),lines:[{productId:'retired',storeId:'store-retired'}]});
 await pg.exec(await readFile(new URL('../../sql/findi/023-hardware-only.sql',import.meta.url),'utf8'));
 assert.deepEqual((await pg.query('SELECT id FROM findi.products')).rows.map(r=>r.id),['hardware']);
 assert.deepEqual((await pg.query('SELECT id FROM findi.stores')).rows.map(r=>r.id),['store-hardware']);
 assert.deepEqual((await pg.query('SELECT id FROM findi.offers')).rows.map(r=>r.id),['offer-hardware']);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_items')).rows[0].n,1);
 assert.equal((await pg.query('SELECT api_payload FROM findi.quotations')).rows[0].api_payload.items.length,1);
 assert.equal((await pg.query('SELECT count(*)::int n FROM findi.quotation_verifications')).rows[0].n,0);
 assert.equal((await pg.query("SELECT to_regclass('findi.vehicle_models') name")).rows[0].name,null);
 assert.equal((await pg.query("SELECT to_regclass('findi.donor_vehicles') name")).rows[0].name,null);
 await assert.rejects(()=>pg.query("UPDATE findi.stores SET business_type='desarmaduria'"));
 await put('real_productosFerreteria','new-offer',{ferreteriaId:'store-hardware',productoMaestroId:'hardware',precio:200,stock:2}).then(()=>assert.fail('duplicate offer allowed'),()=>{});
 await put('productosMaestro','new-product',{nombre:'Nueva herramienta',familiaId:'fam-hardware',categoriaId:'cat-hardware',subcategoriaId:'sub-hardware',estado:'activo'});
});
