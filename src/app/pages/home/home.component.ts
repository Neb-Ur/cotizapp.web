import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { FamilyProductRow, TaxonomyOption } from '../../core/models/app.models';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
import { productPath } from '../../core/utils/product-url.util';

interface HomeCategory extends TaxonomyOption {
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AutoCompleteModule, ButtonModule, SkeletonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected searchValue: string | FamilyProductRow = '';
  protected searchSuggestions: FamilyProductRow[] = [];
  protected featuredProducts: FamilyProductRow[] = [];
  protected featuredCategories: HomeCategory[] = [];
  protected catalogLoading = true;
  protected catalogError = '';

  private readonly categoryIcons = [
    'pi pi-building', 'pi pi-box', 'pi pi-wrench', 'pi pi-bolt',
    'pi pi-palette', 'pi pi-home', 'pi pi-sun', 'pi pi-cog'
  ];

  constructor(
    private readonly dataService: FirebaseDataService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    void this.loadCatalog();
  }

  protected searchProducts(event: AutoCompleteCompleteEvent): void {
    const query = event.query.trim();
    this.searchSuggestions = query.length < 2
      ? []
      : this.dataService.getPopularProductRows(query, 6, undefined, false);
  }

  protected selectSuggestion(event: AutoCompleteSelectEvent): void {
    this.openProduct(event.value as FamilyProductRow);
  }

  protected submitSearch(): void {
    if (typeof this.searchValue !== 'string') {
      this.openProduct(this.searchValue);
      return;
    }

    const query = this.searchValue.trim();
    void this.router.navigate(['/buscar'], { queryParams: query ? { q: query } : undefined });
  }

  protected openProduct(product: FamilyProductRow): void {
    void this.router.navigateByUrl(productPath(product.productName));
  }

  protected openCategory(category: HomeCategory): void {
    void this.router.navigate(['/buscar'], { queryParams: { categoria: category.id } });
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
      .map((category, index) => ({
        ...category,
        icon: this.categoryIcons[index % this.categoryIcons.length]
      }));
  }
}
