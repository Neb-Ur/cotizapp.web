import { vi } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ChangePasswordComponent } from './change-password.component';
function fixture(){
  const auth={changePassword:vi.fn(async()=>true)};
  return {auth,component:new ChangePasswordComponent(new FormBuilder(),auth as unknown as AuthService) as any};
}
describe('change password form',()=>{
  it('rejects mismatched confirmation without changing credentials',async()=>{
    const {component,auth}=fixture();component.form.setValue({currentPassword:'Old!12345678',newPassword:'New!12345678',confirmPassword:'Other!12345678'});
    await component.submit();expect(component.errorMessage).toContain('no coincide');expect(auth.changePassword).not.toHaveBeenCalled();
  });
  it('clears all credential fields after success',async()=>{
    const {component,auth}=fixture();component.form.setValue({currentPassword:'Old!12345678',newPassword:'New!12345678',confirmPassword:'New!12345678'});
    await component.submit();expect(auth.changePassword).toHaveBeenCalledWith('Old!12345678','New!12345678');
    expect(component.form.getRawValue()).toEqual({currentPassword:'',newPassword:'',confirmPassword:''});expect(component.successMessage).toContain('actualizada');
  });
  it('directs the user to sign in again after a completed change with an expired session',async()=>{
    const {component,auth}=fixture();auth.changePassword.mockResolvedValueOnce(false);
    component.form.setValue({currentPassword:'Old!12345678',newPassword:'New!12345678',confirmPassword:'New!12345678'});
    await component.submit();expect(component.sessionRetained).toBe(false);expect(component.successMessage).toContain('Inicia sesión de nuevo');expect(component.errorMessage).toBe('');
  });
});
