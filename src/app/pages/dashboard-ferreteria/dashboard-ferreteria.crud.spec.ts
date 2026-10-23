import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DashboardFerreteriaComponent } from './dashboard-ferreteria.component';
import { ApiClientService } from '../../core/services/api-client.service';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';

// Real panel, forms, onboarding and data service; only the HTTP boundary is isolated.
describe('junkyard catalog user flow',()=>{
 let fixture:ComponentFixture<DashboardFerreteriaComponent>;
 let offers:any[];
 let api:any;
 const master={id:'radiator',nombre:'Radiador Mahindra KUV100 2016–2019',categoriaId:'cat-repuestos-automotrices',subcategoriaId:'motor',familiaId:'radiators',marca:'Mahindra',estado:'activo',compatibilidadVehiculos:[{marcaId:'mahindra',modeloId:'kuv',marcaNombre:'Mahindra',modeloNombre:'KUV100',anioDesde:2016,anioHasta:2019}]};
 const root=()=>fixture.nativeElement as HTMLElement;
 const settle=async()=>{fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();};
 const button=(text:string)=>{const match=Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent?.trim()===text);if(!match)throw Error('Missing button: '+text);return match;};
 async function editField(label:string,value:string){
  const container=Array.from(root().querySelectorAll('app-ui-modal label')).find(l=>l.textContent?.trim().startsWith(label));
  const field=container?.querySelector<HTMLInputElement|HTMLSelectElement>('input,select');
  if(!field)throw Error('Missing field: '+label);
  field.value=value;field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));await settle();
 }
 beforeEach(async()=>{
  offers=[];
  const auth={currentUser:()=>({id:'owner',ferreteriaId:'junkyard',role:'ferreteria',businessType:'desarmaduria',businessName:'Desarmaduría de prueba',email:'owner@example.test',displayName:'Dueño',accountStatus:'activo'}),emailVerified:signal(true)};
  api={get:vi.fn(async(path:string)=>{
   if(path==='/config')return {imageStorage:{enabled:true}};
   if(path==='/store-onboarding/current')return {acceptanceRequired:false,canAccept:true};
   if(path==='/ferreterias/junkyard/catalogo')return offers.map(o=>({...o,productoMaestro:master}));
   if(path==='/categorias')return [{id:'cat-repuestos-automotrices',nombre:'Repuestos automotrices'}];
   if(path==='/subcategorias')return [{id:'motor',nombre:'Motor',categoriaId:'cat-repuestos-automotrices'}];
   if(path==='/familias')return [{id:'radiators',nombre:'Radiadores',subcategoriaId:'motor',permiteVehiculos:true}];
   if(path==='/productos-maestro')return [master];
   if(path==='/productos-maestro/radiator')return master;
   if(path==='/ferreterias/junkyard/productos-disponibles')return {items:offers.length?[]:[master],page:1,size:25,total:offers.length?0:1,totalPages:1};
   if(path==='/busqueda')return [];
   throw Error('Unexpected GET: '+path);
  }),post:vi.fn(async(path:string,body:any)=>{offers.push({id:'offer',...body});return offers[0];}),
  patch:vi.fn(async(path:string,body:any)=>{offers[0]={...offers[0],...body};return offers[0];}),
  uploadImage:vi.fn(async()=>{const photos=[{id:'photo',url:'https://cdn.example/own.webp',thumbnailUrl:'https://cdn.example/thumb.webp'}];offers[0].fotosPublicacion=photos;return {photos};}),
  delete:vi.fn(async(path:string)=>{if(path.includes('/fotos/')){offers[0].fotosPublicacion=[];return {photos:[]};}offers=[];return {deleted:true};})};
  const data=new FirebaseDataService(api,auth as any);
  await TestBed.configureTestingModule({imports:[DashboardFerreteriaComponent],providers:[
   {provide:AuthService,useValue:auth},{provide:ApiClientService,useValue:api},{provide:FirebaseDataService,useValue:data},
   {provide:Router,useValue:{navigate:vi.fn(async()=>true)}},
   {provide:ActivatedRoute,useValue:{queryParamMap:of(convertToParamMap({section:'catalogo'}))}}
  ]}).compileComponents();
  fixture=TestBed.createComponent(DashboardFerreteriaComponent);await settle();
 });
 afterEach(()=>fixture?.destroy());
 it('adds an automotive variant, edits used condition and stock, hides it and deletes only the local offer',async()=>{
  expect(root().textContent).toContain('Aun no tienes productos');
  button('Agregar producto individual').click();await settle();
  const typeSelect=root().querySelector('select')!;typeSelect.value='repuestos';typeSelect.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  const row=root().querySelector('tbody tr')!;expect(row.textContent).toContain(master.nombre);
  const inputs=row.querySelectorAll<HTMLInputElement>('input');
  const condition=row.querySelector('select')!;condition.value='usado';condition.dispatchEvent(new Event('change',{bubbles:true}));
  inputs[0].click();inputs[1].value='35000';inputs[1].dispatchEvent(new Event('input',{bubbles:true}));
  inputs[2].value='2';inputs[2].dispatchEvent(new Event('input',{bubbles:true}));await settle();
  button('Agregar seleccionados').click();await settle();
  expect(api.post).toHaveBeenCalledWith('/ferreterias/junkyard/catalogo',expect.objectContaining({productoMaestroId:'radiator',precio:35000,stock:2,condicion:'usado'}),true);
  const fileInput=root().querySelector<HTMLInputElement>('app-offer-photo-manager input[type=file]')!;
  Object.defineProperty(fileInput,'files',{value:[new File(['fixture'],'pieza.png',{type:'image/png'})],configurable:true});
  fileInput.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  expect(api.uploadImage).toHaveBeenCalledWith('/ferreterias/junkyard/catalogo/offer/fotos',expect.any(File));
  expect(root().querySelector('app-offer-photo-manager img')?.getAttribute('src')).toBe('https://cdn.example/thumb.webp');
  button('Eliminar foto').click();await settle();
  expect(api.delete).toHaveBeenCalledWith('/ferreterias/junkyard/catalogo/offer/fotos/photo',true);
  expect(root().querySelector('app-offer-photo-manager img')).toBeNull();
  button('Cancelar').click();await settle();
  button('Volver al catálogo').click();await settle();
  root().querySelector<HTMLButtonElement>('[aria-label="Editar producto"]')!.click();await settle();
  await editField('Precio','39000');await editField('Stock','0');await editField('Condición de esta publicación','usado');
  const published=root().querySelector<HTMLInputElement>('.catalog-edit-published input[type="checkbox"]')!;published.click();await settle();
  button('Guardar cambios').click();await settle();
  expect(api.patch).toHaveBeenCalledWith('/ferreterias/junkyard/catalogo/offer',expect.objectContaining({precio:39000,stock:0,condicion:'usado',publicado:false}),true);
  expect(root().querySelector('tbody tr')?.textContent).toContain('No');
  root().querySelector<HTMLButtonElement>('[aria-label="Eliminar producto"]')!.click();await settle();
  button('Eliminar').click();await settle();
  expect(api.delete).toHaveBeenCalledWith('/ferreterias/junkyard/catalogo/offer',true);
  expect(root().textContent).toContain('Aun no tienes productos');
  expect(master.compatibilidadVehiculos[0].anioHasta).toBe(2019);
 });
});
