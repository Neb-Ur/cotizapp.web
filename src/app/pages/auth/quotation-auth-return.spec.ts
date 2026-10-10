import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
@Component({ standalone: true, template: '<h1>Detalle de cotización pública</h1>' })
class PublicQuotationTestComponent {}
describe('quotation preserved through login and registration', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('preserves the PDF return when switching forms and returns to the public quotation without an authentication loop', async () => {
    await TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'login', component: LoginComponent }, { path: 'registro', component: RegisterComponent },
        { path: 'cotizaciones/local/:projectId', component: PublicQuotationTestComponent }]),
      provideLocationMocks(), { provide: AuthService, useValue: { currentUser: () => null } }
    ] }).compileComponents();
    const harness = await RouterTestingHarness.create();
    const returnUrl = '/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=guest-123&descargar=1';
    await harness.navigateByUrl('/login?' + new URLSearchParams({ returnUrl }), LoginComponent); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Tu cotización está conservada');
    expect(harness.routeNativeElement!.querySelector('.back-link')?.getAttribute('href')).toBe('/cotizaciones/local/guest-123');
    const switchLink = harness.routeNativeElement!.querySelector('.auth-switch a') as HTMLAnchorElement;
    expect(new URL(switchLink.href).searchParams.get('returnUrl')).toBe(returnUrl);
    await harness.navigateByUrl(switchLink.getAttribute('href')!, RegisterComponent); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Volver a la cotización');
    const back = harness.routeNativeElement!.querySelector('.back-link') as HTMLAnchorElement;
    await harness.navigateByUrl(back.getAttribute('href')!, PublicQuotationTestComponent); harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('Detalle de cotización pública');
  });
});
