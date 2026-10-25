import {TestBed} from '@angular/core/testing';
import {it,expect,vi} from 'vitest';
import {WorkLedgerComponent} from './work-ledger.component';
import {ApiClientService} from '../../../core/services/api-client.service';
it('retains a rejected payment for correction and commits only after server success',async()=>{
 const api={get:vi.fn().mockResolvedValue({version:1,revision:0,closed:false,entries:[]}),put:vi.fn().mockRejectedValueOnce(new Error('La obra cambió')).mockImplementationOnce(async(_p,v)=>({...v,revision:1}))};
 TestBed.configureTestingModule({imports:[WorkLedgerComponent],providers:[{provide:ApiClientService,useValue:api}]});const f=TestBed.createComponent(WorkLedgerComponent),c:any=f.componentInstance;
 f.componentRef.setInput('ownerId','m');f.componentRef.setInput('projectId','q');f.componentRef.setInput('total',100000);f.componentRef.setInput('budgetedCost',60000);f.detectChanges();await f.whenStable();
 c.add();Object.assign(c.ledger.entries[0],{description:'Anticipo',kind:'payment',unitPrice:40000});await c.save();expect(c.ledger.revision).toBe(0);expect(c.ledger.entries).toHaveLength(1);expect(c.error).toContain('cambió');expect(c.notice).toBe('');
 await c.save();expect(c.ledger.revision).toBe(1);expect(c.totals.balance).toBe(60000);expect(c.totals.cost).toBe(0);
 c.budgetDirty=true;await c.save();expect(api.put).toHaveBeenCalledTimes(2);f.destroy();
});
