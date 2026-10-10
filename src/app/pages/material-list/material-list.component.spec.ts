import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { MaterialListService } from '../../core/services/material-list.service';
import { MaterialListComponent } from './material-list.component';
describe('public material list', () => {
  let user: any = null;
  beforeEach(async () => {
    localStorage.clear(); user = null;
    await TestBed.configureTestingModule({ imports: [MaterialListComponent], providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser: () => user } }] }).compileComponents();
  });
  afterEach(() => TestBed.resetTestingModule());
  async function setup() {
    const fixture = TestBed.createComponent(MaterialListComponent); fixture.detectChanges(); await fixture.whenStable();
    const list = TestBed.inject(MaterialListService); list.add({ productName: 'Cemento', quantity: 2, unitPrice: 5000, storeId: 's', storeName: 'Local' }); fixture.detectChanges();
    return { fixture, list, component: fixture.componentInstance as any, router: TestBed.inject(Router) };
  }
  it('allows a guest to review and edit materials and asks for registration only on saving', async () => {
    const { fixture, list, component, router } = await setup(); const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    expect(component.total).toBe(10000); expect(fixture.nativeElement.textContent).toContain('Cemento'); expect(navigate).not.toHaveBeenCalled();
    list.quantity(0, 3); expect(component.total).toBe(15000); component.continue();
    expect(navigate).toHaveBeenCalledWith(['/registro'], { queryParams: { returnUrl: '/dashboard/maestro/cotizaciones/nuevo?usarLista=1' } });
    expect(list.items()[0].quantity).toBe(3); component.continue(true); expect(navigate).toHaveBeenLastCalledWith(['/login'], expect.anything());
  });
  it('continues for maestros and blocks another role from saving', async () => {
    const { component, router, fixture } = await setup(); const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    user = { role: 'ferreteria' }; fixture.detectChanges(); component.continue(); expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.summary .primary').disabled).toBe(true);
    user = { role: 'maestro' }; component.continue(); expect(navigate).toHaveBeenCalledWith('/dashboard/maestro/cotizaciones/nuevo?usarLista=1');
  });
});
