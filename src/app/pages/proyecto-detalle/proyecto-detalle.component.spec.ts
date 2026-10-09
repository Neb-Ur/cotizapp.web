import { vi } from 'vitest';
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
 localStorage.setItem('cotizapp-cookie-consent-v2',JSON.stringify({version:2,preferences:true,analytics:false,updatedAt:new Date().toISOString()}));
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
