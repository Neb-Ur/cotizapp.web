import { Injectable, signal } from '@angular/core';
import { ApiClientService } from './api-client.service';
import { SearchIndexSnapshot, SuggestionGroup, prepareCatalogIndex } from '../utils/catalog-search-index.util';

@Injectable({providedIn:'root'})
export class CatalogSearchIndexService {
  readonly ready = signal(false);
  readonly version = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  private snapshot?: SearchIndexSnapshot;
  private searchInMemory?: (query:string)=>SuggestionGroup[];
  private pending?: Promise<void>;
  private checkedAt=0;

  constructor(private readonly api:ApiClientService) {}
  search(query:string):SuggestionGroup[] { return this.searchInMemory?.(query)||[]; }

  ensureReady(revalidate = false):Promise<void> {
    if (typeof window==='undefined') return Promise.resolve();
    if (this.pending) return this.pending;
    if (this.ready() && !revalidate && Date.now()-this.checkedAt<300_000) return Promise.resolve();
    this.pending=this.load().finally(()=>{this.pending=undefined;});
    return this.pending;
  }

  private async load():Promise<void> {
    this.loading.set(true);this.error.set('');
    try {
      if (!this.snapshot) {
        // A damaged or unavailable local cache must not prevent a fresh download.
        try {
          const saved=await this.storage('read');
          if (this.valid(saved)) this.apply(saved);
        } catch { /* Continue with the network index. */ }
      }
      const fresh=await this.fetchIndex();
      if (fresh?.unchanged && fresh.version===this.snapshot?.version) { this.checkedAt=Date.now();return; }
      if (!this.valid(fresh)) throw new Error('Invalid index');
      this.apply(fresh);this.checkedAt=Date.now();
      void this.storage('write',fresh);
    } catch {
      if (!this.ready()) this.error.set('No pudimos cargar las sugerencias. Puedes buscar con Enter o reintentar.');
    } finally { this.loading.set(false); }
  }
  private async fetchIndex():Promise<any> {
    for (let attempt=0; ; attempt++) {
      try {
        return await this.api.get<any>('/catalogo-busqueda',false,{v:this.snapshot?.version});
      } catch (error) {
        // Recover brief connection failures without requiring another user click.
        if (attempt>=2) throw error;
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
      }
    }
  }
  private valid(value:any):value is SearchIndexSnapshot {
    return value?.schema===1 && typeof value.version==='string' && Array.isArray(value.products)
      && Array.isArray(value.categories)&&Array.isArray(value.subcategories)&&Array.isArray(value.families)
      && [value.categories,value.subcategories,value.families].every(items=>items.every((item:any)=>item && typeof item.id==='string'&&typeof item.name==='string'))
      && value.products.every((item:any)=>item && typeof item.id==='string'&&typeof item.name==='string'&&typeof item.brand==='string');
  }
  private apply(snapshot:SearchIndexSnapshot):void {
    this.searchInMemory=prepareCatalogIndex(snapshot);this.snapshot=snapshot;this.version.set(snapshot.version);this.ready.set(true);
  }
  private storage(action:'read'|'write',value?:SearchIndexSnapshot):Promise<any> {
    // Bound blocked or stalled IndexedDB access; search still works in memory.
    return new Promise(resolve=>{
      if (typeof indexedDB==='undefined') {resolve(null);return;}
      let db:IDBDatabase|undefined;
      let done=false;
      const finish=(result:any)=>{if(done)return;done=true;clearTimeout(timer);db?.close();resolve(result);};
      const timer=setTimeout(()=>finish(null),1_500);
      try {
        const request=indexedDB.open('cotizapp-search-v1',1);
        request.onupgradeneeded=()=>request.result.createObjectStore('catalog');
        request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
        request.onsuccess=()=>{
          db=request.result;if(done){db.close();return;}
          try {
            const transaction=db.transaction('catalog',action==='read'?'readonly':'readwrite');
            const store=transaction.objectStore('catalog');
            const operation=action==='read'?store.get('index'):store.put(value,'index');
            let result:any=null;operation.onsuccess=()=>{result=action==='read'?operation.result:null;};
            transaction.oncomplete=()=>finish(result);transaction.onerror=()=>finish(null);transaction.onabort=()=>finish(null);
          } catch {finish(null);}
        };
      } catch {finish(null);}
    });
  }
}
