import {TestBed} from '@angular/core/testing';
import {it,expect,vi} from 'vitest';
import {ProfessionalToolsComponent} from './professional-tools.component';
import {ApiClientService} from '../../../core/services/api-client.service';
import {emptyWorkBudget} from '../../../core/utils/work-budget.util';
it('applies independent client and professional snapshots without changing existing terms',async()=>{
 const contact={id:'c',name:'Ana',phone:'123',email:'ana@example.com',address:'Dirección cliente'};
 const tools={version:1,revision:0,clients:[contact],profile:{businessName:'Empresa',phone:'321',email:'',address:'',defaultTerms:'Anticipo 30%'}};
 const api={get:vi.fn().mockResolvedValue(tools),put:vi.fn().mockRejectedValue(new Error('Sin conexión'))};
 TestBed.configureTestingModule({imports:[ProfessionalToolsComponent],providers:[{provide:ApiClientService,useValue:api}]});const f=TestBed.createComponent(ProfessionalToolsComponent),c:any=f.componentInstance;c.budget=emptyWorkBudget();c.budget.terms='Condiciones acordadas';f.componentRef.setInput('ownerId','m');f.detectChanges();await f.whenStable();
 c.applyClient(contact);c.applyProfile();contact.phone='999';tools.profile.businessName='Otra empresa';expect(c.budget.client.phone).toBe('123');expect(c.budget.professional.businessName).toBe('Empresa');expect(c.budget.terms).toBe('Condiciones acordadas');expect(api.put).not.toHaveBeenCalled();
 c.edit({...contact,name:'Editado'});await c.saveContact();expect(c.error).toContain('Sin conexión');expect(c.tools.clients[0].name).toBe('Ana');f.destroy();
});
