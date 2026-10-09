import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ProductImageDirective,PRODUCT_IMAGE_PLACEHOLDER} from './product-image.directive';
@Component({standalone:true,imports:[ProductImageDirective],template:'<img [findiProductImage]="primary" [fullImageUrl]="full" [externalImageUrl]="external">'})
class Host {full='';primary='https://storage.example/image.webp';external='https://maker.example/product.webp';}
describe('Product image fallback',()=>{
 it('tries the R2 thumbnail, full image, external image and placeholder in order',()=>{
  const fixture=TestBed.createComponent(Host);fixture.componentInstance.primary='https://images.example/thumbnail.webp';fixture.componentInstance.full='https://images.example/detail.webp';fixture.detectChanges();
  const img:HTMLImageElement=fixture.nativeElement.querySelector('img');
  for(const expected of [fixture.componentInstance.primary,fixture.componentInstance.full,fixture.componentInstance.external,PRODUCT_IMAGE_PLACEHOLDER]){
   expect(img.getAttribute('src')).toBe(expected);img.dispatchEvent(new Event('error'));fixture.detectChanges();
  }
  expect(img.hasAttribute('src')).toBe(false);
 });
 it('tries Storage, external, then local without looping and resets when product changes',()=>{
  const fixture=TestBed.createComponent(Host);fixture.detectChanges();const img:HTMLImageElement=fixture.nativeElement.querySelector('img');
  expect(img.getAttribute('src')).toBe(fixture.componentInstance.primary);
  img.dispatchEvent(new Event('error'));fixture.detectChanges();expect(img.getAttribute('src')).toBe(fixture.componentInstance.external);
  img.dispatchEvent(new Event('error'));fixture.detectChanges();expect(img.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  img.dispatchEvent(new Event('error'));fixture.detectChanges();expect(img.hasAttribute('src')).toBe(false);
  fixture.componentInstance.primary='https://maker.example/new.webp';fixture.detectChanges();expect(img.getAttribute('src')).toBe(fixture.componentInstance.primary);
 });
 it('rejects unsafe URLs and missing images and does not retry identical URLs',()=>{
  const fixture=TestBed.createComponent(Host);fixture.componentInstance.primary='javascript:alert(1)';fixture.componentInstance.external='';fixture.detectChanges();const img:HTMLImageElement=fixture.nativeElement.querySelector('img');
  expect(img.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  fixture.componentInstance.primary='https://maker.example/p.webp';fixture.componentInstance.external=fixture.componentInstance.primary;fixture.detectChanges();img.dispatchEvent(new Event('error'));fixture.detectChanges();expect(img.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
 });
});
