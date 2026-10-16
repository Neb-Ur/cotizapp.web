import {vi} from 'vitest';
import {OfferPhotoManagerComponent} from './offer-photo-manager.component';
const photo={id:'photo',url:'https://cdn.example/own.webp',thumbnailUrl:'https://cdn.example/thumb.webp'};
async function setup(){const api:any={get:vi.fn(async()=>({imageStorage:{enabled:true}})),uploadImage:vi.fn(async()=>({photos:[photo]})),delete:vi.fn(async()=>({photos:[]}))};const component:any=new OfferPhotoManagerComponent(api);component.storeId='store';component.offerId='offer';await component.ngOnInit();return {component,api};}
const input=(files:File[])=>({target:{files,value:'selected'}}) as any;
it('retains successful images when the next file fails and permits a retry',async()=>{
 const {component,api}=await setup();api.uploadImage.mockResolvedValueOnce({photos:[photo]}).mockRejectedValueOnce(new Error('La segunda foto falló'));
 const changed=vi.spyOn(component.photosChange,'emit'),busy=vi.spyOn(component.busyChange,'emit');
 const event=input([new File(['one'],'one.png',{type:'image/png'}),new File(['two'],'two.png',{type:'image/png'})]);
 await component.upload(event);expect(component.photos).toEqual([photo]);expect(changed).toHaveBeenCalledTimes(1);expect(component.error()).toContain('segunda foto');expect(component.busy()).toBe(false);expect(busy).toHaveBeenLastCalledWith(false);expect(event.target.value).toBe('');
});
it('rejects unsupported files and an overflowing selection before uploading',async()=>{
 const {component,api}=await setup();await component.upload(input([new File(['text'],'bad.svg',{type:'image/svg+xml'})]));expect(api.uploadImage).not.toHaveBeenCalled();
 component.photos=Array(12).fill(photo);await component.upload(input([new File(['one'],'one.png',{type:'image/png'})]));expect(api.uploadImage).not.toHaveBeenCalled();expect(component.error()).toContain('12');
});
it('keeps photos after a failed delete and removes them after retry succeeds',async()=>{
 const {component,api}=await setup();component.photos=[photo];api.delete.mockRejectedValueOnce(new Error('Sin conexión'));
 await component.remove(photo);expect(component.photos).toEqual([photo]);expect(component.error()).toBe('Sin conexión');
 await component.remove(photo);expect(component.photos).toEqual([]);expect(api.delete).toHaveBeenLastCalledWith('/ferreterias/store/catalogo/offer/fotos/photo',true);
});
