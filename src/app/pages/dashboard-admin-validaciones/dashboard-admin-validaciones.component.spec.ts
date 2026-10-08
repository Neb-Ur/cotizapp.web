import { vi } from 'vitest';
import { DashboardAdminValidacionesComponent } from './dashboard-admin-validaciones.component';
const product = {technicalSheet:[],descriptionBlocks:[],gallery:[],featureBullets:[],extraSections:[],id:'p1',masterProductId:'p1',name:'Abrazadera metálica',brand:'',categoryId:'c',subcategoryId:'s',familyId:'f',isPublished:true};
function fixture() {
 const api:any={getFamilyDefinitionRows:()=>[],updateMasterCatalogProduct:vi.fn(async()=>({...product,name:'Abrazadera de acero'})),saveMasterProductAttributes:vi.fn(async()=>undefined)};
 const component:any=new DashboardAdminValidacionesComponent(api,{} as any,{} as any,{} as any,{} as any,{} as any,{detectChanges:vi.fn()} as any);
 component.ensureMasterDefinitionsLoaded=vi.fn(async()=>undefined);
 component.loadAdminMasterCatalog=vi.fn(async()=>undefined);
 return {component,api};
}
it('opens the detail immediately with loading before definitions arrive',async()=>{
 const {component,api}=fixture(); let finish!:()=>void;
 component.ensureMasterDefinitionsLoaded=()=>new Promise<void>(resolve=>finish=resolve);
 api.getMasterCatalogProductDetail=vi.fn(async()=>({product,attributes:[]}));
 const opening=component.openMasterProductEdit(product);
 expect(component.masterDetailModalOpen).toBe(true);expect(component.masterDetailLoading).toBe(true);
 expect(api.getMasterCatalogProductDetail).not.toHaveBeenCalled();
 finish();await opening;
 expect(component.masterDetailLoading).toBe(false);expect(component.masterDetailDraft.name).toBe(product.name);
});
it('prevents late details from overwriting a subsequently opened product',async()=>{
 const {component,api}=fixture(); let finish!:(value:any)=>void;
 api.getMasterCatalogProductDetail=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>finish=resolve)).mockResolvedValueOnce({product:{...product,id:'p2',name:'Segundo producto'},attributes:[]});
 const first=component.openMasterProductEdit(product);await Promise.resolve();
 await component.openMasterProductEdit({...product,id:'p2',masterProductId:'p2',name:'Segundo producto'});
 finish({product,attributes:[]});await first;
 expect(component.masterDetailDraft.name).toBe('Segundo producto');
});
it('shows saving immediately and keeps the updated detail open',async()=>{
 const {component,api}=fixture();let finish!:(value:any)=>void;
 component.masterDetailReadonly=false;component.masterDetailModalOpen=true;component.selectedMasterProduct=product;
 Object.assign(component.masterDetailDraft,product,{contentSourceType:'original',contentAuthorizationReference:'Redacción propia'});
 api.updateMasterCatalogProduct.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 const saving=component.saveMasterProduct();
 expect(component.masterDetailSaving).toBe(true);
 finish({...product,name:'Abrazadera de acero'});await saving;
 expect(component.masterDetailSaving).toBe(false);expect(component.masterDetailModalOpen).toBe(true);
 expect(component.selectedMasterProduct.name).toBe('Abrazadera de acero');
});

it('preserves logistics values when reopening a sheet with accented labels',()=>{
 const {component}=fixture();
 const draft=component.mapProductToDraft({...product,technicalSheet:[{label:'Peso logístico (kg)',value:'2.5'},{label:'Volumen logístico (m3)',value:'0.1'},{label:'Unidades por pallet',value:'40'}]});
 expect(draft.logisticsWeightKg).toBe(2.5);expect(draft.logisticsVolumeM3).toBe(0.1);expect(draft.logisticsPalletUnits).toBe(40);
});
