import {TestBed} from '@angular/core/testing';
import {StoreWhatsappComponent} from './store-whatsapp.component';
describe('store WhatsApp contact',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('opens an accessible draft without selecting its parent offer',()=>{
  const fixture=TestBed.createComponent(StoreWhatsappComponent);
  fixture.componentRef.setInput('phone','+56991036780');fixture.componentRef.setInput('storeName','Local Prueba');fixture.componentRef.setInput('productName','Neblinero Mahindra KUV 100 2016–2020');fixture.componentRef.setInput('pilot',true);fixture.detectChanges();
  const anchor=fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
  expect(anchor.target).toBe('_blank');expect(anchor.rel).toContain('noopener');expect(anchor.getAttribute('aria-label')).toContain('contacto de prueba');expect(new URL(anchor.href).searchParams.get('text')).toContain('Neblinero Mahindra');
  let selected=false;fixture.nativeElement.addEventListener('click',()=>selected=true);
  const event=new MouseEvent('click',{bubbles:true,cancelable:true});event.preventDefault();anchor.dispatchEvent(event);expect(selected).toBe(false);
 });
 it('disables contact when the store has no public phone',()=>{
  const fixture=TestBed.createComponent(StoreWhatsappComponent);fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('a')).toBeNull();expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
 });
});
