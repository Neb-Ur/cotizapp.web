import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { ApiClientService } from '../../../core/services/api-client.service';
import { StoreOnboardingComponent } from './store-onboarding.component';

const overview = { termsVersion: '1.0', privacyVersion: '1.1', agreementVersion: '1.0', acceptanceRequired: true, canAccept: true, storeName: 'Mi ferretería' };
describe('first store login', () => {
  let fixture: ComponentFixture<StoreOnboardingComponent>;
  let component: any;
  let auth: any;
  let api: any;
  let router: any;
  beforeEach(async () => {
    auth = { currentUser: vi.fn().mockReturnValue({ id: 'store-user', email: 'store@example.test' }), emailVerified: signal(false), logout: vi.fn().mockImplementation(async () => { auth.currentUser.mockReturnValue(null); }), refreshCurrentUser: vi.fn().mockResolvedValue({id:'store-user'}), refreshEmailVerification: vi.fn().mockResolvedValue(false), sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
    api = { get: vi.fn().mockResolvedValue(overview), post: vi.fn().mockResolvedValue({ accepted: true }) };
    router = { navigate: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({ imports: [StoreOnboardingComponent], providers: [{ provide: AuthService, useValue: auth }, { provide: ApiClientService, useValue: api }, { provide: Router, useValue: router }] }).compileComponents();
  });
  afterEach(() => { fixture?.destroy(); });
  async function render() {
    fixture = TestBed.createComponent(StoreOnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function checkAll() { Object.keys(component.checks).forEach(key => component.checks[key] = true); }

  it('shows only unchecked declarations and blocks confirmation until every box is checked', async () => {
    await render();
    const boxes = fixture.nativeElement.querySelectorAll('input');
    expect(boxes.length).toBe(6);
    expect([...boxes].every((box: any) => box.type === 'checkbox' && !box.checked)).toBe(true);
    await component.accept();
    expect(api.post).not.toHaveBeenCalled();
    checkAll(); component.checks.authorityConfirmed = false;
    await component.accept(); expect(api.post).not.toHaveBeenCalled();
  });
  it('saves the declarations and versions before enabling the dashboard and showing the red verification modal', async () => {
    await render(); checkAll();
    const ready = vi.spyOn(component.ready, 'emit');
    await component.accept(); fixture.detectChanges();
    expect(api.post).toHaveBeenCalledWith('/store-onboarding/accept', { ...component.checks, termsVersion: '1.0', privacyVersion: '1.1', agreementVersion: '1.0' }, true);
    expect(auth.refreshCurrentUser).toHaveBeenCalled();
    expect(ready).toHaveBeenCalledOnce();
    expect(component.acceptanceOpen).toBe(false);
    expect(fixture.nativeElement.querySelector('.dialog--danger')).not.toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(true);
    expect(auth.sendVerificationEmail).not.toHaveBeenCalled();
  });
  it('logs out when the mandatory modal is closed instead of letting the user skip it', async () => {
    await render();
    fixture.nativeElement.querySelector('.close-button').click();
    await fixture.whenStable();
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(api.post).not.toHaveBeenCalled();
  });
  it('keeps the acceptance modal blocking the dashboard after a failed save', async () => {
    await render(); checkAll();
    api.post.mockRejectedValueOnce(new Error('offline'));
    const ready = vi.spyOn(component.ready, 'emit');
    await component.accept();
    expect(ready).not.toHaveBeenCalled();
    expect(component.acceptanceOpen).toBe(true);
    expect(component.verificationOpen).toBe(false);
  });
  it('shows the sent-link information only after a successful send and removes reminders after verification', async () => {
    api.get.mockResolvedValue({ ...overview, acceptanceRequired: false });
    await render();
    await component.sendVerification(); fixture.detectChanges();
    expect(component.sentOpen).toBe(true);
    expect(component.verificationOpen).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Enlace enviado');
    expect(fixture.nativeElement.querySelector('.verification-banner')).not.toBeNull();
    auth.refreshEmailVerification.mockImplementation(async () => { auth.emailVerified.set(true); return true; });
    await component.checkVerification(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.verification-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('.dialog')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
  it('does not claim an email was sent when Firebase fails', async () => {
    api.get.mockResolvedValue({ ...overview, acceptanceRequired: false });
    await render(); auth.sendVerificationEmail.mockRejectedValue(new Error('rate limit'));
    await component.sendVerification();
    expect(component.sentOpen).toBe(false);
    expect(component.verificationOpen).toBe(true);
    expect(component.verificationError).toBeTruthy();
  });
  it('does not show either modal again for an accepted and email-verified account', async () => {
    api.get.mockResolvedValue({ ...overview, acceptanceRequired: false }); auth.emailVerified.set(true);
    await render();
    expect(fixture.nativeElement.querySelector('.dialog')).toBeNull();
    expect(fixture.nativeElement.querySelector('.verification-banner')).toBeNull();
    expect(auth.refreshEmailVerification).not.toHaveBeenCalled();
  });
  it('preserves the session when the view is destroyed without an explicit rejection', async () => {
    await render(); fixture.destroy();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('retries only session refresh when acceptance saved but the refresh failed', async () => {
    await render(); checkAll(); auth.refreshCurrentUser.mockRejectedValueOnce(new Error('offline'));
    const ready = vi.spyOn(component.ready, 'emit');
    await component.accept(); fixture.detectChanges();
    expect(component.acceptanceSaved).toBe(true);expect(component.error).toContain('están guardadas');
    expect(ready).not.toHaveBeenCalled();expect([...fixture.nativeElement.querySelectorAll('input')].every((box:any)=>box.matches(':disabled'))).toBe(true);
    await component.accept();
    expect(api.post).toHaveBeenCalledOnce();expect(auth.refreshCurrentUser).toHaveBeenCalledTimes(2);expect(ready).toHaveBeenCalledOnce();
  });
  it('reconciles a lost save response with the server instead of reporting a false failure', async () => {
    await render(); checkAll();api.post.mockRejectedValueOnce(new HttpErrorResponse({status:0}));
    api.get.mockResolvedValueOnce({...overview,acceptanceRequired:false});
    await component.accept();
    expect(component.acceptanceOpen).toBe(false);expect(api.post).toHaveBeenCalledOnce();expect(auth.refreshCurrentUser).toHaveBeenCalledOnce();
  });
  it('preserves all choices when returning from a document and a save cannot be confirmed', async () => {
    await render();checkAll();window.dispatchEvent(new Event('focus'));
    api.post.mockRejectedValueOnce(new HttpErrorResponse({status:0}));api.get.mockRejectedValueOnce(new Error('offline'));
    await component.accept();
    expect(component.acceptanceSaved).toBe(false);expect(component.acceptanceReady).toBe(true);expect(component.error).toContain('casillas se conservaron');
    expect(auth.logout).not.toHaveBeenCalled();expect(component.acceptanceOpen).toBe(true);
    await component.accept();expect(component.acceptanceOpen).toBe(false);
  });
  it('reloads updated documents and requires fresh choices after a version conflict', async () => {
    await render();checkAll();api.post.mockRejectedValueOnce(new HttpErrorResponse({status:409}));
    api.get.mockResolvedValueOnce({...overview,termsVersion:'2.0'});
    await component.accept();expect(component.overview.termsVersion).toBe('2.0');expect(Object.values(component.checks).every(value=>value===false)).toBe(true);
    expect(component.error).toContain('documentos cambiaron');expect(auth.refreshCurrentUser).not.toHaveBeenCalled();
  });
  it('does not enable the dashboard if the session ended after the save', async () => {
    await render();checkAll();auth.refreshCurrentUser.mockResolvedValueOnce(null);const ready=vi.spyOn(component.ready,'emit');
    await component.accept();expect(component.acceptanceSaved).toBe(true);expect(component.error).toContain('La sesión terminó');expect(ready).not.toHaveBeenCalled();
  });

  it('does not reuse another account declarations after a session changes in another tab', async () => {
    await render();checkAll();auth.refreshCurrentUser.mockRejectedValueOnce(new Error('offline'));
    await component.accept();auth.currentUser.mockReturnValue({id:'other-user'});
    await component.accept();expect(api.post).toHaveBeenCalledOnce();expect(component.error).toContain('cuenta de la sesión cambió');expect(component.acceptanceOpen).toBe(true);
  });

});
