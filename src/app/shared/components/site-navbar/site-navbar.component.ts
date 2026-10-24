import { CATEGORY_ICONS, categoryIcon } from '../../../core/utils/category-icon.util';
import { trapDialogFocus } from '../../utils/dialog-focus.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogSearchIndexService } from '../../../core/services/catalog-search-index.service';
import { CatalogSuggestion, SuggestionGroup } from '../../../core/utils/catalog-search-index.util';
import { Subscription } from 'rxjs';
import { productSlug, productPath } from '../../../core/utils/product-url.util';
import { Component, HostListener, OnDestroy, OnInit, ChangeDetectorRef, ElementRef, ViewChild, afterNextRender, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronDown, faChevronRight, faRightToBracket, faTableCellsLarge, faXmark } from '@fortawesome/free-solid-svg-icons';
import { SearchFilters, TaxonomyOption } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseDataService } from '../../../core/services/firebase-data.service';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';

@Component({
  selector: 'app-site-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, FontAwesomeModule, BrandMarkComponent],
  templateUrl: './site-navbar.component.html',
  styleUrl: './site-navbar.component.scss'
})
export class SiteNavbarComponent implements OnInit, OnDestroy {
  protected catalogPath(kind:string,name:string):string {return `/${kind}/${productSlug(name)}`;}
  protected readonly categoryIcon = categoryIcon;
  protected searchValue = '';
  protected suggestionGroups: SuggestionGroup[] = [];
  protected scopedSearchLoading = false;
  protected scopedSearchError = '';
  private scopedSearchTimer?: ReturnType<typeof setTimeout>;
  private scopedSearchRequest = 0;
  private get scopedSearchFilters(): SearchFilters {
    if(this.router.url.split(/[?#]/)[0]!=='/buscar')return {};
    const p=this.router.parseUrl(this.router.url).queryParams;
    return {area:['materiales','herramientas'].includes(p['rubro'])?p['rubro']:undefined,categoryId:p['categoria'] || undefined,subcategoryId:p['subcategoria'] || undefined,
      familyId:p['familia'] || undefined,brand:p['marca'] || undefined,brandId:p['marcaId'] || undefined,
      storeId:p['ferreteriaId'] || undefined};
  }
  protected get hasScopedSearch():boolean {return Object.values(this.scopedSearchFilters).some(value=>value!==undefined);}

  protected taxonomyLoading = false;
  protected taxonomyError = '';
  private taxonomyLoad?: Promise<void>;
  protected searchOpen = false;
  protected activeSuggestion = -1;
  protected searchPanelTop = 70;
  protected searchPanelMaxHeight = 400;
  private readonly positionSearchPanel = (): void => {
    if (!this.searchOpen || typeof window === 'undefined' || !this.searchShell) return;
    const viewport = window.visualViewport;
    this.searchPanelTop = this.searchShell.nativeElement.getBoundingClientRect().bottom + 10;
    this.searchPanelMaxHeight = Math.max(0,
      (viewport?.offsetTop || 0) + (viewport?.height ?? window.innerHeight) - this.searchPanelTop - 12);
    this.changeDetector.markForCheck();
  };
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('searchShell') private searchShell?: ElementRef<HTMLElement>;
  private navigationSubscription?: Subscription;
  @ViewChild('mobileDrawer') private mobileDrawer?: ElementRef<HTMLElement>;
  private previouslyFocused: HTMLElement | null = null;
  protected menuOpen = false;
  protected categoriesOpen = true;
  protected taxonomyOpen = false;
  protected activeDesktopCategoryId = '';
  protected expandedMobileCategoryId = '';
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faLogin = faRightToBracket;
  protected readonly faCategories = faTableCellsLarge;
  protected readonly faClose = faXmark;
  private lastSearchInputAt = 0;
  private previousBodyOverflow = '';

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: FirebaseDataService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    protected readonly searchIndex: CatalogSearchIndexService
  ) {
    afterNextRender(() => {
      window.visualViewport?.addEventListener('resize', this.positionSearchPanel);
      window.visualViewport?.addEventListener('scroll', this.positionSearchPanel);
    });
    afterNextRender(()=>{if (!this.isStoreDashboard && !this.isHomePage) {void this.searchIndex.ensureReady();this.preloadTaxonomy();}});
    effect(()=>{const version=this.searchIndex.version();this.dataService.acceptCatalogSearchVersion(version);this.searchIndex.ready();this.updateSuggestions();});
  }

  ngOnInit(): void {
    this.syncSearchFromRoute();
    this.navigationSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        if(!this.isStoreDashboard && !this.isHomePage) {void this.searchIndex.ensureReady();this.preloadTaxonomy();}
        this.closeSearch();
        this.closeMenu();
        this.closeTaxonomy();
        this.syncSearchFromRoute();
      }
    });
  }

  protected get flatSuggestions(): CatalogSuggestion[] { return this.suggestionGroups.flatMap(group=>group.items); }
  protected get activeOptionId(): string | null {
    const suggestion=this.flatSuggestions[this.activeSuggestion];
    return this.searchOpen && suggestion ? this.optionId(suggestion) : null;
  }
  protected optionId(item:CatalogSuggestion):string { return `header-option-${item.kind}-${encodeURIComponent(item.id)}`; }
  protected suggestionParams(item:CatalogSuggestion):Record<string,string>|undefined {
    const source=this.router.parseUrl(this.router.url).queryParams;
    const context=Object.fromEntries(['projectTarget','draftName','draftAddress','ferreteriaId','ferreteria'].filter(key=>source[key]).map(key=>[key,source[key]]));
    const params={...context,...(item.path?{}:item.queryParams)};
    return Object.keys(params).length?params:undefined;
  }
  protected suggestionUrl(item:CatalogSuggestion):string { return item.path || (item.kind==='product'?productPath(item.name):'/buscar'); }

  protected updateSuggestions():void {
    this.activeSuggestion=-1;
    clearTimeout(this.scopedSearchTimer);const request=++this.scopedSearchRequest;
    this.scopedSearchError='';this.scopedSearchLoading=false;
    if(!this.hasScopedSearch){this.suggestionGroups=this.searchIndex.search(this.searchValue);return;}
    this.suggestionGroups=[];if(this.searchValue.trim().length<2)return;
    this.scopedSearchLoading=true;
    this.scopedSearchTimer=setTimeout(()=>{
      void this.dataService.searchProductPage({...this.scopedSearchFilters,query:this.searchValue.trim()},1,6,'relevance').then(page=>{
        if(request!==this.scopedSearchRequest)return;
        this.suggestionGroups=page.items.length?[{kind:'product',label:'Productos',items:page.items.map(p=>({kind:'product',id:p.productoMaestroId || p.productName,name:p.productName,path:p.seoPath,context:p.productType}))}]:[];
      }).catch(()=>{if(request===this.scopedSearchRequest)this.scopedSearchError='No pudimos cargar sugerencias. Puedes continuar con Buscar.';})
        .finally(()=>{if(request===this.scopedSearchRequest){this.scopedSearchLoading=false;this.changeDetector.markForCheck();}});
    },250);
  }
  private readonly baseStoreNavigation = [
    {label:'Dashboard',icon:'pi pi-chart-bar',section:'inicio'},
    {label:'Mi catálogo',icon:'pi pi-box',section:'catalogo'},
    {label:'Agregar productos',icon:'pi pi-plus',section:'catalogo',accion:'agregar'},
    {label:'Carga por Excel',icon:'pi pi-upload',section:'catalogo',accion:'archivo'},
    {label:'Cotizaciones',icon:'pi pi-file-check',section:'cotizaciones'},
    {label:'Mi perfil',icon:'pi pi-user',section:'perfil'}
  ];
  protected get storeNavigation():Array<{label:string;icon:string;section:string;accion?:string}>{
    return this.baseStoreNavigation;
  }
  protected get isFerreteria(): boolean { return this.authService.currentUser()?.role === 'ferreteria'; }
  protected get isStoreDashboard(): boolean {
    return this.isFerreteria && (this.router.url.startsWith('/dashboard/ferreteria') || this.router.url.startsWith('/cuenta/contrato-ferreteria'));
  }
  protected storeLinkActive(item: {section:string;accion?:string}): boolean {
    const query = this.router.parseUrl(this.router.url).queryParams;
    return this.router.url.startsWith('/dashboard/ferreteria') && (query['section'] || 'inicio') === item.section && (query['accion'] || '') === (item.accion || '');
  }

  protected get isHomePage(): boolean { return this.router.url.split(/[?#]/)[0] === '/'; }
  protected get returnUrl(): string { return this.router.url; }
  protected get isMaestro(): boolean { return this.authService.currentUser()?.role === 'maestro'; }
  protected readonly maestroNavigation = [
    {label:'Inicio',icon:'pi pi-home',section:'inicio'},
    {label:'Mis cotizaciones',icon:'pi pi-file',section:'cotizaciones'},
    {label:'Historial',icon:'pi pi-history',section:'historial'},
    {label:'Perfil',icon:'pi pi-user',section:'perfil'}
  ];
  protected maestroLinkActive(section: string): boolean {
    return this.router.url.startsWith('/dashboard/maestro') &&
      (this.router.parseUrl(this.router.url).queryParams['section'] || 'inicio') === section;
  }

  protected onSearchInput():void {
    const now = Date.now();
    if (now - this.lastSearchInputAt > 1500) void this.searchIndex.ensureReady(true);
    this.lastSearchInputAt = now;
    this.updateSuggestions();this.searchOpen=this.searchValue.trim().length>=2;
    this.positionSearchPanel();
    this.closeTaxonomy();
  }
  protected focusSearch():void {
    this.closeTaxonomy();this.closeMenu();
    this.searchOpen=this.searchValue.trim().length>=2;
    this.updateSuggestions();this.positionSearchPanel();void this.searchIndex.ensureReady(true);
  }
  protected clearSearch():void { this.searchValue='';this.updateSuggestions();this.searchOpen=false;this.searchInput?.nativeElement.focus(); }
  protected retrySearchIndex():void { if(this.hasScopedSearch)this.updateSuggestions();else void this.searchIndex.ensureReady(); }
  protected closeSearch():void { this.searchOpen=false;this.activeSuggestion=-1;this.scopedSearchRequest++;clearTimeout(this.scopedSearchTimer);this.scopedSearchLoading=false; }
  protected onSearchKeydown(event:KeyboardEvent):void {
    if (event.isComposing) return;
    const suggestions=this.flatSuggestions;
    if (event.key==='Escape') {this.closeSearch();event.stopPropagation();return;}
    if ((event.key==='ArrowDown'||event.key==='ArrowUp') && suggestions.length) {
      event.preventDefault();this.searchOpen=true;
      this.positionSearchPanel();
      this.activeSuggestion=event.key==='ArrowDown'?(this.activeSuggestion+1)%suggestions.length
        :(this.activeSuggestion<=0?suggestions.length-1:this.activeSuggestion-1);
      const id=this.activeOptionId;
      if(id) setTimeout(()=>document.getElementById(id)?.scrollIntoView?.({block:'nearest'}));
    } else if(event.key==='Enter'&&this.searchOpen&&this.activeSuggestion>=0) {
      event.preventDefault();this.chooseSuggestion(suggestions[this.activeSuggestion]);
    }
  }
  protected chooseSuggestion(item:CatalogSuggestion):void {
    this.closeSearch();this.closeMenu();this.closeTaxonomy();
    if(item.kind==='product') { const params=this.suggestionParams(item); const query=params?new URLSearchParams(params).toString():''; void this.router.navigateByUrl((item.path || productPath(item.name))+(query?'?'+query:'')); }
    else if(item.path) void this.router.navigateByUrl(item.path);
    else void this.router.navigate(['/buscar'],{queryParams:item.queryParams});
  }
  protected submitSearch():void {
    this.closeSearch();this.closeMenu();this.closeTaxonomy();
    const query=this.searchValue.trim();
    const context=this.router.url.split(/[?#]/)[0]==='/buscar'?this.router.parseUrl(this.router.url).queryParams:{};
    const rubro=context['rubro'];
    const activeContext=Object.fromEntries(['categoria','subcategoria','familia','marca','marcaId','ferreteriaId','ferreteria','projectTarget','draftName','draftAddress','latitude','longitude','radiusKm','sort','page'].filter(key=>context[key] !== undefined).map(key=>[key,context[key]]));
    void this.router.navigate(['/buscar'],{queryParams:{...activeContext,...(['materiales','herramientas'].includes(rubro)?{rubro}:{}),q:query || undefined}});
  }
  protected onSearchFocusOut(event:FocusEvent):void {
    if(!this.searchShell?.nativeElement.contains(event.relatedTarget as Node|null)) this.closeSearch();
  }

  private syncSearchFromRoute(): void {
    const url = this.router.parseUrl(this.router.url);
    if (url.root.children['primary']?.segments[0]?.path === 'buscar') {
      this.searchValue = url.queryParams['q'] || '';
    }
  }

  protected trapMenuFocus(event: Event): void {
    if (this.mobileDrawer) trapDialogFocus(this.mobileDrawer.nativeElement, event as KeyboardEvent);
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void { this.positionSearchPanel(); }

  @HostListener('window:resize')
  protected onResize(): void {
    this.positionSearchPanel();
    if (typeof window !== 'undefined' && window.innerWidth > 1000 && !this.isMaestro) this.closeMenu();
  }

  protected preloadTaxonomy(): void {
    if (this.taxonomyLoad) return;
    const retry = !!this.taxonomyError;
    this.taxonomyLoading = true;
    this.taxonomyError = '';
    this.taxonomyLoad = this.dataService.refreshSearchTaxonomy(retry)
      .catch(() => { this.taxonomyError = 'No pudimos cargar las categorías.'; })
      .finally(() => {
        this.taxonomyLoad = undefined;
        this.taxonomyLoading = false;
        this.changeDetector.markForCheck();
      });
  }

  protected get categories(): TaxonomyOption[] {
    return this.dataService.getCategoryOptions(false);
  }

  protected subcategoriesFor(categoryId: string): TaxonomyOption[] {
    return this.dataService.getSubcategoryOptions(categoryId,false);
  }

  protected familiesFor(subcategoryId: string): TaxonomyOption[] {
    return this.dataService.getFamilyOptions(subcategoryId,false);
  }

  protected get activeDesktopCategory(): TaxonomyOption | null {
    return this.categories.find((category) => category.id === this.activeDesktopCategoryId)
      || this.categories[0]
      || null;
  }

  protected get isLogged(): boolean {
    return this.authService.isLoggedIn();
  }

  protected get dashboardUrl(): string {
    return this.authService.dashboardRouteForUser(this.authService.currentUser());
  }

  protected toggleMenu(): void {
    this.closeSearch();
    this.taxonomyOpen = false;
    if (!this.menuOpen) this.preloadTaxonomy();
    this.setMenuOpen(!this.menuOpen);
  }

  protected closeMenu(): void {
    this.setMenuOpen(false);
  }

  protected toggleCategories(): void {
    this.categoriesOpen = !this.categoriesOpen;
    if (this.categoriesOpen) this.preloadTaxonomy();
  }

  protected toggleTaxonomy(event: MouseEvent): void {
    this.closeSearch();
    event.stopPropagation();
    this.taxonomyOpen = !this.taxonomyOpen;
    if (this.taxonomyOpen) this.preloadTaxonomy();
    if (this.taxonomyOpen && !this.activeDesktopCategoryId) {
      this.activeDesktopCategoryId = this.categories[0]?.id || '';
    }
  }

  protected setActiveDesktopCategory(categoryId: string): void {
    this.activeDesktopCategoryId = categoryId;
  }

  protected toggleMobileCategory(categoryId: string): void {
    this.expandedMobileCategoryId = this.expandedMobileCategoryId === categoryId ? '' : categoryId;
  }

  protected closeTaxonomy(): void {
    this.taxonomyOpen = false;
  }

  protected logout(): void {
    this.authService.logout();
    this.closeMenu();
    this.router.navigateByUrl('/');
  }

  @HostListener('document:keydown.escape')
  protected closeMenuWithEscape(): void {
    this.closeSearch();
    this.closeMenu();
    this.closeTaxonomy();
  }

  @HostListener('document:click', ['$event'])
  protected closeTaxonomyOnOutsideClick(event:MouseEvent): void {
    this.closeTaxonomy();
    if(!this.searchShell?.nativeElement.contains(event.target as Node)) this.closeSearch();
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();this.scopedSearchRequest++;clearTimeout(this.scopedSearchTimer);
    if (typeof window !== 'undefined') {
      window.visualViewport?.removeEventListener('resize', this.positionSearchPanel);
      window.visualViewport?.removeEventListener('scroll', this.positionSearchPanel);
    }
    if (this.menuOpen) this.restoreBodyScroll();
  }

  private setMenuOpen(open: boolean): void {
    if (this.menuOpen === open) return;
    this.menuOpen = open;

    if (typeof document === 'undefined') return;
    if (open) {
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      setTimeout(() => { if (this.menuOpen) this.mobileDrawer?.nativeElement.focus(); });
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('navigation-open');
      return;
    }

    this.restoreBodyScroll();
    if (this.previouslyFocused?.isConnected) this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }

  private restoreBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.previousBodyOverflow;
    document.body.classList.remove('navigation-open');
  }
}
