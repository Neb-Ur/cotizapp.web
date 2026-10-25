import {TestBed} from '@angular/core/testing';
import {QuotationStatusComponent} from './quotation-status.component';
it('requires an explicit update and keeps the saved status visible while a new selection is pending',async()=>{
 const fixture=TestBed.createComponent(QuotationStatusComponent);fixture.componentRef.setInput('value','draft');fixture.componentRef.setInput('name','Pintura cocina');fixture.detectChanges();await fixture.whenStable();
 const emit=vi.spyOn(fixture.componentInstance.statusChange,'emit');const select=fixture.nativeElement.querySelector('select');const button=fixture.nativeElement.querySelector('button');expect(button.disabled).toBe(true);
 select.value='sent';select.dispatchEvent(new Event('change'));fixture.detectChanges();await fixture.whenStable();
 expect(emit).not.toHaveBeenCalled();expect(fixture.nativeElement.querySelector('.status').textContent.trim()).toBe('Borrador');expect(button.disabled).toBe(false);
 button.click();expect(emit).toHaveBeenCalledWith('sent');fixture.componentRef.setInput('busy',true);fixture.detectChanges();await fixture.whenStable();expect(button.disabled).toBe(true);expect(select.disabled).toBe(true);
 fixture.componentRef.setInput('value','sent');fixture.componentRef.setInput('busy',false);fixture.detectChanges();await fixture.whenStable();expect(fixture.nativeElement.querySelector('.status').textContent.trim()).toBe('Enviado');expect(button.disabled).toBe(true);fixture.destroy();
});
