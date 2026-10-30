import { vi } from 'vitest';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { buildQuotationOptimization } from '../../core/utils/quotation-optimizer.util';
import { readNearbySearchPreference, saveNearbySearchPreference } from '../../core/utils/location.util';
import { ProyectoDetalleComponent } from './proyecto-detalle.component';
import { DataModeService } from '../../core/services/data-mode.service';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { ActivatedRoute, Router } from '@angular/router';

describe('quotation drafts isolated by account and environment',()=>{
  beforeEach(()=>localStorage.clear());
  it('never restores another account or environment and discards the legacy shared draft',()=>{
    let uid='first';let mode='real';
    const component=new ProyectoDetalleComponent({mode:()=>mode} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:uid,role:'maestro'})} as unknown as AuthService,{buildProjectQuotation:()=>({})} as unknown as FirebaseDataService) as any;
    component.projectName='Private work';component.projectAddress='Private address';component.projectItems=[{productName:'Cemento',quantity:2}];
    component.persistDraftIfNeeded();
    expect(component.readDraft()?.address).toBe('Private address');
    localStorage.setItem('construcomparador-project-draft',JSON.stringify({address:'Legacy private address'}));
    uid='second';expect(component.readDraft()).toBeNull();expect(localStorage.getItem('construcomparador-project-draft')).toBeNull();
    uid='first';mode='retired';expect(component.readDraft()).toBeNull();
    mode='real';expect(component.readDraft()?.items).toEqual([{productName:'Cemento',quantity:2}]);
  });
});
it('keeps the displayed verification code synchronized after saving a store selection',async()=>{
 const api={buildProjectQuotation:()=>({appliedStoreName:'Local',appliedStoreId:'store'}),updateProject:async()=>({verificationCode:'FND-AAAA-BBBB-CCCC-DDDD',pricingOffers:[],validUntil:'2026-10-19T12:00:00Z',pricesCapturedAt:'2026-10-09T12:00:00Z'})};
 const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,api as unknown as FirebaseDataService) as any;
 component.isNewProject=false;component.projectId='quote';component.selectedSingleStoreName='Local';component.selectedSingleStoreId='store';
 expect(await component.persistExistingPurchaseSelection()).toBe(true);expect(component.verificationCode).toBe('FND-AAAA-BBBB-CCCC-DDDD');expect(component.hasUnsavedChanges).toBe(false);
});

it('opens the complete catalog while keeping the destination quotation', async () => {
 const navigate = vi.fn();
 const component = new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{navigate} as unknown as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,{buildProjectQuotation:()=>({})} as unknown as FirebaseDataService) as any;
 component.isNewProject=false; component.projectId='quote'; component.savedFingerprint=component.quotationFingerprint();
 localStorage.setItem('cotizapp-cookie-consent-v2',JSON.stringify({version:3,preferences:true,analytics:false,updatedAt:new Date().toISOString()}));
 saveNearbySearchPreference({latitude:-33.4,longitude:-70.6,radiusKm:5});
 expect(readNearbySearchPreference()?.radiusKm).toBe(5);
 await component.goToSearchForProduct();
 expect(readNearbySearchPreference()).toBeNull();
 expect(navigate).toHaveBeenCalledWith(['/buscar'], {queryParams:{projectTarget:'quote',draftName:null,draftAddress:null}});
});

it('saves changes before adding products and stays when saving fails', async () => {
 const navigate=vi.fn();
 const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{navigate} as unknown as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,{buildProjectQuotation:()=>({})} as unknown as FirebaseDataService) as any;
 component.isNewProject=false;component.projectId='quote';component.projectName='Edited name';
 component.saveProject=vi.fn(async()=>{});
 await component.goToSearchForProduct();
 expect(component.saveProject).toHaveBeenCalledOnce();expect(navigate).not.toHaveBeenCalled();
 component.saveProject=vi.fn(async()=>{component.savedFingerprint=component.quotationFingerprint();});
 await component.goToSearchForProduct();expect(navigate).toHaveBeenCalledOnce();
});


describe('purchase strategy save failures', () => {
 for (const mixed of [false, true]) {
  it(`restores the saved strategy when ${mixed ? 'mixed' : 'single store'} saving is rejected`, async () => {
   const api={
    buildProjectQuotation:vi.fn((_items,_proximity,name,id)=>({appliedStoreName:name,appliedStoreId:id,singleStoreOptions:[{storeName:'Local',storeId:'store',total:1000}]})),
    updateProject:vi.fn().mockRejectedValue(new Error('Sin conexión'))
   };
   const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,api as unknown as FirebaseDataService) as any;
   component.isNewProject=false;component.projectId='quote';component.projectName='Obra';
   component.selectedSingleStoreName=mixed ? 'Local' : '';
   component.selectedSingleStoreId=mixed ? 'store' : '';
   component.savedFingerprint=component.quotationFingerprint();
   await expect(mixed ? component.useMixedPurchase() : component.applySingleStore('Local','store')).resolves.toBeUndefined();
   expect(component.selectedSingleStoreName).toBe(mixed ? 'Local' : '');
   expect(component.selectedSingleStoreId).toBe(mixed ? 'store' : '');
   expect(component.singleStoreNotice).toContain('No se pudo');
   expect(component.hasUnsavedChanges).toBe(false);
   expect(component.isSaving).toBe(false);
  });
 }
});


