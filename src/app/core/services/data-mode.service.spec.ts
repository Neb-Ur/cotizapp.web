import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataModeService } from './data-mode.service';
import { API_BASE_URL } from '../config/api.config';
describe('demo and real environment selection',()=>{
 let service:DataModeService;let http:HttpTestingController;
 beforeEach(()=>{localStorage.clear();TestBed.configureTestingModule({imports:[HttpClientTestingModule]});service=TestBed.inject(DataModeService);http=TestBed.inject(HttpTestingController);});
 afterEach(()=>http.verify());
 for(const demo of [true,false]){
  it(`initializes from the server DEMO=${demo}`,async()=>{
   const ready=service.initialize();http.expectOne(`${API_BASE_URL}/config`).flush({ok:true,data:{demo}});await ready;
   expect(service.mode()).toBe(demo?'demo':'real');
  });
 }
 it('honors a per-admin selection, attaches it even for public catalog requests, and resets on logout',()=>{
  localStorage.setItem('cotizapp-admin-data-mode:admin','demo');service.setAccount('admin','admin');
  expect(service.mode()).toBe('demo');
  expect(service.requestHeaders('token',false).get('X-Data-Mode')).toBe('demo');
  expect(service.requestHeaders('token',false).get('Authorization')).toBe('Bearer token');
  service.setAccount('','');expect(service.mode()).toBe('real');expect(service.requestHeaders('token',false).has('X-Data-Mode')).toBe(false);
 });
 it('an ordinary account ignores an admin selection and cannot toggle environments',()=>{
  localStorage.setItem('cotizapp-admin-data-mode:user','demo');service.setAccount('user','maestro');
  expect(service.mode()).toBe('real');expect(service.requestHeaders('token',false).has('Authorization')).toBe(false);
  expect(()=>service.toggleDemo()).toThrow('Solo el administrador');
 });
 it('does not silently choose a realm when configuration cannot be read',async()=>{
  const ready=service.initialize();http.expectOne(`${API_BASE_URL}/config`).flush({ok:true,data:{}});
  await expect(ready).rejects.toThrow('entorno');
 });
});
