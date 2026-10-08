import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { vi } from 'vitest';
import { CookieConsentComponent } from './cookie-consent.component';
import { COOKIE_CONSENT_STORAGE_KEY, CookieConsentService } from '../../../core/services/cookie-consent.service';

describe('cookie consent buttons', () => {
  beforeEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    localStorage.removeItem('cotizapp-cookie-consent-v1');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    document.body.classList.remove('cookie-banner-open', 'modal-open');
  });

  async function setup(platform = 'browser') {
    await TestBed.configureTestingModule({
      imports: [CookieConsentComponent], providers: [{ provide: PLATFORM_ID, useValue: platform }]
    }).compileComponents();
    const fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, service: TestBed.inject(CookieConsentService) };
  }

  it('does not render inactive privacy buttons on the server', async () => {
    const { fixture, service } = await setup('server');
    expect(service.ready()).toBe(false);
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
  });

  it.each([1, 2])('closes the banner immediately for choice %s when saving fails', async choice => {
    const { fixture, service } = await setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const buttons = fixture.nativeElement.querySelectorAll('.cookie-banner__actions button');
    buttons[choice].click();
    fixture.detectChanges();
    expect(service.hasDecision()).toBe(true);
    expect(service.preferencesAllowed()).toBe(choice === 2);
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
  });

  it('opens configuration and releases the modal lock after saving with blocked storage', async () => {
    const { fixture, service } = await setup();
    fixture.nativeElement.querySelector('.cookie-banner__actions button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    fixture.nativeElement.querySelector('.cookie-settings__actions .btn-primary').click();
    fixture.detectChanges();
    expect(service.hasDecision()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.cookie-banner')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
  });
});
