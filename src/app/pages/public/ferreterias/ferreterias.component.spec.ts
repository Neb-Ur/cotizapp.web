import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { FerreteriasComponent } from './ferreterias.component';
import { StoreDirectoryService } from '../../../core/services/store-directory.service';
import { AuthService } from '../../../core/services/auth.service';
const store={id:'s',name:'Ferretería Norte',region:'Metropolitana',commune:'Maipú',address:'Av. Norte 12',rating:null,reviewCount:0};
const page={items:[store],total:13,page:1,size:12,totalPages:2,regions:['Metropolitana'],communes:['Maipú'],storeOptions:[{id:'s',name:store.name}]};
async function setup(role:string|null=null) {
 const api={list:vi.fn(async()=>page),detail:vi.fn(async()=>({store,reviews:[],total:0,page:1,totalPages:1})),myReview:vi.fn(async()=>null),
  saveReview:vi.fn(async()=>({id:'r',rating:4,comment:'Buena atención'})),deleteReview:vi.fn(async()=>({deleted:true}))};
 await TestBed.configureTestingModule({providers:[provideRouter([{path:'ferreterias',component:FerreteriasComponent},{path:'ferreterias/:storeId',component:FerreteriasComponent}]),
  {provide:StoreDirectoryService,useValue:api},{provide:AuthService,useValue:{currentUser:()=>role?{id:'u',role}:null}}
 ]}).compileComponents();
 return {api,harness:await RouterTestingHarness.create()};
}
describe('store directory',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('paginates on the server and resets the page when location changes',async()=>{
  const {api,harness}=await setup();
  const component=await harness.navigateByUrl('/ferreterias',FerreteriasComponent) as any;
  await harness.fixture.whenStable();harness.detectChanges();
  expect(harness.routeNativeElement!.textContent).toContain('Ferretería Norte');
  const products=harness.routeNativeElement!.querySelector('.store-actions a')!;
  expect(products.getAttribute('href')).toContain('ferreteriaId=s');
  component.changePage(2);await harness.fixture.whenStable();
  expect(api.list).toHaveBeenLastCalledWith(2,'','','');
  component.region='Metropolitana';component.commune='Vieja';component.filterChanged(true);await harness.fixture.whenStable();
  expect(api.list).toHaveBeenLastCalledWith(1,'Metropolitana','','');
 });
 it('lets maestros save, edit and remove their own review and refresh the scores',async()=>{
  const {api,harness}=await setup('maestro');
  const component=await harness.navigateByUrl('/ferreterias/s',FerreteriasComponent) as any;
  await harness.fixture.whenStable();harness.detectChanges();
  expect(api.myReview).toHaveBeenCalledWith('s');
  component.rating=4;component.comment=' Buena atención ';await component.saveReview();harness.detectChanges();
  expect(api.saveReview).toHaveBeenCalledWith('s',4,'Buena atención');
  expect(component.ownReview.id).toBe('r');expect(api.detail).toHaveBeenCalledTimes(2);
  component.comment='Atención actualizada';await component.saveReview();
  expect(api.saveReview).toHaveBeenLastCalledWith('s',4,'Atención actualizada');
  await component.deleteReview();expect(api.deleteReview).toHaveBeenCalledWith('s');expect(component.ownReview).toBeNull();
 });
 it('shows public reviews to guests and offers sign in with a return to the same store',async()=>{
  const {api,harness}=await setup();await harness.navigateByUrl('/ferreterias/s',FerreteriasComponent);
  await harness.fixture.whenStable();harness.detectChanges();
  expect(api.myReview).not.toHaveBeenCalled();
  expect(harness.routeNativeElement!.querySelector('textarea')).toBeNull();
  const login=harness.routeNativeElement!.querySelector('a[href^="/login"]')!;
  expect(login.getAttribute('href')).toContain('returnUrl=%2Fferreterias%2Fs');
 });
});
