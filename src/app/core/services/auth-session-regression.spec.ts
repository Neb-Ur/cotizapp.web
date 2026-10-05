import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { AuthService } from './auth.service';

describe('quotation draft privacy when the authentication service is unavailable', () => {
 beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  // Stub the Firebase boundary; the session and storage cleanup run unchanged.
  vi.spyOn(AuthService.prototype as any, 'initializeFirebaseSession').mockResolvedValue(undefined);
  vi.spyOn(AuthService.prototype as any, 'getAuth').mockRejectedValue(new Error('Firebase unavailable'));
 });
 afterEach(() => vi.restoreAllMocks());
 for (const action of ['logout', 'clearAfterAccountDeletion'] as const) {
  it(`clears current and legacy drafts during ${action}, even when Firebase fails`, async () => {
   const auth = new AuthService({} as HttpClient, {run:(work:()=>unknown)=>work(),runOutsideAngular:(work:()=>unknown)=>work()} as NgZone);
   localStorage.setItem('cotizapp-project-draft:user', 'private-address');
   localStorage.setItem('cotizapp-project-draft:real:first', 'real-private-address');
   localStorage.setItem('cotizapp-project-draft:retired:second', 'retired-private-address');
   localStorage.setItem('construcomparador-project-draft', 'legacy-address');
   localStorage.setItem('unrelated-setting', 'keep');
   await auth[action]();
   expect(localStorage.getItem('cotizapp-project-draft:user')).toBeNull();
   expect(localStorage.getItem('cotizapp-project-draft:real:first')).toBeNull();
   expect(localStorage.getItem('cotizapp-project-draft:retired:second')).toBeNull();
   expect(localStorage.getItem('construcomparador-project-draft')).toBeNull();
   expect(localStorage.getItem('unrelated-setting')).toBe('keep');
   expect(auth.currentUser()).toBeNull();
   expect(auth.getToken()).toBeNull();
  });
 }
});
