import { CATEGORY_ICONS, categoryIcon } from '../../../core/utils/category-icon.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CatalogSearchIndexService } from '../../../core/services/catalog-search-index.service';
import { CatalogSuggestion, SuggestionGroup } from '../../../core/utils/catalog-search-index.util';
import { Subscription } from 'rxjs';
import { productPath } from '../../../core/utils/product-url.util';
import { Component, HostListener, OnDestroy, OnInit, ChangeDetectorRef, ElementRef, ViewChild, afterNextRender, effect } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronDown, faChevronRight, faRightToBracket, faTableCellsLarge, faXmark } from '@fortawesome/free-solid-svg-icons';
import { TaxonomyOption } from '../../../core/models/app.models';
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
  protected readonly categoryIcon = categoryIcon;
  protected searchValue = '';
  protected suggestionGroups: SuggestionGroup[] = [];
  protected searchOpen = false;
  protected activeSuggestion = -1;
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
    afterNextRender(()=>{void this.searchIndex.ensureReady();});
    effect(()=>{const version=this.searchIndex.version();this.dataService.acceptCatalogSearchVersion(version);this.searchIndex.ready();this.updateSuggestions();});
  }

  ngOnInit(): void {
    this.syncSearchFromRoute();
    this.navigationSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
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
  protected suggestionParams(item:CatalogSuggestion):Record<string,string>|undefined { return item.queryParams; }
  protected suggestionUrl(item:CatalogSuggestion):string { return item.kind==='product'?productPath(item.name):'/buscar'; }

  protected updateSuggestions():void {
    this.activeSuggestion=-1;
    this.suggestionGroups=this.searchIndex.search(this.searchValue);
  }
  protected get returnUrl(): string { return this.router.url; }
  protected get isMaestro(): boolean { return this.authService.currentUser()?.role === 'maestro'; }

  protected onSearchInput():void {
    const now = Date.now();
    if (now - this.lastSearchInputAt > 1500) void this.searchIndex.ensureReady(true);
    this.lastSearchInputAt = now;
    this.updateSuggestions();this.searchOpen=this.searchValue.trim().length>=2;
    this.closeTaxonomy();
  }
  protected focusSearch():void {
    this.closeTaxonomy();this.closeMenu();
    this.searchOpen=this.searchValue.trim().length>=2;
    this.updateSuggestions();void this.searchIndex.ensureReady(true);
  }
  protected clearSearch():void { this.searchValue='';this.updateSuggestions();this.searchOpen=false;this.searchInput?.nativeElement.focus(); }
  protected retrySearchIndex():void { void this.searchIndex.ensureReady(); }
  protected closeSearch():void { this.searchOpen=false;this.activeSuggestion=-1; }
  protected onSearchKeydown(event:KeyboardEvent):void {
    if (event.isComposing) return;
    const suggestions=this.flatSuggestions;
    if (event.key==='Escape') {this.closeSearch();event.stopPropagation();return;}
    if ((event.key==='ArrowDown'||event.key==='ArrowUp') && suggestions.length) {
      event.preventDefault();this.searchOpen=true;
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
    if(item.kind==='product') void this.router.navigateByUrl(productPath(item.name));
    else void this.router.navigate(['/buscar'],{queryParams:item.queryParams});
  }
  protected submitSearch():void {
    this.closeSearch();this.closeMenu();this.closeTaxonomy();
    const query=this.searchValue.trim();
    void this.router.navigate(['/buscar'],{queryParams:query?{q:query}:undefined});
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
    const keyboardEvent = event as KeyboardEvent;
    const elements = Array.from(this.mobileDrawer?.nativeElement.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled])') || []);
    const first = elements[0]; const last = elements.at(-1);
    if (!first || !last) return;
    if (keyboardEvent.shiftKey && (document.activeElement === first || document.activeElement === this.mobileDrawer?.nativeElement)) {
      event.preventDefault(); last.focus();
    } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth > 1000) this.closeMenu();
  }

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
    this.closeSearch();
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
    this.closeSearch();
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
    this.navigationSubscription?.unsubscribe();
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
      return;
    }

    this.restoreBodyScroll();
    if (this.previouslyFocused?.isConnected) this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }

  private restoreBodyScroll(): void {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = this.previousBodyOverflow;
  }
}
