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

it('opens metrics first, caches the view and refreshes only when explicitly requested',async()=>{
 const {component}=fixture();let finish!:(value:any)=>void;
 component.metricsService={load:vi.fn(()=>new Promise(resolve=>finish=resolve))};
 const initial=component.initializeDashboard();expect(component.currentSection).toBe('inicio');expect(component.isSectionLoading).toBe(true);
 finish({today:2,days:[]});await initial;
 expect(component.metrics.today).toBe(2);expect(component.isInitialLoading).toBe(false);
 await component.ensureSectionData('inicio');expect(component.metricsService.load).toHaveBeenCalledTimes(1);
 component.metricsService.load.mockResolvedValue({today:3,days:[]});await component.refreshAll();
 expect(component.metrics.today).toBe(3);expect(component.metricsService.load).toHaveBeenCalledTimes(2);
});


it('creates a test store explicitly and preserves its classification when opening the editor',async()=>{
 const {component}=fixture();
 const created={id:'owner',role:'ferreteria',ferreteriaId:'s',email:'local@example.test',displayName:'Local',businessName:'Local',isTestStore:true};
 component.authService={adminCreateUser:vi.fn(async()=>created)};
 component.ensureUsersLoaded=vi.fn(async()=>undefined);component.inspectStoreCatalog=vi.fn(async()=>undefined);
 component.openStoreCreate();expect(component.storeCreateDraft.isTestStore).toBe(false);
 Object.assign(component.storeCreateDraft,{displayName:'Contacto',businessName:'Local',email:'local@example.test',password:'Test123!',city:'Santiago',commune:'Maipú',address:'Prueba',storeLatitude:-33.5,storeLongitude:-70.6,isTestStore:true});
 await component.createStore();
 expect(component.authService.adminCreateUser).toHaveBeenCalledWith(expect.objectContaining({role:'ferreteria',isTestStore:true}));
 component.openUserEdit(created);expect(component.userModalDraft.isTestStore).toBe(true);
});

it('maps previously shared hardware products to the current hardware classification',()=>{
 const {component}=fixture();expect(component.mapProductToDraft({...product,businessScope:'ambos'}).businessScope).toBe('ferreteria');
});

it('keeps hardware classification while changing supported product categories',()=>{
 const {component,api}=fixture();api.getSubcategoryOptions=()=>[];api.getFamilyOptions=()=>[];
 component.masterDetailDraft.categoryId='construction';component.onDraftCategoryChange();expect(component.masterDetailDraft.businessScope).toBe('ferreteria');
 component.masterBusinessScopeTouched=true;component.masterDetailDraft.businessScope='ferreteria';component.masterDetailDraft.categoryId='cat-herramientas-y-consumibles';component.onDraftCategoryChange();expect(component.masterDetailDraft.businessScope).toBe('ferreteria');
});

it('restores the summary on Back to an admin URL without a section',()=>{
 const {component}=fixture();component.router={url:'/dashboard/admin/validaciones',navigate:vi.fn()};component.ensureSectionData=vi.fn();
 component.currentSection='ferreterias';component.syncSectionFromUrl();expect(component.currentSection).toBe('inicio');
 component.router.url='/dashboard/admin/validaciones?section=productos#ficha';component.syncSectionFromUrl();expect(component.currentSection).toBe('productos');
});
