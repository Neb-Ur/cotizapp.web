import { productSlug } from '../../core/utils/product-url.util';
import { categoryIcon } from '../../core/utils/category-icon.util';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  imports: [CommonModule, RouterLink, SkeletonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected readonly storeAccessWhatsappUrl = STORE_ACCESS_WHATSAPP_URL;
  protected featuredProducts: FamilyProductRow[] = [];
  protected featuredCategories: HomeCategory[] = [];
  protected catalogLoading = true;
  protected catalogError = '';



  constructor(
    private readonly dataService: FirebaseDataService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.loadCatalog();
  }

  protected openProduct(product: FamilyProductRow): void {
    void this.router.navigateByUrl(productPath(product.productName));
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
    this.catalogLoading = true;
    this.catalogError = '';

    try {
      const initialLoad = this.dataService.refreshPublicCatalogSection();
      this.syncCatalogView();
      await initialLoad;
      this.syncCatalogView();

      void this.dataService.refreshPublicCatalogEnhancements()
        .then(() => this.syncCatalogView())
        .catch(() => undefined);
    } catch {
      this.catalogError = 'No fue posible cargar los productos disponibles.';
    } finally {
      this.catalogLoading = false;
    }
  }

  private syncCatalogView(): void {
    this.featuredProducts = this.dataService.getPopularProductRows('', 12, undefined, false);
    this.featuredCategories = this.dataService.getCategoryOptions(false)
      .slice(0, 8)
      .map((category) => ({
        ...category,
        icon: categoryIcon(category)
      }));
  }
}
