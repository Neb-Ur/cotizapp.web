import { Directive, HostBinding, HostListener, Input, OnChanges } from '@angular/core';

export const PRODUCT_IMAGE_PLACEHOLDER = 'assets/product-image-unavailable.svg';
function imageUrl(value: string | null | undefined): string {
  const url = String(value || '').trim();
  if (/^\/?assets\/[a-z0-9/_\-.]+$/i.test(url)) return url;
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; }
  catch { return ''; }
}

/** Browser-only loads: preferred Storage URL, external URL, then local placeholder. */
@Directive({ selector: 'img[findiProductImage]', standalone: true })
export class ProductImageDirective implements OnChanges {
  @Input() findiProductImage: string | null | undefined;
  @Input() fullImageUrl: string | null | undefined;
  @Input() externalImageUrl: string | null | undefined;
  @HostBinding('attr.src') src: string | null = PRODUCT_IMAGE_PLACEHOLDER;
  @HostBinding('attr.referrerpolicy') readonly referrerPolicy = 'no-referrer';
  @HostBinding('attr.data-image-placeholder') placeholder = true;
  private candidates: string[] = [];
  private position = 0;

  ngOnChanges(): void {
    this.candidates = [...new Set([imageUrl(this.findiProductImage), imageUrl(this.fullImageUrl), imageUrl(this.externalImageUrl), PRODUCT_IMAGE_PLACEHOLDER].filter(Boolean))];
    this.position = 0;
    this.showCandidate();
  }
  @HostListener('error') nextImage(): void {
    if (this.position < this.candidates.length - 1) { this.position++; this.showCandidate(); }
    else this.src = null; // Never loop if even the local asset is unavailable.
  }
  private showCandidate(): void {
    this.src = this.candidates[this.position] || PRODUCT_IMAGE_PLACEHOLDER;
    this.placeholder = this.src === PRODUCT_IMAGE_PLACEHOLDER;
  }
}
