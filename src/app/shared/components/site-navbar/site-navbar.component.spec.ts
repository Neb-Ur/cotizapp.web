import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { CatalogSearchIndexService } from '../../../core/services/catalog-search-index.service';
import { vi } from 'vitest';
import { SiteNavbarComponent } from './site-navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseDataService } from '../../../core/services/firebase-data.service';

async function setup(url = '/buscar') {
  const data = { refreshSearchTaxonomy:vi.fn(async()=>{}), acceptCatalogSearchVersion:vi.fn(), getCategoryOptions:()=>[], getSubcategoryOptions:()=>[], getFamilyOptions:()=>[], searchProductPage:vi.fn() };
  const index={ready:signal(true),version:signal('v1'),loading:signal(false),error:signal(''),ensureReady:vi.fn(async()=>{}),search:vi.fn(()=>[] as any[])};
  await TestBed.configureTestingModule({ imports:[SiteNavbarComponent], providers:[provideRouter([]),
    {provide:FirebaseDataService,useValue:data},
    {provide:CatalogSearchIndexService,useValue:index},
    {provide:AuthService,useValue:{isLoggedIn:()=>false,currentUser:()=>null,dashboardRouteForUser:()=>'/dashboard',logout:vi.fn()}}
  ] }).compileComponents();
  vi.spyOn(TestBed.inject(Router),'url','get').mockReturnValue(url);
  const fixture=TestBed.createComponent(SiteNavbarComponent);
  fixture.detectChanges();
  return {fixture,component:fixture.componentInstance as any,router:TestBed.inject(Router),data,index};
}

