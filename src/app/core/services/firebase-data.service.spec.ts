import { vi } from 'vitest';
import { FirebaseDataService } from './firebase-data.service';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth.service';

const master = { id: 'master', nombre: 'Cemento gris 25 kg', codigoBarras: '780001', categoriaId: 'cat', subcategoriaId: 'sub', familiaId: 'fam', marca: 'Marca' };
function fixture() {
 const catalog: any[] = [];
 const writes: { path: string; body: any }[] = [];
 let projectFailure = false;
 const api = {
  get: vi.fn(async (path: string) => {
   if (path === '/productos-maestro') return [master];
   if (path === '/productos/detalle') return {productoMaestro:master,stores:[],atributosProducto:[{definicionAtributoId:'weight',etiqueta:'Peso',valorNumero:0},{definicionAtributoId:'waterproof',etiqueta:'Impermeable',valorBooleano:false}]};
   if (path === '/familias') return [{id:'fam',nombre:'Cemento',subcategoriaId:'sub'}];
   if (path === '/ferreterias/store/catalogo') return catalog;
   if (path === '/maestros/user/proyectos') {
    if (projectFailure) throw new Error('API unavailable');
    return [{id:'project',name:'Obra',createdAt:'2026-01-01',singleStoreName:'Cadena',singleStoreId:'south',items:[]}];
   }
   return [];
  }),
  post: vi.fn(async (path: string, body: any) => {
   writes.push({path,body});
   if (path === '/ferreterias/store/catalogo') catalog.push({ id:'offer', ...body, productoMaestro:master });
   return {id:'created'};
  })
 };
 const service = new FirebaseDataService(api as unknown as ApiClientService, {currentUser:()=>({id:'user',ferreteriaId:'store'})} as unknown as AuthService);
 return { service, api, writes, failProjects: (value: boolean) => projectFailure = value };
}
const options = {categoryId:'cat',subcategoryId:'sub',familyId:'fam',brand:'Marca',unitLabel:'Unidad',isPublished:false};
describe('catalog import and loading regressions', () => {
 it('sends a fuzzy match to review with SKU, stock and publication choice intact', async () => {
  const { service, writes } = fixture();
  const result = await service.importCatalogBatch('user','Local','nombre,sku,precio,stock,codigo_barras\nCemento gris,LOCAL,1500,0,',options);
  expect(result.report.rows[0].outcome).toBe('posible_match');
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toContain('/solicitudes-creacion-producto');
  expect(writes[0].body).toMatchObject({skuFerreteria:'LOCAL',cantidadReferencia:0,publicado:false});
 });
 it('links only an exact product and preserves imported identifiers', async () => {
  const { service, writes } = fixture();
  const result = await service.importCatalogBatch('user','Local','nombre,sku,precio,stock,codigo_barras\nCemento gris 25 kg,LOCAL,1500,0,780001',options);
  expect(result.report.rows[0].outcome).toBe('subido');
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({path:'/ferreterias/store/catalogo',body:{productoMaestroId:'master',skuFerreteria:'LOCAL',codigoBarras:'780001',precio:1500,stock:0,publicado:false}});
 });
 it('shows readable attribute labels and keeps valid zero and false values', async () => {
  const {service} = fixture();
  const detail = await service.loadProductDetail(master.nombre);
  expect(detail?.technicalSheet).toEqual([{label:'Peso',value:'0'},{label:'Impermeable',value:'false'}]);
 });
 it('retains prior projects on failure, shows an error and recovers after explicit retry', async () => {
  const {service,failProjects} = fixture();
  await service.refreshMaestroProjectsSection('user');
  expect(service.getProjects('user')[0].singleStoreId).toBe('south');
  failProjects(true);
  await expect(service.refreshMaestroProjectsSection('user',true)).rejects.toThrow();
  expect(service.loadError()).toContain('cotizaciones');
  expect(service.getProjects('user')).toHaveLength(1);
  failProjects(false);
  await service.refreshMaestroProjectsSection('user',true);
  expect(service.loadError()).toBe('');
 });
});

describe('master catalog variants without images', () => {
 it('loads drafts through the authenticated administrator endpoint and preserves variant fields', async () => {
  const {service,api}=fixture();
  api.get.mockResolvedValueOnce({items:[{...master,estado:'inactivo',tipoProducto:'MDF desnudo',unidadVenta:'Placa',presentacion:'1 placa'}],total:1,page:1,size:20,totalPages:1} as any);
  const result=await service.getAdminMasterCatalogPage({});
  expect(api.get).toHaveBeenCalledWith('/admin/productos-maestro/paginado',true,expect.any(Object));
  expect(result.items[0]).toMatchObject({isPublished:false,productType:'MDF desnudo',unitLabel:'Placa',packagingLabel:'1 placa',imageUrl:'',gallery:[]});
 });
 it('persists product type, sale unit, presentation and draft state independently from descriptions', async () => {
  const {service,writes}=fixture();
  await service.createMasterCatalogProduct({name:'MDF negro 18 mm',productType:'MDF desnudo',unitLabel:'Placa',packagingLabel:'1 placa',isPublished:false,imageUrl:'',gallery:[]},false);
  expect(writes[0].body).toMatchObject({tipoProducto:'MDF desnudo',unidadVenta:'Placa',presentacion:'1 placa',estado:'inactivo',imagenPrincipalUrl:'',galeriaJson:[]});
 });
});

