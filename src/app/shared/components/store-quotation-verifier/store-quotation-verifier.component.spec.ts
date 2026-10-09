import {describe,it,expect,vi} from 'vitest';
import {StoreQuotationVerifierComponent} from './store-quotation-verifier.component';
import {FirebaseDataService} from '../../../core/services/firebase-data.service';
import {ChangeDetectorRef} from '@angular/core';
describe('store quotation verification',()=>{
 it('shows loading immediately and clears the previous result when lookup fails',async()=>{
  let reject!:(error:Error)=>void;
  const api={getStoreQuotation:vi.fn(()=>new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;}))};
  const component=new StoreQuotationVerifierComponent(api as unknown as FirebaseDataService,{markForCheck:vi.fn()} as unknown as ChangeDetectorRef) as any;
  component.storeId='store';component.quotationCode='FND-AAAA-BBBB-CCCC-DDDD';component.quotationResult={code:'old'};
  const pending=component.lookupQuotation();expect(component.isLookingUpQuotation).toBe(true);expect(component.quotationResult).toBeNull();
  reject(new Error('No encontramos una cotización'));await pending;
  expect(component.isLookingUpQuotation).toBe(false);expect(component.quotationLookupError).toContain('No encontramos');expect(component.quotationResult).toBeNull();
 });
});
