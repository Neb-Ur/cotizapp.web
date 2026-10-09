import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiClientService } from '../../../core/services/api-client.service';

export interface UploadedProductImage {
  storageImageUrl: string;
  storageImagePath: string;
  thumbnailImageUrl: string;
  thumbnailImagePath: string;
}

@Component({
  selector: 'app-product-image-upload', standalone: true,
  template: `
    <section class="image-upload" aria-label="Subir imagen de producto">
      @if (enabled()) {
        <label>Subir imagen desde tu equipo
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" [disabled]="disabled || busy()" (change)="selectFile($event)" />
        </label>
        <p>JPG, PNG, WebP o AVIF · máximo 8 MB. Se optimiza para tarjetas y detalle.</p>
      } @else {
        <p>{{ statusMessage() }}</p>
      }
      @if (busy()) { <p role="status" class="status">Subiendo y optimizando imagen…</p> }
      @if (message()) { <p role="status" class="status">{{ message() }}</p> }
      @if (error()) { <p role="alert" class="error">{{ error() }}</p> }
    </section>`,
  styles: `
    :host { display: block; }
    .image-upload { padding: 1rem; border: 1px dashed var(--border-med); border-radius: var(--r-md); background: var(--ink-50); }
    label { display: grid; gap: .6rem; color: var(--navy-900); font-weight: 700; }
    input { max-width: 100%; font: inherit; font-size: .85rem; }
    input::file-selector-button { padding: .6rem .8rem; margin-right: .7rem; border: 1px solid var(--border-med); border-radius: var(--r-sm); background: white; color: var(--navy-900); cursor: pointer; }
    p { margin: .5rem 0 0; color: var(--ink-500); font-size: .8rem; }
    .status { color: var(--navy-900); } .error { color: var(--red); }
  `
})
export class ProductImageUploadComponent implements OnInit {
  @Input() disabled = false;
  @Output() uploaded = new EventEmitter<UploadedProductImage>();
  @Output() busyChange = new EventEmitter<boolean>();
  protected readonly enabled = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly statusMessage = signal('Comprobando carga de imágenes…');
  constructor(private readonly api: ApiClientService) {}

  async ngOnInit(): Promise<void> {
    try {
      const config = await this.api.get<{ imageStorage?: { enabled: boolean } }>('/config');
      this.enabled.set(config.imageStorage?.enabled === true);
      this.statusMessage.set('La carga de imágenes aún no está habilitada. Puedes seguir usando una URL.');
    } catch { this.statusMessage.set('No pudimos comprobar la carga de imágenes. Puedes seguir usando una URL.'); }
  }

  protected async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement, file = input.files?.[0];
    if (!file || this.disabled || this.busy() || !this.enabled()) return;
    this.error.set(''); this.message.set('');
    if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      this.error.set('Selecciona una imagen JPG, PNG, WebP o AVIF de hasta 8 MB.'); input.value = ''; return;
    }
    this.busy.set(true); this.busyChange.emit(true);
    try {
      this.uploaded.emit(await this.api.uploadImage<UploadedProductImage>('/admin/imagenes/productos', file));
      this.message.set('Imagen subida. Guarda el producto para aplicar el cambio.');
    } catch (error) {
      this.error.set(error instanceof HttpErrorResponse ? error.error?.error?.message || 'No se pudo subir la imagen. Intenta nuevamente.' : 'No se pudo subir la imagen. Intenta nuevamente.');
    } finally { this.busy.set(false); this.busyChange.emit(false); input.value = ''; }
  }
}