it('shows active catalog bases in home suggestions even when no store offers exist', () => {
 const {service}=fixture();
 (service as any).masterCatalog.push({id:'base',name:'Tablero MDF desnudo',familyId:'mdf',isPublished:true,brand:'Por especificar',productType:'Tablero MDF desnudo',imageUrl:''});
 const rows=service.getPopularProductRows('MDF',6,undefined,false);
 expect(rows).toHaveLength(1);
 expect(rows[0]).toMatchObject({productName:'Tablero MDF desnudo',storeCount:0,minPrice:0,maxPrice:0,sellers:[],imageUrl:''});
 expect(service.getFamilyProductRows('other','',undefined,false)).toHaveLength(0);
});

it('loads detail directly by slug without downloading all master products, offers or taxonomy', async () => {
 const {service,api}=fixture();
 const detail=await service.loadProductDetail(undefined,'cemento-gris-25-kg');
 expect(detail?.productName).toBe(master.nombre);
 expect(api.get.mock.calls.map(call=>call[0])).toEqual(['/productos/detalle']);
 expect(api.get).toHaveBeenCalledWith('/productos/detalle',false,{producto:undefined,slug:'cemento-gris-25-kg'});
 await service.loadProductDetail(undefined,'cemento-gris-25-kg');
 expect(api.get).toHaveBeenCalledTimes(1);
});


it('persists only the sheet across service instances and requests offers independently', async () => {
 const key='cotizapp-product-sheet-v1:real:cemento-gris-25-kg';
 localStorage.removeItem(key);
 try {
  const first=fixture();
  const sheet=await first.service.loadProductSheet(undefined,'cemento-gris-25-kg');
  expect(sheet?.stores).toEqual([]);
  expect(JSON.parse(localStorage.getItem(key)!).raw.stores).toBeUndefined();
  const second=fixture();
  const cached=await second.service.loadProductSheet(undefined,'cemento-gris-25-kg');
  expect(second.api.get).not.toHaveBeenCalled();
  await second.service.loadProductOffers(cached!);
  await second.service.loadProductOffers(cached!);
  expect(second.api.get).toHaveBeenCalledTimes(2);
  expect(second.api.get).toHaveBeenCalledWith('/productos/detalle',false,{slug:'cemento-gris-25-kg',vista:'ofertas'});
  const stored=JSON.parse(localStorage.getItem(key)!);stored.savedAt=Date.now()-3_600_001;
  localStorage.setItem(key,JSON.stringify(stored));
  await second.service.loadProductSheet(undefined,'cemento-gris-25-kg');
  expect(second.api.get).toHaveBeenLastCalledWith('/productos/detalle',false,{producto:undefined,slug:'cemento-gris-25-kg',vista:'ficha'});
 } finally { localStorage.removeItem(key); }
});

describe('public catalog browser cache',()=>{
 it('keeps previous product sheets available but drops old prices and refreshes even when the revision is unchanged',async()=>{
  const key='cotizapp.publicCatalog.v3:real';
  const snapshot={version:'cached-version',updatedAt:new Date(Date.now()-3600000).toISOString(),products:[master],taxonomy:{categories:[],subcategories:[],families:[]},searchRows:[{productName:master.nombre,productoMaestroId:'master',productoFerreteriaId:'offer',storeId:'store',storeName:'Local',price:1000,stock:10}],cachedAt:Date.now()-3600000};
  localStorage.setItem(key,JSON.stringify(snapshot));
  try {
   const {service,api}=fixture();
   const original=api.get.getMockImplementation();api.get.mockImplementation(async(path:string):Promise<any>=>path==='/catalogo-publico/version'?{version:'cached-version'}:path==='/catalogo-publico'?{...snapshot,searchRows:[]}:original!(path));
   await service.refreshPublicCatalogSection();expect(api.get).not.toHaveBeenCalled();
   const cards=service.getFamilyProductRows('', '',undefined,false);expect(cards.length).toBe(1);expect(cards[0].storeCount).toBe(0);expect(cards[0].minPrice).toBe(0);
   await service.refreshPublicCatalogEnhancements();expect(api.get).toHaveBeenCalledWith('/catalogo-publico',false,{v:'cached-version'});
  }finally{localStorage.removeItem(key);}
 });
});

describe('referential product imagery',()=>{
 it('keeps catalog identity and makes generic external photos distinguishable from generated imagery',()=>{
  const {service}=fixture();const base={...master,marca:'Por especificar',imagenStorageUrl:'https://images.example/detail.webp',imagenMiniaturaUrl:'https://images.example/thumb.webp',imagenExternaUrl:'https://maker.example/photo.jpg',imagenReferencial:true};
  const external=(service as any).mapProductDetail({productoMaestro:{...base,origenImagen:'external_url'},stores:[]});
  expect(external.brand).toBe('Por especificar');expect(external.imageDisclosure).toContain('Imagen referencial del tipo');expect(external.imageUrl).toBe(base.imagenStorageUrl);expect(external.imageFallbackUrl).toBe(base.imagenExternaUrl);
  const generated=(service as any).mapProductDetail({productoMaestro:{...base,origenImagen:'ai_generated'},stores:[]});
  expect(generated.imageDisclosure).toContain('inteligencia artificial');
 });
});
