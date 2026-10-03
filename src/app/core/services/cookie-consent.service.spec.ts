import { COOKIE_CONSENT_STORAGE_KEY, CookieConsentService } from './cookie-consent.service';

describe('CookieConsentService', () => {
  const legacyKey = 'cotizapp-cookie-consent-v1';

  beforeEach(() => {
    window.localStorage.removeItem(legacyKey);
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  });

  afterEach(() => {
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
    const consent = service.consent();

    expect(consent?.preferences).toBeTrue();
    expect((consent as unknown as Record<string, unknown>)['analytics']).toBeUndefined();
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
  });

  it('stores a preference decision without an analytics authorization', () => {
    const service = new CookieConsentService('browser' as unknown as object, document);
    service.acceptPreferences();

    const stored = JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) || '{}') as Record<string, unknown>;
    expect(stored['preferences']).toBeTrue();
    expect(stored['analytics']).toBeUndefined();
  });
});