describe('header navigation and search',()=>{
  afterEach(()=>{ TestBed.resetTestingModule(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('opens the admin panel with a fresh document on desktop and mobile rather than loading an old lazy route',async()=>{
    const {fixture,router}=await setup();const auth=TestBed.inject(AuthService) as any;
    auth.currentUser=()=>({role:'admin'});auth.isLoggedIn=()=>true;
    auth.dashboardRouteForUser=()=>'/dashboard/admin/validaciones';fixture.detectChanges();
    const links=Array.from(fixture.nativeElement.querySelectorAll('a[href="/dashboard/admin/validaciones"]')) as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    const navigate=vi.spyOn(router,'navigateByUrl');
    for(const link of links){
      // Dispatch without the browser's default navigation in the test environment.
      const click=new MouseEvent('click',{bubbles:true,cancelable:true});click.preventDefault();link.dispatchEvent(click);
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps maestro account sections in the shared menu with the active destination marked',async()=>{
    const {fixture,router}=await setup();const auth=TestBed.inject(AuthService) as any;
    auth.currentUser=()=>({role:'maestro'});auth.isLoggedIn=()=>true;
    vi.spyOn(router,'url','get').mockReturnValue('/dashboard/maestro?section=historial');fixture.detectChanges();
    const links=Array.from(fixture.nativeElement.querySelectorAll('.mobile-drawer a[href^="/dashboard/maestro"]')) as HTMLAnchorElement[];
    expect(links.map(a=>a.textContent?.trim())).toEqual(['Inicio','Mis cotizaciones','Historial','Perfil']);
    expect(links.map(a=>a.getAttribute('href'))).toEqual(['inicio','cotizaciones','historial','perfil'].map(section=>`/dashboard/maestro?section=${section}`));
    expect(links.filter(a=>a.getAttribute('aria-current')==='page').map(a=>a.textContent?.trim())).toEqual(['Historial']);
    expect(fixture.nativeElement.querySelector('.navbar .account-nav-icon')).toBeNull();
    expect(fixture.nativeElement.querySelector('.navbar').classList.contains('navbar--maestro')).toBe(true);
  });

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

  it('keeps mobile suggestions below the input when the pilot notice is visible and the keyboard opens',async()=>{
    const viewport=Object.assign(new EventTarget(),{height:800,offsetTop:0});
    vi.stubGlobal('visualViewport',viewport);vi.stubGlobal('innerWidth',390);
    const {fixture}=await setup();
    const shell=fixture.nativeElement.querySelector('.search-shell') as HTMLElement;
    vi.spyOn(shell,'getBoundingClientRect').mockReturnValue({bottom:224} as DOMRect);
    const input=fixture.nativeElement.querySelector('input[role="combobox"]') as HTMLInputElement;
    input.value='ma';input.dispatchEvent(new Event('input',{bubbles:true}));
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    const panel=fixture.nativeElement.querySelector('.search-panel') as HTMLElement;
    expect(panel.style.getPropertyValue('--search-panel-top')).toBe('234px');
    expect(panel.style.getPropertyValue('--search-panel-max-height')).toBe('554px');
    viewport.height=460;viewport.dispatchEvent(new Event('resize'));fixture.detectChanges();
    expect(panel.style.getPropertyValue('--search-panel-top')).toBe('234px');
    expect(panel.style.getPropertyValue('--search-panel-max-height')).toBe('214px');
    expect(input.value).toBe('ma');expect(input.getAttribute('aria-expanded')).toBe('true');
    vi.spyOn(shell,'getBoundingClientRect').mockReturnValue({bottom:62} as DOMRect);
    window.dispatchEvent(new Event('scroll'));fixture.detectChanges();
    expect(panel.style.getPropertyValue('--search-panel-top')).toBe('72px');
    viewport.offsetTop=30;viewport.dispatchEvent(new Event('scroll'));fixture.detectChanges();
    expect(panel.style.getPropertyValue('--search-panel-max-height')).toBe('406px');
  });

  it('fits suggestions without VisualViewport and releases viewport listeners on destroy',async()=>{
    vi.stubGlobal('visualViewport',undefined);vi.stubGlobal('innerHeight',600);
    const {fixture,component}=await setup();
    vi.spyOn(fixture.nativeElement.querySelector('.search-shell'),'getBoundingClientRect').mockReturnValue({bottom:200} as DOMRect);
    component.searchValue='ma';component.onSearchInput();fixture.detectChanges();
    expect(component.searchPanelMaxHeight).toBe(378);
    vi.stubGlobal('innerHeight',180);window.dispatchEvent(new Event('resize'));fixture.detectChanges();
    expect(component.searchPanelMaxHeight).toBe(0);fixture.destroy();TestBed.resetTestingModule();
    const viewport=Object.assign(new EventTarget(),{height:600,offsetTop:0});
    const remove=vi.spyOn(viewport,'removeEventListener');vi.stubGlobal('visualViewport',viewport);
    const next=await setup();next.fixture.destroy();
    expect(remove).toHaveBeenCalledWith('resize',expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll',expect.any(Function));
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

  it('keeps Shift+Tab in the open drawer and hides floating controls only while open', async () => {
    const {fixture, component} = await setup('/');
    document.body.append(fixture.nativeElement);
    component.toggleMenu(); fixture.detectChanges(); await fixture.whenStable();
    const drawer = fixture.nativeElement.querySelector('.mobile-drawer') as HTMLElement;
    drawer.focus();
    const event = new KeyboardEvent('keydown', {key:'Tab', shiftKey:true, bubbles:true, cancelable:true});
    drawer.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(drawer.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(drawer);
    expect(document.body.classList.contains('navigation-open')).toBe(true);
    fixture.destroy(); fixture.nativeElement.remove();
    expect(document.body.classList.contains('navigation-open')).toBe(false);
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
 expect(fixture.nativeElement.querySelector('.navbar-search')).toBeNull();expect(fixture.nativeElement.textContent).toContain('Mi panel');
});

it('keeps the home header compact without duplicating the discovery search',async()=>{
 const {fixture,router}=await setup();vi.spyOn(router,'url','get').mockReturnValue('/');fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.navbar--home')).not.toBeNull();
 expect(fixture.nativeElement.querySelector('.navbar-search')).toBeNull();
 vi.spyOn(router,'url','get').mockReturnValue('/buscar');fixture.detectChanges();
 expect(fixture.nativeElement.querySelector('.navbar-search')).not.toBeNull();
});

it('keeps category scope while dropping old area and vehicle context',async()=>{
 const {component,router,data}=await setup();
 vi.spyOn(router,'url','get').mockReturnValue('/buscar?categoria=pinturas&rubro=herramientas&vehiculoMarcaId=mahindra&vehiculoModeloId=kuv&vehiculoAnio=2018&q=foco');
 data.searchProductPage.mockResolvedValue({items:[{productoMaestroId:'radiador',productName:'Radiador KUV100',productType:'Radiador',seoPath:'/productos/radiador-kuv'}]});
 component.searchValue='radiador';component.onSearchInput();await new Promise(resolve=>setTimeout(resolve,300));
 expect(data.searchProductPage).toHaveBeenCalledWith(expect.objectContaining({categoryId:'pinturas',query:'radiador'}),1,6,'relevance');
 expect(component.flatSuggestions[0].name).toBe('Radiador KUV100');
 const navigate=vi.spyOn(router,'navigate').mockResolvedValue(true);component.submitSearch();
 expect(navigate).toHaveBeenCalledWith(['/buscar'],{queryParams:{categoria:'pinturas',q:'radiador'}});
});
it('shows donor inventory only for junkyards and parts stores',async()=>{
 const {fixture,router}=await setup();const auth=TestBed.inject(AuthService) as any;vi.spyOn(router,'url','get').mockReturnValue('/dashboard/ferreteria');auth.isLoggedIn=()=>true;
 for(const businessType of ['desarmaduria','repuestos','ferreteria']){auth.currentUser=()=>({role:'ferreteria',businessType});fixture.detectChanges();const links=Array.from(fixture.nativeElement.querySelectorAll('.store-header-links a')) as HTMLAnchorElement[];expect(links.some(a=>a.textContent?.includes('Mis vehículos'))).toBe(false);}
});

describe('home navigation loading',()=>{
 afterEach(()=>{TestBed.resetTestingModule();vi.restoreAllMocks();});
it('does not download the unused header search index on home and loads categories when opened',async()=>{
 const {fixture,component,data,index}=await setup('/');await fixture.whenStable();
 expect(index.ensureReady).not.toHaveBeenCalled();expect(data.refreshSearchTaxonomy).not.toHaveBeenCalled();
 component.toggleMenu();await fixture.whenStable();
 expect(data.refreshSearchTaxonomy).toHaveBeenCalledOnce();expect(index.ensureReady).not.toHaveBeenCalled();
 fixture.destroy();
});

it('lets users retry an on-demand category request that failed',async()=>{
 const {fixture,component,data}=await setup('/');await fixture.whenStable();
 data.refreshSearchTaxonomy.mockRejectedValueOnce(new Error('Network'));
 component.toggleTaxonomy(new MouseEvent('click'));await component.taxonomyLoad;await fixture.whenStable();fixture.detectChanges();
 expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las categorías.');
 const retry=Array.from(fixture.nativeElement.querySelectorAll('button')).find((b:any)=>b.textContent.trim()==='Reintentar') as HTMLButtonElement;
 retry.click();await component.taxonomyLoad;await fixture.whenStable();fixture.detectChanges();expect(component.taxonomyError).toBe('');expect(component.taxonomyLoading).toBe(false);expect(data.refreshSearchTaxonomy).toHaveBeenLastCalledWith(true);
 fixture.destroy();
});

});

it('opens search suggestions in the detail with the quotation context instead of adding quantity one',async()=>{
 const {component,router}=await setup('/buscar?projectTarget=quote-1&draftName=Obra&vehiculoAnio=2018');
 const navigate=vi.spyOn(router,'navigateByUrl').mockResolvedValue(true);
 component.chooseSuggestion({kind:'product',id:'radiador',name:'Radiador'});
 const destination=navigate.mock.calls[0][0] as string;
 expect(destination).toContain('/productos/radiador?');
 const params=new URL(destination,'https://test.local').searchParams;
 expect(params.get('projectTarget')).toBe('quote-1');expect(params.get('draftName')).toBe('Obra');expect(params.has('addProduct')).toBe(false);
});
