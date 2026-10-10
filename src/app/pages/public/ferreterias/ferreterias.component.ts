import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, ChangeDetectorRef, inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StoreDirectoryService } from '../../../core/services/store-directory.service';
import { DirectoryStore, StoreReview, StoreDirectoryPage, StoreReviewPage } from '../../../core/models/app.models';
import { STORE_ACCESS_WHATSAPP_URL } from '../../../core/config/legal-identity.config';
import { UiLoaderComponent } from '../../../shared/components/ui-loader/ui-loader.component';

@Component({
  selector: 'app-ferreterias', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UiLoaderComponent],
  templateUrl: './ferreterias.component.html', styleUrl: './ferreterias.component.scss'
})
export class FerreteriasComponent implements OnInit, OnDestroy {
  protected readonly storeAccessWhatsappUrl = STORE_ACCESS_WHATSAPP_URL;
  protected readonly stars = [1, 2, 3, 4, 5];
  protected storeId = '';
  protected directory: StoreDirectoryPage | null = null;
  protected detail: StoreReviewPage | null = null;
  protected loading = true;
  protected error = '';
  protected region = '';
  protected commune = '';
  protected query = '';
  protected page = 1;
  protected reviewPage = 1;
  protected rating = 0;
  protected comment = '';
  protected ownReview: StoreReview | null = null;
  protected ownReviewLoading = false;
  protected ownReviewLoaded = false;
  protected savingReview = false;
  protected reviewError = '';
  protected reviewNotice = '';
  private readonly platformId = inject(PLATFORM_ID);
  private requestId = 0;
  private routeSubscription?: Subscription;
  constructor(private readonly route: ActivatedRoute, private readonly api: StoreDirectoryService,
    private readonly auth: AuthService, private readonly changeDetector: ChangeDetectorRef) {}

  protected get user() { return this.auth.currentUser(); }
  protected get canReview(): boolean { return this.user?.role === 'maestro'; }
  protected get returnUrl(): string { return `/ferreterias/${encodeURIComponent(this.storeId)}`; }
  protected storeLocation(store: DirectoryStore): string { return [store.commune, store.region].filter(Boolean).join(', '); }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.storeId = params.get('storeId') || '';
      this.reviewPage = 1; this.page = 1;
      this.ownReview = null; this.ownReviewLoaded = false; this.rating = 0; this.comment = ''; this.reviewError = ''; this.reviewNotice = '';
      void this.load();
    });
  }

  protected async load(): Promise<void> {
    const request = ++this.requestId;
    this.loading = true; this.error = '';
    try {
      if (this.storeId) {
        const result = await this.api.detail(this.storeId, this.reviewPage);
        if (request !== this.requestId) return;
        this.detail = result; this.reviewPage = result.page;
        if (this.canReview && !this.ownReviewLoaded) void this.loadOwnReview();
      } else {
        const result = await this.api.list(this.page, this.region, this.commune, this.query.trim());
        if (request !== this.requestId) return;
        this.directory = result; this.page = result.page;
      }
    } catch {
      if (request === this.requestId) this.error = this.storeId ? 'No pudimos cargar esta ferretería. Intenta nuevamente.' : 'No pudimos cargar las ferreterías. Intenta nuevamente.';
    } finally {
      if (request === this.requestId) { this.loading = false; this.changeDetector.markForCheck(); }
    }
  }

  protected filterChanged(resetCommune = false): void {
    if (resetCommune) this.commune = '';
    this.page = 1; void this.load();
  }
  protected changePage(page: number): void { this.page = page; void this.load(); }
  protected changeReviewPage(page: number): void { this.reviewPage = page; void this.load(); }

  protected async loadOwnReview(): Promise<void> {
    const id = this.storeId;
    this.ownReviewLoading = true; this.reviewError = '';
    try {
      const review = await this.api.myReview(id);
      if (id !== this.storeId) return;
      this.ownReview = review; this.rating = review?.rating || 0; this.comment = review?.comment || ''; this.ownReviewLoaded = true;
    } catch {
      if (id === this.storeId) this.reviewError = 'No pudimos cargar tu reseña. Reintenta antes de publicar.';
    } finally {
      if (id === this.storeId) { this.ownReviewLoading = false; this.changeDetector.markForCheck(); }
    }
  }

  protected async saveReview(): Promise<void> {
    if (!this.canReview || !this.ownReviewLoaded || this.savingReview || !this.rating || this.comment.trim().length < 5) return;
    const id = this.storeId;
    this.savingReview = true; this.reviewError = ''; this.reviewNotice = '';
    try {
      const review = await this.api.saveReview(id, this.rating, this.comment.trim());
      if (id !== this.storeId) return;
      this.ownReview = review; this.reviewNotice = 'Tu reseña quedó publicada.';
      this.reviewPage = 1; await this.load();
    } catch {
      if (id === this.storeId) this.reviewError = 'No se pudo guardar tu reseña. Intenta nuevamente.';
    } finally { this.savingReview = false; this.changeDetector.markForCheck(); }
  }

  protected async deleteReview(): Promise<void> {
    if (!this.ownReview || this.savingReview) return;
    const id = this.storeId;
    this.savingReview = true; this.reviewError = ''; this.reviewNotice = '';
    try {
      await this.api.deleteReview(id);
      if (id !== this.storeId) return;
      this.ownReview = null; this.rating = 0; this.comment = ''; this.reviewNotice = 'Tu reseña fue eliminada.';
      await this.load();
    } catch { if (id === this.storeId) this.reviewError = 'No se pudo eliminar tu reseña. Intenta nuevamente.'; }
    finally { this.savingReview = false; this.changeDetector.markForCheck(); }
  }
  ngOnDestroy(): void { this.requestId++; this.routeSubscription?.unsubscribe(); }
}
