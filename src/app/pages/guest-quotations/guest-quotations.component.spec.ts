import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { GuestQuotationsComponent } from './guest-quotations.component';

describe('guest quotation deletion', () => {
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

  it('preserves the saved quotation on cancel and removes only after confirmation', async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({imports:[GuestQuotationsComponent], providers:[provideRouter([])]}).compileComponents();
    const guest = TestBed.inject(GuestQuotationService);
    const quote = guest.create('Cocina');
    const fixture = TestBed.createComponent(GuestQuotationsComponent);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const remove = fixture.nativeElement.querySelector('article button') as HTMLButtonElement;
    remove.click(); fixture.detectChanges();
    expect(guest.get(quote.id)?.name).toBe('Cocina');
    expect(fixture.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Cocina');
    fixture.nativeElement.querySelector('.dialog-actions .btn-outline').click(); fixture.detectChanges();
    expect(guest.get(quote.id)?.name).toBe('Cocina');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    remove.click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.dialog-actions .btn-danger').click(); fixture.detectChanges();
    expect(guest.get(quote.id)).toBeNull();
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Crea tu primera cotización');
    await fixture.whenStable();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('h1'));
    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
