import { ProductImageDirective } from '../../shared/directives/product-image.directive';
import { productSlug } from '../../core/utils/product-url.util';
import { categoryIcon } from '../../core/utils/category-icon.util';
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SkeletonModule } from 'primeng/skeleton';
import { FamilyProductRow, TaxonomyOption } from '../../core/models/app.models';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { productPath } from '../../core/utils/product-url.util';
import { STORE_ACCESS_WHATSAPP_URL } from '../../core/config/legal-identity.config';

interface HomeCategory extends TaxonomyOption {
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ProductImageDirective, CommonModule, RouterLink, SkeletonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected readonly storeAccessWhatsappUrl = STORE_ACCESS_WHATSAPP_URL;
  protected readonly featuredProducts = signal<FamilyProductRow[]>([]);
  protected featuredCategories: HomeCategory[] = [];
  protected readonly catalogLoading = signal(true);
  protected catalogError = '';
  private preview: {products:FamilyProductRow[];categories:TaxonomyOption[]} | null = null;



  constructor(
    private readonly dataService: FirebaseDataService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.loadCatalog();
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
      const initialLoad = this.dataService.refreshPublicCatalogSection();
      this.syncCatalogView();
      void this.dataService.getHomeCatalogPreview().then(preview=>{
        this.preview=preview;
        this.syncCatalogView();
        if(this.featuredProducts().length)this.catalogLoading.set(false);
      }).catch(()=>undefined);
      await initialLoad;
      this.syncCatalogView();

      void this.dataService.refreshPublicCatalogEnhancements()
        .then(() => this.syncCatalogView())
        .catch(() => undefined);
    } catch {
      this.catalogError = 'No fue posible cargar los productos disponibles.';
    } finally {
      this.catalogLoading.set(false);
    }
  }

  private syncCatalogView(): void {
    const rows=this.dataService.getPopularProductRows('', Number.MAX_SAFE_INTEGER, undefined, false);
    if(this.preview?.products.length){
      this.featuredProducts.set(this.preview.products);
    }else this.featuredProducts.set(rows.slice(0,4));
    const categories=this.preview?.categories.length?this.preview.categories:this.dataService.getCategoryOptions(false).slice(0,8);
    this.featuredCategories=categories.map(category=>({...category,icon:categoryIcon(category)}));
  }
}
