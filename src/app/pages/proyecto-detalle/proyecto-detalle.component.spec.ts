import { ProyectoDetalleComponent } from './proyecto-detalle.component';
import { DataModeService } from '../../core/services/data-mode.service';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { ActivatedRoute, Router } from '@angular/router';

describe('quotation drafts isolated by account and environment',()=>{
  beforeEach(()=>localStorage.clear());
  it('never restores another account or environment and discards the legacy shared draft',()=>{
    let uid='first';let mode='real';
    const component=new ProyectoDetalleComponent({mode:()=>mode} as unknown as DataModeService,{} as ActivatedRoute,{} as Router,{currentUser:()=>({id:uid,role:'maestro'})} as unknown as AuthService,{buildProjectQuotation:()=>({})} as unknown as FirebaseDataService) as any;
    component.projectName='Private work';component.projectAddress='Private address';component.projectItems=[{productName:'Cemento',quantity:2}];
    component.persistDraftIfNeeded();
    expect(component.readDraft()?.address).toBe('Private address');
    localStorage.setItem('construcomparador-project-draft',JSON.stringify({address:'Legacy private address'}));
    uid='second';expect(component.readDraft()).toBeNull();expect(localStorage.getItem('construcomparador-project-draft')).toBeNull();
    uid='first';mode='retired';expect(component.readDraft()).toBeNull();
    mode='real';expect(component.readDraft()?.items).toEqual([{productName:'Cemento',quantity:2}]);
  });
});
