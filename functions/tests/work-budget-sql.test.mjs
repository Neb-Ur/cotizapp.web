import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {PostgresDatabase} from '../lib/database/postgres.js';import {emptyWorkBudget} from '../lib/domain/work-budget.js';
test('versioned work costs and painting assumptions round-trip through the production SQL repository without schema changes',async t=>{
 const pg=new PGlite();t.after(()=>pg.close());
 for(const file of ['001-schema.sql','002-public-views.sql','003-security.sql','005-runtime-compatibility.sql','011-quotation-verification.sql','012-advisory-quotation-period.sql','015-offer-condition.sql','016-store-business-type.sql','017-vehicle-reference-catalog.sql','018-offer-vehicle-applications.sql','019-product-vehicle-applications.sql','020-donor-vehicles.sql','021-donor-trigger-search-path.sql','023-hardware-only.sql'])await pg.exec(await readFile(new URL('../../sql/findi/'+file,import.meta.url),'utf8'));
 await pg.query("INSERT INTO findi.database_migration_state(id,status,source_project) VALUES('firestore-to-sql','verified','test')");
 const db=new PostgresDatabase({connect:async()=>({query:pg.query.bind(pg),release(){}})});
 await db.collection('usuarios').doc('owner').set({rol:'maestro',nombre:'Maestro',correo:'maestro@example.test',estadoCuenta:'activo'});
 const workBudget={...emptyWorkBudget(),enabled:true,clientName:'Cliente',markupPercent:25,labor:[{description:'Pintura',unit:'jornada',quantity:2,unitPrice:50000}]};
 const paintingPlan={version:1,length:5,height:4,surfaces:1,openings:0,coats:2,coverage:10,wastePercent:10,packLiters:4,productId:'paint',productName:'Pintura'};
 const ref=db.collection('real_proyectos').doc('project');await ref.set({ownerId:'owner',name:'Obra',createdAt:new Date().toISOString(),items:[],workBudget:{...workBudget,templateId:'painting-v1'},paintingPlan,workflowStatus:'sent',workflowUpdatedAt:'2026-10-25T12:00:00Z'});
 await ref.update({description:'Nuevo alcance'});
 const saved=(await ref.get()).data();assert.deepEqual(saved.workBudget,{...workBudget,templateId:'painting-v1'});assert.equal(saved.workflowStatus,'sent');assert.equal(saved.workflowUpdatedAt,'2026-10-25T12:00:00Z');assert.deepEqual(saved.paintingPlan,paintingPlan);
 const raw=(await pg.query("SELECT api_payload FROM findi.quotations WHERE id='project'")).rows[0].api_payload;assert.deepEqual(raw.workBudget,{...workBudget,templateId:'painting-v1'});
 await ref.update({paintingPlan:null});assert.equal((await ref.get()).data().paintingPlan,null);
});
