import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { CatalogSearchIndexService } from '../../../core/services/catalog-search-index.service';
import { vi } from 'vitest';
import { SiteNavbarComponent } from './site-navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseDataService } from '../../../core/services/firebase-data.service';

async function setup() {
  const data = { refreshSearchTaxonomy:vi.fn(async()=>{}), acceptCatalogSearchVersion:vi.fn(), getCategoryOptions:()=>[], getSubcategoryOptions:()=>[], getFamilyOptions:()=>[], searchProductPage:vi.fn() };
  const index={ready:signal(true),version:signal('v1'),loading:signal(false),error:signal(''),ensureReady:vi.fn(async()=>{}),search:vi.fn(()=>[] as any[])};
  await TestBed.configureTestingModule({ imports:[SiteNavbarComponent], providers:[provideRouter([]),
    {provide:FirebaseDataService,useValue:data},
    {provide:CatalogSearchIndexService,useValue:index},
    {provide:AuthService,useValue:{isLoggedIn:()=>false,currentUser:()=>null,dashboardRouteForUser:()=>'/dashboard',logout:vi.fn()}}
  ] }).compileComponents();
  const fixture=TestBed.createComponent(SiteNavbarComponent);
  fixture.detectChanges();
  return {fixture,component:fixture.componentInstance as any,router:TestBed.inject(Router),data,index};
}

describe('header navigation and search',()=>{
  afterEach(()=>{ TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('submits a trimmed query and keeps search outside the mobile drawer',async()=>{
    const {fixture,component,router}=await setup();
    const navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);
    component.searchValue='  MDF negro 18 mm  ';
    fixture.nativeElement.querySelector('.navbar-search').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(navigate).toHaveBeenCalledWith(['/buscar'],{queryParams:{q:'MDF negro 18 mm'}});
    expect(fixture.nativeElement.querySelector('.mobile-drawer [role="search"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.navbar [role="search"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[href="/registro"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[href="/preguntas-frecuentes"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.mobile-drawer [href="/ferreterias"]')).not.toBeNull();
  });

  it('opens the selected product directly',async()=>{
    const {component,router}=await setup();
    const navigate=vi.spyOn(router,'navigateByUrl').mockResolvedValue(true);
    component.chooseSuggestion({kind:'product',name:'MDF negro 18 mm',id:'mdf'});
    expect(navigate).toHaveBeenCalledWith('/productos/mdf-negro-18-mm');
  });

  it('searches locally and routes family and brand selections to their filters',async()=>{
    const {component,index,data,router}=await setup();
    const navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);
    component.searchValue='tornillo';component.onSearchInput();
    expect(index.search).toHaveBeenCalledWith('tornillo');expect(data.searchProductPage).not.toHaveBeenCalled();
    component.chooseSuggestion({kind:'brand',name:'Marca Uno',queryParams:{marca:'Marca Uno'}});
    expect(navigate).toHaveBeenLastCalledWith(['/buscar'],{queryParams:{marca:'Marca Uno'}});
    component.chooseSuggestion({kind:'family',name:'MDF',queryParams:{familia:'mdf',subcategoria:'tableros',categoria:'maderas'}});
    expect(navigate).toHaveBeenLastCalledWith(['/buscar'],{queryParams:{familia:'mdf',subcategoria:'tableros',categoria:'maderas'}});
  });
  it('supports ArrowDown and Enter in the grouped combobox',async()=>{
    const {component,index,router,fixture}=await setup();
    const navigate=vi.spyOn(router,'navigateByUrl').mockResolvedValue(true);
    index.search.mockReturnValue([{kind:'product',label:'Productos',items:[{id:'mdf',kind:'product',name:'MDF negro 18 mm',context:'MDF'}]}]);
    component.searchValue='mdf';component.onSearchInput();fixture.detectChanges();
    const input=fixture.nativeElement.querySelector('[role="combobox"]');
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));fixture.detectChanges();
    expect(input.getAttribute('aria-activedescendant')).toBe('header-option-product-mdf');
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    expect(navigate).toHaveBeenCalledWith('/productos/mdf-negro-18-mm');expect(component.searchOpen).toBe(false);
  });

  it('releases scrolling on Escape and restores the menu trigger focus',async()=>{
    const {fixture,component}=await setup();
    document.body.style.overflow='auto';
    const trigger=fixture.nativeElement.querySelector('.hamburger');
    document.body.appendChild(fixture.nativeElement);trigger.focus();trigger.click();fixture.detectChanges();
    expect(component.menuOpen).toBe(true);expect(document.body.style.overflow).toBe('hidden');
    expect(trigger.getAttribute('aria-controls')).toBe('mobile-navigation');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));fixture.detectChanges();
    expect(component.menuOpen).toBe(false);expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(trigger);
    fixture.nativeElement.remove();document.body.style.overflow='';
  });

  it('does not unlock another modal when the navbar is destroyed with its menu closed',async()=>{
    const {fixture}=await setup();
    document.body.style.overflow='hidden';fixture.destroy();
    expect(document.body.style.overflow).toBe('hidden');document.body.style.overflow='';
  });
});

it('replaces public search with store navigation in the dashboard and restores Home with a return button',async()=>{
 const {fixture,component,router}=await setup();const auth=TestBed.inject(AuthService) as any;
 auth.currentUser=()=>({role:'ferreteria'});auth.isLoggedIn=()=>true;auth.dashboardRouteForUser=()=>'/dashboard/ferreteria';
 const url=vi.spyOn(router,'url','get').mockReturnValue('/dashboard/ferreteria');fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.navbar-search')).toBeNull();
 expect(fixture.nativeElement.querySelectorAll('.store-header-links a')).toHaveLength(6);
 expect(fixture.nativeElement.textContent).toContain('Ir a inicio');
 url.mockReturnValue('/');fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.navbar-search')).not.toBeNull();expect(fixture.nativeElement.textContent).toContain('Ir a dashboard');
});
