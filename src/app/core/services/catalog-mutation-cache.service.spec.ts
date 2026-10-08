import { vi } from 'vitest';
import { FirebaseDataService } from './firebase-data.service';
it('returns the updated master instead of the older cached entry and saves optional fields',async()=>{
 const updated={id:'p',nombre:'Nombre actualizado',categoriaId:'c',subcategoriaId:'s',familiaId:'f',caracteristicasDestacadas:['Acero galvanizado'],pesoLogisticoKg:2};
 const api:any={patch:vi.fn(async()=>updated)};
 const service:any=new FirebaseDataService(api,{} as any);
 service.masterCatalog.push({id:'p',masterProductId:'p',name:'Nombre anterior'});
 const result=await service.updateMasterCatalogProduct('p',{name:'Nombre actualizado',featureBullets:['Acero galvanizado'],logisticsWeightKg:2,logisticsVolumeM3:null},false);
 expect(result.name).toBe('Nombre actualizado');expect(result.featureBullets).toEqual(['Acero galvanizado']);
 expect(api.patch).toHaveBeenCalledWith('/productos-maestro/p',expect.objectContaining({caracteristicasDestacadas:['Acero galvanizado'],pesoLogisticoKg:2,volumenLogisticoM3:null}),true);
});
it('invalidates cached product sheets only when the index version changes',()=>{
 localStorage.clear();const service:any=new FirebaseDataService({} as any,{} as any);
 service.acceptCatalogSearchVersion('one');
 localStorage.setItem('cotizapp-product-sheet-v1:real:abrazadera','cached');
 service.acceptCatalogSearchVersion('one');expect(localStorage.getItem('cotizapp-product-sheet-v1:real:abrazadera')).toBe('cached');
 service.acceptCatalogSearchVersion('two');expect(localStorage.getItem('cotizapp-product-sheet-v1:real:abrazadera')).toBeNull();
 localStorage.clear();
});
