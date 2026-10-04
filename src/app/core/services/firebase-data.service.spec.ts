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
