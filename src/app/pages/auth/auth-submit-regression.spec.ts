import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';

for (const reset of [false, true]) {
 it(`submits ${reset ? 'password recovery' : 'login'} once while the first request is pending`, async () => {
  let finish!:(value:any)=>void;
  const pending=new Promise(resolve=>{finish=resolve;});
  const request=vi.fn(()=>pending);
  const auth={login:request,sendPasswordReset:request,dashboardRouteForUser:()=>'/dashboard/maestro'};
  const component:any=reset
   ? new ForgotPasswordComponent(new FormBuilder(),auth as unknown as AuthService)
   : new LoginComponent(new FormBuilder(),auth as unknown as AuthService,{snapshot:{queryParamMap:convertToParamMap({})}} as ActivatedRoute,{navigateByUrl:vi.fn(async()=>true)} as unknown as Router);
  component.form.patchValue({email:'maestro@example.test',password:'password'});
  const first=component.submit();
  const second=component.submit();
  const calls=request.mock.calls.length;
  finish({id:'maestro',role:'maestro'});
  // Both calls share a promise to avoid leaving a request unresolved on failure.
  await second;
  expect(calls).toBe(1);
  await first;
  expect(component.isSubmitting).toBe(false);
 });
}

it('clears the old recovery success message when a later resend fails', async () => {
 const sendPasswordReset=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Sin conexión'));
 const component=new ForgotPasswordComponent(new FormBuilder(),{sendPasswordReset} as unknown as AuthService) as any;
 component.form.patchValue({email:'maestro@example.test'});
 await component.submit();expect(component.sent).toBe(true);
 await component.submit();
 expect(component.sent).toBe(false);
 expect(component.errorMessage).toContain('Sin conexión');
});
