import {vi} from 'vitest';
import {ProductImageUploadComponent} from './product-image-upload.component';
import {ApiClientService} from '../../../core/services/api-client.service';
function fixture(){const api={get:vi.fn(async()=>({imageStorage:{enabled:true}})),uploadImage:vi.fn()};return {api,component:new ProductImageUploadComponent(api as unknown as ApiClientService) as any};}
describe('Product image upload',()=>{
 it('keeps uploads disabled when storage is not configured',async()=>{
  const {component,api}=fixture();api.get.mockResolvedValue({imageStorage:{enabled:false}});await component.ngOnInit();
  expect(component.enabled()).toBe(false);expect(component.statusMessage()).toContain('URL');
 });
 it('shows an immediate busy state, emits the uploaded variants and releases the form',async()=>{
  const {component,api}=fixture();await component.ngOnInit();let resolve!:(value:any)=>void;
  api.uploadImage.mockImplementation(()=>new Promise(r=>resolve=r));const emitted=vi.spyOn(component.uploaded,'emit'),busy=vi.spyOn(component.busyChange,'emit');
  const image={storageImageUrl:'https://images.example/detail.webp',storageImagePath:'p/detail.webp',thumbnailImageUrl:'https://images.example/thumb.webp',thumbnailImagePath:'p/thumb.webp'};
  const pending=component.selectFile({target:{files:[new File(['image'],'test.png',{type:'image/png'})],value:'test.png'}});
  expect(component.busy()).toBe(true);expect(busy).toHaveBeenCalledWith(true);resolve(image);await pending;
  expect(emitted).toHaveBeenCalledWith(image);expect(component.busy()).toBe(false);expect(busy).toHaveBeenLastCalledWith(false);expect(component.message()).toContain('Guarda');
 });
 it('rejects invalid files and restores controls after upload failure',async()=>{
  const {component,api}=fixture();await component.ngOnInit();
  await component.selectFile({target:{files:[new File(['svg'],'test.svg',{type:'image/svg+xml'})],value:'test.svg'}});
  expect(api.uploadImage).not.toHaveBeenCalled();expect(component.error()).toContain('8 MB');
  api.uploadImage.mockRejectedValue(new Error('secret provider error'));
  await component.selectFile({target:{files:[new File(['png'],'test.png',{type:'image/png'})],value:'test.png'}});
  expect(component.busy()).toBe(false);expect(component.error()).not.toContain('secret');
 });
});
