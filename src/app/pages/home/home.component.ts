import { ProductImageDirective } from '../../shared/directives/product-image.directive';
import { productSlug } from '../../core/utils/product-url.util';
import { categoryIcon } from '../../core/utils/category-icon.util';
import { FormsModule } from '@angular/forms';
import { HomeDiscoveryStateService } from '../../core/services/home-discovery-state.service';
import { VehicleCatalogService, VehicleCatalog } from '../../core/services/vehicle-catalog.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, signal, inject, Injector, ElementRef, ViewChild, HostListener, afterNextRender, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { FamilyProductRow, SearchFilters, TaxonomyOption } from '../../core/models/app.models';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { productPath } from '../../core/utils/product-url.util';
import { STORE_ACCESS_WHATSAPP_URL } from '../../core/config/legal-identity.config';

interface HomeCategory extends TaxonomyOption {
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ProductImageDirective, FormsModule, CommonModule, RouterLink, SkeletonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly state = inject(HomeDiscoveryStateService);
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  @ViewChild('discoverySearch') private searchForm?: ElementRef<HTMLElement>;
  protected readonly areas = [
    {id:'',label:'Todos',icon:'pi pi-th-large'}, {id:'materiales',label:'Materiales',icon:'pi pi-box'},
    {id:'herramientas',label:'Herramientas',icon:'pi pi-wrench'}, {id:'repuestos',label:'Repuestos',icon:'pi pi-car'}
  ];
  protected area: SearchFilters['area'] = this.state.value.area;
  protected vehicleBrand = this.state.value.brand;
  protected vehicleModel = this.state.value.model;
  protected vehicleYear = this.state.value.year;
  protected vehicleCatalog: VehicleCatalog = {brands:[],models:[]};
  protected vehicleLoading = false;
  protected vehicleError = '';
  protected readonly years = Array.from({length:new Date().getFullYear()+2-1886},(_,i)=>String(new Date().getFullYear()+1-i));
  protected query = '';
  protected suggestions: FamilyProductRow[] = [];
  protected suggestionsOpen = false;
  protected suggestionsLoading = false;
  protected suggestionsError = '';
  protected activeSuggestion = -1;
  protected suggestionTop = 0;
  protected suggestionHeight = 300;
  protected readonly areaLoading = signal(false);
  private suggestionTimer?: ReturnType<typeof setTimeout>;
  private suggestionRequest = 0;
  private previewRequest = 0;
  private destroyed = false;
  private focusFrame?: number;
  private readonly positionSuggestions = (): void => {
    if (!this.suggestionsOpen || !this.searchForm || typeof window === 'undefined') return;
    const input = this.searchForm.nativeElement.querySelector('input')!;
    this.suggestionTop = input.getBoundingClientRect().bottom + 8;
    const viewport = window.visualViewport;
    this.suggestionHeight = Math.max(0,(viewport?.offsetTop || 0)+(viewport?.height ?? window.innerHeight)-this.suggestionTop-12);
    this.changeDetector.markForCheck();
  };
  protected get modelOptions() { return this.vehicleCatalog.models.filter(m=>m.activo!==false && m.marcaId===this.vehicleBrand); }
  protected get searchLabel(): string { return this.area==='repuestos'?'Buscar repuestos':this.area==='herramientas'?'Buscar herramientas':this.area==='materiales'?'Buscar materiales':'Buscar productos'; }
  protected get searchParams(): Record<string,string|undefined> {
    return {q:this.query.trim() || undefined,rubro:this.area,
      ...(this.area==='repuestos'?{vehiculoMarcaId:this.vehicleBrand || undefined,vehiculoModeloId:this.vehicleModel || undefined,vehiculoAnio:this.vehicleYear || undefined}:{})};
  }
  protected get previewTitle(): string {
    const model=this.modelOptions.find(m=>m.id===this.vehicleModel);
    return this.area==='repuestos'?(model?'Repuestos para tu '+model.nombre:'Repuestos automotrices')
      :this.area==='herramientas'?'Herramientas y consumibles':this.area==='materiales'?'Materiales para tu proyecto':'Explora el catálogo';
  }
  private get discoveryFilters(): SearchFilters {
    return {area:this.area,...(this.area==='repuestos'?{vehicleBrandId:this.vehicleBrand || undefined,vehicleModelId:this.vehicleModel || undefined,vehicleYear:this.vehicleYear?Number(this.vehicleYear):undefined}:{})};
  }
  protected selectArea(value: string): void {
    this.area = value as SearchFilters['area'] || undefined;
    this.criteriaChanged();
    if (this.area==='repuestos') void this.loadVehicles();
  }
  protected changeVehicleBrand(value:string):void {this.vehicleBrand=value;this.vehicleModel='';this.vehicleYear='';this.criteriaChanged();}
  protected changeVehicleModel(value:string):void {this.vehicleModel=value;this.vehicleYear='';this.criteriaChanged();}
  protected changeVehicleYear(value:string):void {this.vehicleYear=value;this.criteriaChanged();}
  protected clearVehicle():void {this.vehicleBrand='';this.vehicleModel='';this.vehicleYear='';this.criteriaChanged();}
  private criteriaChanged():void {
    this.state.value={area:this.area,brand:this.vehicleBrand,model:this.vehicleModel,year:this.vehicleYear};
    this.closeSuggestions();
    if(!this.area){this.previewRequest++;this.areaLoading.set(false);this.syncCatalogView();}
    else void this.loadAreaPreview();
  }
  protected async loadVehicles():Promise<void> {
    if(this.vehicleLoading || this.vehicleCatalog.brands.length) return;
    this.vehicleLoading=true;this.vehicleError='';
    try {const catalog=await this.injector.get(VehicleCatalogService).publicCatalog();if(!this.destroyed)this.vehicleCatalog=catalog;}
    catch {if(!this.destroyed)this.vehicleError='No pudimos cargar los vehículos. Puedes buscar por nombre o reintentar.';}
    finally {this.vehicleLoading=false;this.changeDetector.markForCheck();}
  }
  private async loadAreaPreview():Promise<void> {
    const request=++this.previewRequest;this.featuredProducts.set([]);this.areaLoading.set(true);this.catalogError='';
    try {
      const page=await this.dataService.searchProductPage(this.discoveryFilters,1,24,'relevance');
      if(this.destroyed || request!==this.previewRequest)return;
      this.featuredProducts.set([...page.items.filter(p=>p.imageUrl),...page.items.filter(p=>!p.imageUrl)].slice(0,4));
    }catch {if(request===this.previewRequest)this.catalogError='No pudimos cargar esta selección. Puedes continuar con Buscar.';}
    finally {if(request===this.previewRequest)this.areaLoading.set(false);}
  }
  protected focusDiscovery():void {
    document.body.classList.add('discovery-search-open');
    this.suggestionsOpen=true;this.refreshSuggestions();this.positionSuggestions();
    if(typeof window!=='undefined' && window.innerWidth<=1000){
      this.focusFrame=window.requestAnimationFrame(()=>{
        if(this.destroyed || !this.searchForm)return;
        const header=document.querySelector('app-site-navbar')?.getBoundingClientRect().height || 70;
        window.scrollTo({top:Math.max(0,window.scrollY+this.searchForm.nativeElement.getBoundingClientRect().top-header-8),behavior:'instant'});
        this.positionSuggestions();
      });
    }
  }
  protected onDiscoveryInput():void {
    document.body.classList.add('discovery-search-open');
    this.suggestionsOpen=true;this.activeSuggestion=-1;this.positionSuggestions();
    clearTimeout(this.suggestionTimer);this.suggestionRequest++;
    if(this.query.trim().length<2){this.suggestions=this.featuredProducts();this.suggestionsLoading=false;this.suggestionsError='';return;}
    this.suggestions=[];this.suggestionsLoading=true;this.suggestionsError='';
    this.suggestionTimer=setTimeout(()=>this.refreshSuggestions(),250);
  }
  private refreshSuggestions():void {
    clearTimeout(this.suggestionTimer);const request=++this.suggestionRequest;this.suggestionsError='';
    if(this.query.trim().length<2){this.suggestions=this.featuredProducts();this.suggestionsLoading=false;return;}
    this.suggestionsLoading=true;
    void this.dataService.searchProductPage({...this.discoveryFilters,query:this.query.trim()},1,6,'relevance').then(page=>{
      if(!this.destroyed && request===this.suggestionRequest)this.suggestions=page.items;
    }).catch(()=>{if(!this.destroyed && request===this.suggestionRequest){this.suggestions=[];this.suggestionsError='No pudimos cargar sugerencias. Puedes continuar con Buscar.';}})
      .finally(()=>{if(!this.destroyed && request===this.suggestionRequest){this.suggestionsLoading=false;this.changeDetector.markForCheck();}});
  }
  protected closeSuggestions():void {if(typeof document!=='undefined')document.body.classList.remove('discovery-search-open');this.suggestionsOpen=false;this.activeSuggestion=-1;this.suggestionRequest++;clearTimeout(this.suggestionTimer);this.suggestionsLoading=false;}
  protected onDiscoveryKeydown(event:KeyboardEvent):void {
    if(event.isComposing)return;
    if(event.key==='Escape'){event.preventDefault();this.closeSuggestions();return;}
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&this.suggestions.length){
      event.preventDefault();document.body.classList.add('discovery-search-open');this.suggestionsOpen=true;
      this.activeSuggestion=event.key==='ArrowDown'?(this.activeSuggestion+1)%this.suggestions.length:(this.activeSuggestion<=0?this.suggestions.length-1:this.activeSuggestion-1);
      this.positionSuggestions();setTimeout(()=>document.getElementById('discovery-option-'+this.activeSuggestion)?.scrollIntoView?.({block:'nearest'}));
    }else if(event.key==='Enter'&&this.suggestionsOpen&&this.activeSuggestion>=0){event.preventDefault();this.openProduct(this.suggestions[this.activeSuggestion]);this.closeSuggestions();}
  }
  protected onDiscoveryFocusOut(event:FocusEvent):void {if(event.relatedTarget && !this.searchForm?.nativeElement.contains(event.relatedTarget as Node))this.closeSuggestions();}
  protected submitDiscovery():void {this.closeSuggestions();void this.router.navigate(['/buscar'],{queryParams:this.searchParams});}
  @HostListener('window:resize') @HostListener('window:scroll')
  protected onViewportChange():void {this.positionSuggestions();}
  @HostListener('document:click',['$event'])
  protected onOutsideDiscovery(event:MouseEvent):void {if(!this.searchForm?.nativeElement.contains(event.target as Node))this.closeSuggestions();}
  ngOnDestroy():void {
    if(typeof document!=='undefined')document.body.classList.remove('discovery-search-open');
    this.destroyed=true;clearTimeout(this.suggestionTimer);this.previewRequest++;this.suggestionRequest++;
    if(typeof window!=='undefined'){
      if(this.focusFrame!==undefined)window.cancelAnimationFrame(this.focusFrame);
      window.visualViewport?.removeEventListener('resize',this.positionSuggestions);
      window.visualViewport?.removeEventListener('scroll',this.positionSuggestions);
    }
  }

  protected readonly storeAccessWhatsappUrl = STORE_ACCESS_WHATSAPP_URL;
  protected readonly featuredProducts = signal<FamilyProductRow[]>([]);
  protected featuredCategories: HomeCategory[] = [];
  protected readonly catalogLoading = signal(true);
  protected catalogError = '';
  private preview: {products:FamilyProductRow[];categories:TaxonomyOption[]} | null = null;



  constructor(
    private readonly dataService: FirebaseDataService,
    private readonly router: Router
  ) {
    afterNextRender(()=>{
      window.visualViewport?.addEventListener('resize',this.positionSuggestions);
      window.visualViewport?.addEventListener('scroll',this.positionSuggestions);
    });
  }

  ngOnInit(): void {
    void this.loadCatalog();
    if(this.area){void this.loadAreaPreview();if(this.area==='repuestos')void this.loadVehicles();}
  }

  protected openProduct(product: FamilyProductRow): void {
    void this.router.navigateByUrl(product.seoPath || productPath(product.productName));
  }

  protected categoryPath(name:string):string {return `/categorias/${productSlug(name)}`;}
  protected openCategory(category: HomeCategory): void {
    void this.router.navigateByUrl(this.categoryPath(category.name));
  }

  protected openProductCard(event: MouseEvent, product: FamilyProductRow): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    this.openProduct(product);
  }

  protected productUrl(productName: string): string {
    return productPath(productName);
  }

  protected formatCurrency(value: number): string {
    return this.dataService.formatCurrency(value);
  }

  private async loadCatalog(): Promise<void> {
    this.catalogLoading.set(true);
    this.catalogError = '';

    try {
      this.syncCatalogView();
      this.preview = await this.dataService.getHomeCatalogPreview();
      this.syncCatalogView();
    } catch {
      this.catalogError = 'No fue posible cargar los productos disponibles.';
    } finally {
      this.catalogLoading.set(false);
    }
  }

  private syncCatalogView(): void {
    const categories=this.preview?.categories.length?this.preview.categories:this.dataService.getCategoryOptions(false).slice(0,8);
    this.featuredCategories=categories.map(category=>({...category,icon:categoryIcon(category)}));
    if(this.area)return;
    const rows=this.dataService.getPopularProductRows('', Number.MAX_SAFE_INTEGER, undefined, false);
    if(this.preview?.products.length){
      this.featuredProducts.set(this.preview.products);
    }else this.featuredProducts.set(rows.slice(0,4));
  }
}
