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
 const finishes:Array<()=>void>=[];
 const api={refreshMaestroData:vi.fn(()=>new Promise<void>(resolve=>finishes.push(resolve))),
  getProjectById:vi.fn((_owner:string,id:string)=>({id,name:'Obra '+id,items:[]})),
  buildProjectQuotation:()=>({lines:[],singleStoreOptions:[],optimalTotal:0}),getProjectComparisonStrategies:()=>[],getProductOptions:()=>[],formatCurrency:String};
 await TestBed.configureTestingModule({imports:[ProyectoDetalleComponent],providers:[
  {provide:ActivatedRoute,useValue:{paramMap:params,queryParamMap:new BehaviorSubject(convertToParamMap({}))}},
  {provide:Router,useValue:{navigate:vi.fn()}},{provide:AuthService,useValue:{currentUser:()=>({id:'master',role:'maestro'})}},
  {provide:FirebaseDataService,useValue:api},{provide:DataModeService,useValue:{mode:()=> 'real'}},{provide:PilotService,useValue:null}
 ]}).compileComponents();
 const fixture=TestBed.createComponent(ProyectoDetalleComponent);fixture.detectChanges();
 return {fixture,params,finishes,api,component:fixture.componentInstance as any};
}

describe('quotation detail loading',()=>{
 afterEach(()=>TestBed.resetTestingModule());
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
