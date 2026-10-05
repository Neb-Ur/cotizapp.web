import { vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { NgZone } from '@angular/core';
import { getIdToken, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { AuthService } from './auth.service';

vi.mock('firebase/auth', { spy: true });

const currentPassword='Previous!12345';
const newPassword='Changed!12345';
function fixture() {
  vi.spyOn(AuthService.prototype as any,'initializeFirebaseSession').mockResolvedValue(undefined);
  const user={email:'owner@example.test'};
  vi.spyOn(AuthService.prototype as any,'getAuth').mockResolvedValue({currentUser:user});
  const service=new AuthService({} as HttpClient,{run:(work:()=>unknown)=>work(),runOutsideAngular:(work:()=>unknown)=>work()} as NgZone);
  (service as any).currentUserState.set({id:'owner',email:user.email,role:'admin'});
  return {service,user};
}
describe('password changes for signed-in accounts',()=>{
  beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.mocked(getIdToken).mockReset().mockResolvedValue('fresh-token');vi.mocked(reauthenticateWithCredential).mockReset().mockResolvedValue({} as any);vi.mocked(updatePassword).mockReset().mockResolvedValue(undefined);});
  afterEach(()=>vi.restoreAllMocks());
  it('requires current credentials and updates the token without storing passwords',async()=>{
    const {service,user}=fixture();
    expect(await service.changePassword(currentPassword,newPassword)).toBe(true);
    expect(reauthenticateWithCredential).toHaveBeenCalledWith(user,expect.anything());
    expect(updatePassword).toHaveBeenCalledWith(user,newPassword);
    expect(vi.mocked(reauthenticateWithCredential).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(updatePassword).mock.invocationCallOrder[0]);
    expect(service.getToken()).toBe('fresh-token');
    const storage=JSON.stringify({...localStorage,...sessionStorage});
    expect(storage).not.toContain(currentPassword);expect(storage).not.toContain(newPassword);
  });
  it('does not change a password when reauthentication fails',async()=>{
    const {service}=fixture();vi.mocked(reauthenticateWithCredential).mockRejectedValueOnce({code:'auth/wrong-password'});
    await expect(service.changePassword(currentPassword,newPassword)).rejects.toThrow('Correo o contrasena incorrectos');
    expect(updatePassword).not.toHaveBeenCalled();
  });
  it('rejects weak or unchanged passwords before contacting Firebase',async()=>{
    const {service}=fixture();
    await expect(service.changePassword(currentPassword,'123456')).rejects.toThrow('12 y 128');
    await expect(service.changePassword(currentPassword,currentPassword)).rejects.toThrow('diferente');
    expect(reauthenticateWithCredential).not.toHaveBeenCalled();expect(updatePassword).not.toHaveBeenCalled();
  });
  it('reports a successful password change even if the subsequent token refresh fails',async()=>{
    const {service}=fixture();vi.mocked(getIdToken).mockResolvedValueOnce('reauthenticated').mockRejectedValueOnce(new Error('Network down'));
    expect(await service.changePassword(currentPassword,newPassword)).toBe(false);
    expect(updatePassword).toHaveBeenCalledOnce();expect(service.currentUser()).toBeNull();expect(service.getToken()).toBeNull();
  });
});
