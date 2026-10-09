import test from 'node:test';
import assert from 'node:assert/strict';
import {storeCanPublish} from '../lib/services/pilot-stores.service.js';
import {buildSearchRows} from '../lib/services/catalog-search.service.js';
const source=()=>[[{id:'offer',ferreteriaId:'pilot',productoMaestroId:'product',precio:1000,stock:10}], [{id:'product',nombre:'Cemento'}], [{id:'pilot',usuarioDuenoId:'owner',nombreComercial:'Trovio Norte (Prueba)',esPrueba:true,estado:'activo'}], [{id:'owner',estadoCuenta:'activo'}],[],[],[]];
test('pilot stores require explicit enablement and disappear with their offers when disabled',async t=>{
 const before=process.env.PILOT_STORES_ENABLED;
 try {process.env.PILOT_STORES_ENABLED='false';assert.equal((await buildSearchRows(source())).length,0);
 process.env.PILOT_STORES_ENABLED='true';assert.equal((await buildSearchRows(source())).length,1);
 const inactive=source();inactive[2][0].estado='inactivo';assert.equal((await buildSearchRows(inactive)).length,0);
 assert.equal(storeCanPublish({estado:'activo'}),false);
 }finally{if(before===undefined)delete process.env.PILOT_STORES_ENABLED;else process.env.PILOT_STORES_ENABLED=before;}
});
