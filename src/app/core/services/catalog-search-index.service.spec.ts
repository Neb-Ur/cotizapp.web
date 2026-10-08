import { vi } from 'vitest';
import { CatalogSearchIndexService } from './catalog-search-index.service';
import { ApiClientService } from './api-client.service';
const snapshot={schema:1,version:'v1',products:[{id:'1',name:'MDF negro 18 mm',brand:'Por especificar',categoryId:'c',subcategoryId:'s',familyId:'f'}],categories:[],subcategories:[],families:[]};
it('loads once and performs successive searches without network requests',async()=>{
 const api={get:vi.fn(async()=>snapshot)};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockResolvedValue(null);
 await service.ensureReady();service.search('mdf');service.search('negro');await service.ensureReady();
 expect(api.get).toHaveBeenCalledTimes(1);expect(service.ready()).toBe(true);
});
it('serves a saved index while an offline revalidation is pending or fails',async()=>{
 let reject!:(reason:any)=>void;
 const api={get:vi.fn().mockImplementationOnce(()=>new Promise((_r,j)=>reject=j)).mockRejectedValue(new Error('Offline'))};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockResolvedValue(snapshot);
 const pending=service.ensureReady();await Promise.resolve();await Promise.resolve();
 expect(service.search('18mm negro')[0].items[0].id).toBe('1');
 reject(new Error('Offline'));await pending;expect(service.ready()).toBe(true);expect(service.error()).toBe('');
});
it('accepts an unchanged version and avoids rewriting the stored index',async()=>{
 const api={get:vi.fn(async()=>({version:'v1',unchanged:true}))};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 const storage=vi.spyOn(service as any,'storage').mockResolvedValue(snapshot);
 await service.ensureReady();expect(service.search('mdf')[0].items[0].id).toBe('1');
 expect(storage).toHaveBeenCalledTimes(1);
});

it('recovers an initial network failure automatically and keeps subsequent searches local',async()=>{
 const api={get:vi.fn().mockRejectedValueOnce(new Error('Temporary outage')).mockResolvedValue(snapshot)};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockResolvedValue(null);
 await service.ensureReady();
 expect(api.get).toHaveBeenCalledTimes(2);
 expect(service.error()).toBe('');
 expect(service.search('mdf')[0].items[0].id).toBe('1');
 await service.ensureReady();expect(api.get).toHaveBeenCalledTimes(2);
});
it('ignores a damaged cache and downloads a fresh index',async()=>{
 const api={get:vi.fn(async()=>snapshot)};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockResolvedValue({...snapshot,categories:[null]});
 await service.ensureReady();expect(service.ready()).toBe(true);expect(api.get).toHaveBeenCalledTimes(1);
});
it('still loads suggestions when reading local storage fails',async()=>{
 const api={get:vi.fn(async()=>snapshot)};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(null);
 await service.ensureReady();expect(service.ready()).toBe(true);
});

it('updates names when a new typing session revalidates, without a browser reload',async()=>{
 const next={...snapshot,version:'v2',products:[{...snapshot.products[0],name:'MDF rojo 18 mm'}]};
 const api={get:vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce(next)};
 const service=new CatalogSearchIndexService(api as unknown as ApiClientService);
 vi.spyOn(service as any,'storage').mockResolvedValue(null);
 await service.ensureReady();
 const refresh=service.ensureReady(true);
 expect(service.search('negro')[0].items[0].name).toContain('negro');
 await refresh;
 expect(service.search('negro')).toEqual([]);
 expect(service.search('rojo')[0].items[0].name).toContain('rojo');
 expect(api.get).toHaveBeenCalledTimes(2);
});
