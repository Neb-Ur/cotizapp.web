import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { WorkspaceNavigationService } from './workspace-navigation.service';

describe('workspace navigation',()=>{
 const user=signal<any>(null);let events:Subject<any>;
 beforeEach(()=>{events=new Subject();TestBed.configureTestingModule({providers:[{provide:AuthService,useValue:{currentUser:user}},{provide:Router,useValue:{url:'/dashboard/ferreteria',events}}]});});
 afterEach(()=>TestBed.resetTestingModule());
 it('keeps donor navigation exclusive to vehicle stores and highlights the exact action',()=>{
  user.set({role:'ferreteria',businessType:'desarmaduria'});const nav=TestBed.inject(WorkspaceNavigationService);
  expect(nav.active()).toBe(true);expect(nav.links().some(item=>item.section==='vehiculos')).toBe(true);
  events.next(new NavigationEnd(1,'','/dashboard/ferreteria?section=catalogo&accion=archivo'));
  expect(nav.links().filter(item=>nav.isActive(item)).map(item=>item.label)).toEqual(['Carga por Excel']);
  user.set({role:'ferreteria',businessType:'ferreteria'});expect(nav.links().some(item=>item.section==='vehiculos')).toBe(false);
  events.next(new NavigationEnd(2,'','/buscar'));expect(nav.active()).toBe(false);
 });
 it('uses the shared shell on administration only for the admin role',()=>{
  user.set({role:'admin'});const nav=TestBed.inject(WorkspaceNavigationService);
  events.next(new NavigationEnd(1,'','/dashboard/admin/validaciones?section=productos'));
  expect(nav.active()).toBe(true);expect(nav.links().filter(item=>nav.isActive(item)).map(item=>item.section)).toEqual(['productos']);
  user.set({role:'maestro'});expect(nav.active()).toBe(false);
 });
});
