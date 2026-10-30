import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { AuthService } from './auth.service';
import { Subject } from 'rxjs';

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


describe('profile updates across session changes', () => {
 const services:AuthService[]=[];
 beforeEach(() => {
  localStorage.clear();sessionStorage.clear();
  vi.spyOn(AuthService.prototype as any,'initializeFirebaseSession').mockResolvedValue(undefined);
  vi.spyOn(AuthService.prototype as any,'getAuth').mockRejectedValue(new Error('Firebase unavailable'));
 });
 afterEach(() => {
  services.splice(0).forEach(service=>service.ngOnDestroy());
  vi.restoreAllMocks();
 });
 for (const switchAccount of [false,true]) {
  it(`ignores a late profile response after ${switchAccount ? 'switching accounts' : 'logout'}`, async () => {
   const response=new Subject<any>();
   const patch=vi.fn(()=>response);
   const auth=new AuthService({patch} as unknown as HttpClient,{run:(work:()=>unknown)=>work(),runOutsideAngular:(work:()=>unknown)=>work()} as NgZone);
   services.push(auth);
   (auth as any).setSession({id:'first',email:'first@example.test',displayName:'Primero',role:'maestro'},'first-token','local');
   const updating=auth.updateProfile({displayName:'Nombre editado'});
   const rejected=expect(updating).rejects.toThrow('sesión');
   if (switchAccount) {
    (auth as any).setSession({id:'second',email:'second@example.test',displayName:'Segundo',role:'ferreteria'},'second-token','local');
   } else { await auth.logout(); }
   response.next({ok:true,data:{id:'first',correo:'first@example.test',nombre:'Nombre editado',rol:'maestro'}});
   response.complete();
   await rejected;
   expect(patch).toHaveBeenCalledOnce();
   expect(auth.currentUser()?.id || null).toBe(switchAccount ? 'second' : null);
   expect(auth.getToken()).toBe(switchAccount ? 'second-token' : null);
   const cached=JSON.parse(localStorage.getItem('cotizapp-session') || 'null');
   expect(cached?.user.id || null).toBe(switchAccount ? 'second' : null);
  });
 }
});
