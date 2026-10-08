import { vi, type Mock, type Mocked } from 'vitest';
import { COOKIE_CONSENT_STORAGE_KEY, CookieConsentService } from './cookie-consent.service';

describe('CookieConsentService', () => {
  const legacyKey = 'cotizapp-cookie-consent-v1';

  beforeEach(() => {
    window.localStorage.removeItem(legacyKey);
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.classList.remove('cookie-banner-open');
    window.localStorage.removeItem(legacyKey);
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  });

  it('migrates only preferences and discards a legacy analytics choice', () => {
    window.localStorage.setItem(legacyKey, JSON.stringify({
      version: 1,
      necessary: true,
      preferences: true,
      analytics: true,
      updatedAt: new Date().toISOString()
    }));

    const service = new CookieConsentService('browser' as unknown as object, document);
    service.initializeBrowserState();
    const consent = service.consent();

    expect(consent?.preferences).toBe(true);
    expect((consent as unknown as Record<string, unknown>)['analytics']).toBeUndefined();
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('stores a preference decision without an analytics authorization', () => {
    const service = new CookieConsentService('browser' as unknown as object, document);
    service.initializeBrowserState();
    service.acceptPreferences();

    const stored = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || '{}') as Record<string, unknown>;
    expect(stored['preferences']).toBe(true);
    expect(stored['analytics']).toBeUndefined();
  });
  it('keeps the initial client view equal to SSR before restoring a saved decision', () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({version:2,necessary:true,preferences:true,updatedAt:new Date().toISOString()}));
    const service = new CookieConsentService('browser' as unknown as object, document);
    expect(service.hasDecision()).toBe(false);
    service.initializeBrowserState();
    expect(service.hasDecision()).toBe(true);
    expect(service.preferencesAllowed()).toBe(true);
  });

  it.each([true, false])('closes settings and the banner when storage is blocked (preferences=%s)', preferences => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    const service = new CookieConsentService('browser' as unknown as object, document);
    expect(() => service.initializeBrowserState()).not.toThrow();
    service.openSettings();
    expect(() => service.saveSelection({ preferences })).not.toThrow();
    expect(service.hasDecision()).toBe(true);
    expect(service.preferencesAllowed()).toBe(preferences);
    expect(service.settingsOpen()).toBe(false);
    expect(document.body.classList.contains('cookie-banner-open')).toBe(false);
  });

  it('does not replace an early click with a previous stored decision', () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({version:2,necessary:true,preferences:true,updatedAt:new Date().toISOString()}));
    const service = new CookieConsentService('browser' as unknown as object, document);
    service.rejectOptional();
    service.initializeBrowserState();
    expect(service.preferencesAllowed()).toBe(false);
  });

});
