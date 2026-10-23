import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { ProyectoDetalleComponent } from './proyecto-detalle.component';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { DataModeService } from '../../core/services/data-mode.service';
import { PilotService } from '../../core/services/pilot.service';

async function setup() {
 const params=new BehaviorSubject(convertToParamMap({projectId:'existing'}));
 const queryParams=new BehaviorSubject(convertToParamMap({}));
 const navigate=vi.fn();
 const finishes:Array<()=>void>=[];
 const api={refreshMaestroData:vi.fn(()=>new Promise<void>(resolve=>finishes.push(resolve))),
  getProjectById:vi.fn((_owner:string,id:string)=>({id,name:'Obra '+id,items:[]})),
  buildProjectQuotation:()=>({lines:[],singleStoreOptions:[],optimalTotal:0}),getProjectComparisonStrategies:()=>[],getProductOptions:()=>[],formatCurrency:String};
 await TestBed.configureTestingModule({imports:[ProyectoDetalleComponent],providers:[
    {provide:ActivatedRoute,useValue:{paramMap:params,queryParamMap:queryParams}},
    {provide:Router,useValue:{navigate}},{provide:AuthService,useValue:{currentUser:()=>({id:'master',role:'maestro'})}},
  {provide:FirebaseDataService,useValue:api},{provide:DataModeService,useValue:{mode:()=> 'real'}},{provide:PilotService,useValue:null}
 ]}).compileComponents();
 const fixture=TestBed.createComponent(ProyectoDetalleComponent);fixture.detectChanges();
 return {fixture,params,queryParams,navigate,finishes,api,component:fixture.componentInstance as any};
}

describe('quotation detail loading',()=>{
 afterEach(()=>TestBed.resetTestingModule());
 it('shows the code outside information panels even for an empty quotation',async()=>{
  const {fixture,finishes,api,component}=await setup();
  const code='TRV-AAAA-BBBB-CCCC-DDDD';
  api.getProjectById.mockReturnValueOnce({id:'existing',name:'Obra',items:[],verificationCode:code} as any);
  finishes[0]();await vi.waitFor(()=>expect(component.isLoading).toBe(false));await fixture.whenStable();fixture.detectChanges();
  const card=fixture.nativeElement.querySelector('.verification-code');
  expect(card.textContent).toContain(code);
  expect(card.textContent).toContain('Copiar código');
  expect(card.closest('app-info-panel')).toBeNull();
  expect(fixture.nativeElement.querySelectorAll('.verification-code').length).toBe(1);
  expect(fixture.nativeElement.textContent).toContain('Aún no hay productos');
 });
 it('routes legacy addProduct links to detail without changing the quotation',async()=>{
  const {fixture,finishes,queryParams,navigate,api,component}=await setup();
  finishes[0]();await fixture.whenStable();
  queryParams.next(convertToParamMap({addProduct:'Cemento'}));
  finishes[1]();await fixture.whenStable();
  expect(component.projectItems).toEqual([]);
  expect(component.hasUnsavedChanges).toBe(false);
  expect(navigate).toHaveBeenCalledWith(['/productos/cemento'],{queryParams:{projectTarget:'existing',draftName:null,draftAddress:null}});
  expect(api.refreshMaestroData).toHaveBeenCalledTimes(2);
  expect(component.isLoading).toBe(false);
 });
 it('shows loading instead of a new quotation until the existing quotation is ready',async()=>{
  const {fixture,finishes,component}=await setup();
  expect(fixture.nativeElement.textContent).toContain('Cargando cotización');
  expect(fixture.nativeElement.textContent).not.toContain('Nueva cotización');
  expect(fixture.nativeElement.querySelector('app-ui-loader')).not.toBeNull();
  expect(component.isNewProject).toBe(false);
  finishes[0]();await vi.waitFor(()=>expect(component.isLoading).toBe(false));await fixture.whenStable();fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Detalle de cotización');
  expect(component.projectName).toBe('Obra existing');
  expect(fixture.nativeElement.querySelector('app-ui-loader')).toBeNull();
 });
 it('ignores an old load when another quotation is opened',async()=>{
  const {fixture,finishes,params,component,api}=await setup();
  params.next(convertToParamMap({projectId:'second'}));
  finishes[0]();await Promise.resolve();fixture.detectChanges();
  expect(component.isLoading).toBe(true);expect(api.getProjectById).not.toHaveBeenCalled();
  finishes[1]();await fixture.whenStable();fixture.detectChanges();
  expect(component.projectName).toBe('Obra second');expect(component.isLoading).toBe(false);
 });
 it('keeps load errors separate from an editable quotation',async()=>{
  const {fixture,component,finishes,api}=await setup();
  api.getProjectById.mockReturnValueOnce(null as any);
  finishes[0]();await vi.waitFor(()=>expect(component.isLoading).toBe(false));await fixture.whenStable();fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('No encontramos esta cotización');
  expect(fixture.nativeElement.textContent).toContain('Reintentar');
  expect(component.isLoading).toBe(false);
  expect(fixture.nativeElement.querySelector('.quotation-table-card')).toBeNull();
 });
});
