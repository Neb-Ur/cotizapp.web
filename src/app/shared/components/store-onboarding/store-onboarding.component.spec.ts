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
    auth = { currentUser: vi.fn().mockReturnValue({ id: 'store-user', email: 'store@example.test' }), emailVerified: signal(false), logout: vi.fn().mockImplementation(async () => { auth.currentUser.mockReturnValue(null); }), refreshCurrentUser: vi.fn().mockResolvedValue({}), refreshEmailVerification: vi.fn().mockResolvedValue(false), sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
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
  it('logs out if the user leaves the dashboard before accepting', async () => {
    await render(); fixture.destroy();
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