it('keeps each row matched to its offer after another product is cleared', () => {
 const offers=[{productName:'Cemento',storeName:'Local cemento',price:1000,stock:20},{productName:'Pintura',storeName:'Local pintura',price:5000,stock:20}];
 const api={buildProjectQuotation:(items:any[])=>buildQuotationOptimization(items,offers)};
 const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,api as unknown as FirebaseDataService) as any;
 const cleared={productName:'',quantity:2};const cement={productName:'Cemento',quantity:3};const paint={productName:'Pintura',quantity:1};
 component.projectItems=[cleared,cement,paint];
 expect(component.getRowUnitPrice(cleared)).toBe(0);
 expect(component.getRowBestStore(cleared)).toBe('Sin datos');
 expect(component.getRowUnitPrice(cement)).toBe(1000);
 expect(component.getRowBestStore(cement)).toBe('Local cemento');
 expect(component.getRowTotal(cement)).toBe(3000);
 expect(component.getRowUnitPrice(paint)).toBe(5000);
 expect(component.getRowBestStore(paint)).toBe('Local pintura');
});


it('serializes purchase strategy writes and releases the save state after completion', async () => {
 let finish!:(value:any)=>void;
 const api={
  buildProjectQuotation:vi.fn((_items,_proximity,name,id)=>({appliedStoreName:name,appliedStoreId:id,singleStoreOptions:[{storeName:'Local',storeId:'store',total:1000}]})),
  updateProject:vi.fn(()=>new Promise(resolve=>{finish=resolve;}))
 };
 const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,api as unknown as FirebaseDataService) as any;
 component.isNewProject=false;component.projectId='quote';component.projectName='Obra';
 const saving=component.applySingleStore('Local','store');
 expect(component.isSaving).toBe(true);
 await component.useMixedPurchase();
 await component.applySingleStore('Local','store');
 expect(api.updateProject).toHaveBeenCalledOnce();
 expect(component.selectedSingleStoreId).toBe('store');
 finish({verificationCode:'CODE',pricingOffers:[]});await saving;
 expect(component.isSaving).toBe(false);
 expect(component.hasUnsavedChanges).toBe(false);
});

describe('edits while a quotation write is pending', () => {
 beforeEach(()=>localStorage.clear());
 for (const action of ['strategy','update','create']) {
  it(`preserves later edits and keeps them dirty after ${action} completes`, async () => {
   let finish!:(value:any)=>void;
   const request=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
   const api={
    buildProjectQuotation:vi.fn((_items,_proximity,name,id)=>({appliedStoreName:name,appliedStoreId:id,singleStoreOptions:[{storeName:'Local',storeId:'store',total:1000}]})),
    updateProject:request,saveProject:request
   };
   const navigate=vi.fn();const guest=new GuestQuotationService();
   const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,{} as ActivatedRoute,{navigate} as unknown as Router,{currentUser:()=>({id:'user',role:'maestro'})} as unknown as AuthService,api as unknown as FirebaseDataService,undefined,null,null,guest) as any;
   component.isNewProject=action==='create';component.projectId=action==='create'?'nuevo':'quote';component.projectName='Obra original';
   component.projectItems=[{productName:'Cemento',quantity:1}];
   const sentBudget=structuredClone(component.workBudget);
   if(action==='create'){
    component.importedGuestId=guest.create('Obra original').id;
    component.persistDraftIfNeeded();
   }
   component.savedFingerprint=component.quotationFingerprint();
   const saving=action==='strategy' ? component.applySingleStore('Local','store') : component.saveProject(false,action==='create');
   expect(component.isSaving).toBe(true);
   component.projectName='Obra editada durante el guardado';
   component.projectItems[0].quantity=4;
   component.workBudget.clientName='Cliente editado durante el guardado';
   component.persistDraftIfNeeded();
   finish({id:'quote',verificationCode:'CODE',pricingOffers:[],workBudget:sentBudget});
   await saving;
   expect(component.projectName).toBe('Obra editada durante el guardado');
   expect(component.projectItems[0].quantity).toBe(4);
   expect(component.workBudget.clientName).toBe('Cliente editado durante el guardado');
   expect(component.isSaving).toBe(false);
   expect(component.hasUnsavedChanges).toBe(true);
   if(action==='create'){
    expect(navigate).not.toHaveBeenCalled();
    expect(component.saveNotice).toContain('Hay cambios pendientes');
    expect(guest.get(component.importedGuestId)?.name).toBe(component.projectName);
    expect(component.readDraft()?.items[0].quantity).toBe(4);
    component.projectItems[0].quantity=5;component.persistDraftIfNeeded();
    expect(guest.get(component.importedGuestId)?.items[0].quantity).toBe(5);
    expect(component.readDraft()?.items[0].quantity).toBe(5);
    const finalBudget=structuredClone(component.workBudget);
    const resaving=component.saveProject(false,true);
    finish({id:'quote',verificationCode:'NEW-CODE',pricingOffers:[],workBudget:finalBudget});
    await resaving;
    expect(component.hasUnsavedChanges).toBe(false);
    expect(guest.get(component.importedGuestId)).toBeNull();
    expect(component.readDraft()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/dashboard/maestro/cotizaciones','quote']);
   }
  });
 }
});
