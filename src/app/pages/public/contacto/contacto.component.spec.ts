import { vi } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ContactoComponent } from './contacto.component';

const required = ['termsAccepted', 'privacyAcknowledged', 'ageConfirmed', 'authorityConfirmed', 'accuracyConfirmed'];
function fixture(type = 'Ferreteria') {
  const component = new ContactoComponent(new FormBuilder(), {snapshot:{queryParamMap:{get:()=>type}}} as unknown as ActivatedRoute) as any;
  component.ngOnInit();
  component.form.patchValue({name:'Persona encargada',email:'store@example.test',businessName:'Ferretería local',message:'Solicito acceso para mi ferretería.'});
  return component;
}

describe('store contact request acceptance', () => {
  afterEach(() => vi.restoreAllMocks());
  it('requires all five unchecked declarations before contacting the API', async () => {
    const fetch = vi.spyOn(globalThis,'fetch');
    const component=fixture();
    for(const field of required)expect(component.form.controls[field].value).toBe(false);
    for(const missing of required) {
      component.form.patchValue(Object.fromEntries(required.map(field=>[field,field!==missing])));
      await component.submit();
      expect(fetch).not.toHaveBeenCalled();expect(component.hasAcceptanceError).toBe(true);
    }
  });
  it('sends the versions shown to the requester and resets the declarations after successful submission', async () => {
    const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({ok:true})} as Response);
    const component=fixture();
    component.form.patchValue(Object.fromEntries(required.map(field=>[field,true])));
    await component.submit();
    expect(fetch).toHaveBeenCalledTimes(1);
    const payload=JSON.parse(fetch.mock.calls[0][1]!.body as string);
    for(const field of required)expect(payload[field]).toBe(true);
    expect(payload.termsVersion).toBe(component.legalIdentity.termsVersion);
    expect(payload.privacyVersion).toBe(component.legalIdentity.privacyPolicyVersion);
    expect(component.sent).toBe(true);
    for(const field of required)expect(component.form.controls[field].value).toBe(false);
    expect(component.form.invalid).toBe(true);
  });
  it('does not carry checked declarations between contact types or require them for an ordinary inquiry', async () => {
    const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue({ok:true,json:async()=>({ok:true})} as Response);
    const component=fixture();
    component.form.patchValue(Object.fromEntries(required.map(field=>[field,true])));
    component.form.controls.type.setValue('Maestro');
    for(const field of required)expect(component.form.controls[field].value).toBe(false);
    expect(component.form.valid).toBe(true);
    await component.submit();expect(fetch).toHaveBeenCalledTimes(1);
    const payload=JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(payload.termsVersion).toBeUndefined();
    component.form.controls.type.setValue('Ferreteria');
    expect(component.form.controls.termsAccepted.invalid).toBe(true);
  });
});
