import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronDown, faChevronRight, faRightToBracket, faTableCellsLarge, faXmark } from '@fortawesome/free-solid-svg-icons';
import { TaxonomyOption } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { FirebaseDataService } from '../../../core/services/firebase-data.service';
import { BrandMarkComponent } from '../brand-mark/brand-mark.component';

@Component({
  selector: 'app-site-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FontAwesomeModule, BrandMarkComponent],
  templateUrl: './site-navbar.component.html',
  styleUrl: './site-navbar.component.scss'
})
export class SiteNavbarComponent implements OnDestroy {
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
  private previousBodyOverflow = '';

  constructor(
    private readonly authService: AuthService,
    private readonly dataService: FirebaseDataService,
    private readonly router: Router
  ) {}

  protected get categories(): TaxonomyOption[] {
    return this.dataService.getCategoryOptions();
  }

  protected subcategoriesFor(categoryId: string): TaxonomyOption[] {
    return this.dataService.getSubcategoryOptions(categoryId);
  }

  protected familiesFor(subcategoryId: string): TaxonomyOption[] {
    return this.dataService.getFamilyOptions(subcategoryId);
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
    this.taxonomyOpen = false;
    this.setMenuOpen(!this.menuOpen);
  }

  protected closeMenu(): void {
    this.setMenuOpen(false);
  }

  protected toggleCategories(): void {
    this.categoriesOpen = !this.categoriesOpen;
  }

  protected toggleTaxonomy(event: MouseEvent): void {
    event.stopPropagation();
    this.taxonomyOpen = !this.taxonomyOpen;
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
    this.closeMenu();
    this.closeTaxonomy();
  }

  @HostListener('document:click')
  protected closeTaxonomyOnOutsideClick(): void {
    this.closeTaxonomy();
  }

  ngOnDestroy(): void {
    this.restoreBodyScroll();
  }

  private setMenuOpen(open: boolean): void {
    if (this.menuOpen === open) return;
    this.menuOpen = open;

    if (typeof document === 'undefined') return;
    if (open) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return;
    }

    this.restoreBodyScroll();
  }

  private restoreBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.previousBodyOverflow;
  }
}
