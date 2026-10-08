import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, computed, signal } from '@angular/core';

export const COOKIE_CONSENT_STORAGE_KEY = 'cotizapp-cookie-consent-v2';
const LEGACY_COOKIE_CONSENT_STORAGE_KEY = 'cotizapp-cookie-consent-v1';
const COOKIE_CONSENT_VERSION = 2;
const COOKIE_CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface CookieConsentPreferences {
  version: number;
  necessary: true;
  preferences: boolean;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  private readonly browser: boolean;
  private initialized = false;
  private readonly readyState = signal(false);
  readonly ready = this.readyState.asReadonly();
  private readonly consentState = signal<CookieConsentPreferences | null>(null);

  readonly consent = computed(() => this.consentState());
  readonly hasDecision = computed(() => this.consentState() !== null);
  readonly preferencesAllowed = computed(() => this.consentState()?.preferences === true);
  readonly settingsOpen = signal(false);

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    this.browser = isPlatformBrowser(platformId);
  }

  // Restore browser-only state after the initial render, keeping SSR and the
  // first client render identical. A click made first must win over old storage.
  initializeBrowserState(): void {
    if (!this.browser || this.initialized) return;
    this.initialized = true;
    if (!this.hasDecision()) this.consentState.set(this.readStoredConsent());
    this.readyState.set(true);
    this.syncBannerClass();
  }

  acceptPreferences(): void {
    this.save({ preferences: true });
  }

  rejectOptional(): void {
    this.save({ preferences: false });
  }

  saveSelection(selection: Pick<CookieConsentPreferences, 'preferences'>): void {
    this.save(selection);
  }

  openSettings(): void {
    this.settingsOpen.set(true);
  }

  closeSettings(): void {
    this.settingsOpen.set(false);
  }

  private save(selection: Pick<CookieConsentPreferences, 'preferences'>): void {
    const consent: CookieConsentPreferences = {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      preferences: selection.preferences,
      updatedAt: new Date().toISOString()
    };

    // Respond immediately; unavailable or full storage must never trap the UI.
    this.consentState.set(consent);
    this.settingsOpen.set(false);
    this.syncBannerClass();

    if (this.browser) {
      try { window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(consent)); }
      catch { /* Keep the decision for this page when persistence is unavailable. */ }
      if (!consent.preferences) {
        try { window.sessionStorage.removeItem('cotizapp-nearby-search'); }
        catch { /* Optional storage may be blocked independently. */ }
      }
    }
  }

  private readStoredConsent(): CookieConsentPreferences | null {
    if (!this.browser) return null;

    try {
      const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) return this.migrateLegacyConsent();
      const value = JSON.parse(raw) as Partial<CookieConsentPreferences>;
      if (
        value.version !== COOKIE_CONSENT_VERSION
        || value.necessary !== true
        || typeof value.preferences !== 'boolean'
        || typeof value.updatedAt !== 'string'
        || !Number.isFinite(Date.parse(value.updatedAt))
        || Date.now() - Date.parse(value.updatedAt) > COOKIE_CONSENT_MAX_AGE_MS
      ) {
        window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
        return null;
      }
      return value as CookieConsentPreferences;
    } catch {
      this.removeStoredItem(COOKIE_CONSENT_STORAGE_KEY);
      return null;
    }
  }

  private migrateLegacyConsent(): CookieConsentPreferences | null {
    try {
      const raw = window.localStorage.getItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
      if (!raw) return null;
      const legacy = JSON.parse(raw) as { preferences?: unknown; updatedAt?: unknown };
      if (typeof legacy.preferences !== 'boolean') return null;
      const updatedAt = typeof legacy.updatedAt === 'string' && Number.isFinite(Date.parse(legacy.updatedAt))
        ? legacy.updatedAt
        : new Date().toISOString();
      if (Date.now() - Date.parse(updatedAt) > COOKIE_CONSENT_MAX_AGE_MS) return null;

      // Solo se migra la elección específica de preferencias. Cualquier valor
      // histórico de "analytics" se descarta y nunca puede activar medición.
      const migrated: CookieConsentPreferences = {
        version: COOKIE_CONSENT_VERSION,
        necessary: true,
        preferences: legacy.preferences,
        updatedAt
      };
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    } catch {
      this.removeStoredItem(LEGACY_COOKIE_CONSENT_STORAGE_KEY);
      return null;
    }
  }

  private removeStoredItem(key: string): void {
    try { window.localStorage.removeItem(key); }
    catch { /* Storage access itself can throw a SecurityError. */ }
  }

  private syncBannerClass(): void {
    if (!this.browser) return;
    this.document.body.classList.toggle('cookie-banner-open', this.ready() && !this.hasDecision());
  }
}

export function hasPreferenceStorageConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    return value.version === COOKIE_CONSENT_VERSION
      && value.preferences === true
      && typeof value.updatedAt === 'string'
      && Number.isFinite(Date.parse(value.updatedAt))
      && Date.now() - Date.parse(value.updatedAt) <= COOKIE_CONSENT_MAX_AGE_MS;
  } catch {
    return false;
  }
}
