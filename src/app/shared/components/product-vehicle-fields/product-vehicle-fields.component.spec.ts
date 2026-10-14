import {vi} from 'vitest';import {ChangeDetectorRef} from '@angular/core';
import {ProductVehicleFieldsComponent} from './product-vehicle-fields.component';import {VehicleCatalogService} from '../../../core/services/vehicle-catalog.service';
function setup(){const catalog={brands:[{id:'a',nombre:'Marca A',usos:['vehiculo']},{id:'b',nombre:'Marca B',usos:['vehiculo']}],models:[{id:'ma',marcaId:'a',nombre:'Modelo A',activo:true},{id:'mb',marcaId:'b',nombre:'Modelo B',activo:true}]};const component=new ProductVehicleFieldsComponent({publicCatalog:async()=>catalog} as unknown as VehicleCatalogService,{markForCheck:vi.fn()} as unknown as ChangeDetectorRef);return component as any;}
it('uses dependent brand/model selection and clears years without mutating the input',async()=>{
 const c=setup();await c.load();c.applications=[{marcaId:'a',modeloId:'ma',anioDesde:2010,anioHasta:2015}];let next:any;c.applicationsChange.subscribe((value:any)=>next=value);
 c.update(0,'marcaId','b');expect(next[0]).toMatchObject({marcaId:'b',marcaNombre:'Marca B',modeloId:'',anioDesde:null,anioHasta:null});expect(c.applications[0].marcaId).toBe('a');
 c.applications=next;c.update(0,'modeloId','mb');expect(next[0].modeloNombre).toBe('Modelo B');
});
it('retains previously registered inactive models and supports adding/removing ranges',async()=>{
 const c=setup();await c.load();c.applications=[{marcaId:'a',modeloId:'retired',modeloNombre:'Modelo anterior',anioDesde:2000,anioHasta:2005}];expect(c.models(c.applications[0]).some((m:any)=>m.id==='retired')).toBe(true);let next:any;c.applicationsChange.subscribe((value:any)=>next=value);c.add();expect(next.length).toBe(2);c.applications=next;c.remove(0);expect(next.length).toBe(1);
});
