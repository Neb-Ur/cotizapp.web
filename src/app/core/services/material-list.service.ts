import { afterNextRender, Injectable, signal } from '@angular/core';
import { ProjectItem } from '../models/app.models';

export interface MaterialListItem extends ProjectItem { unitPrice: number; }
const STORAGE_KEY = 'trovio-material-list:v1';

@Injectable({ providedIn: 'root' })
export class MaterialListService {
  readonly items = signal<MaterialListItem[]>([]);
  readonly storageWarning = signal('');
  readonly ready = signal(false);
  constructor() { afterNextRender(() => this.restore()); }

  restore(): void {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(value)) return;
      this.items.set(value.filter(item => item && typeof item.productName === 'string'
        && item.productName.trim() && Number.isSafeInteger(item.quantity) && item.quantity > 0
        && Number.isFinite(item.unitPrice) && item.unitPrice >= 0
        && ['storeId', 'storeName', 'productoMaestroId', 'productoFerreteriaId'].every(key => item[key] === undefined || typeof item[key] === 'string'))
        .slice(0, 100).map(item => ({ productName: item.productName, quantity: item.quantity, unitPrice: item.unitPrice,
          storeId: item.storeId, storeName: item.storeName, productoMaestroId: item.productoMaestroId, productoFerreteriaId: item.productoFerreteriaId })));
    } catch { /* An unavailable or invalid local draft must not block the catalog. */ }
    finally { this.ready.set(true); }
  }
  add(item: MaterialListItem): void {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0) return;
    const items = this.items().map(row => ({ ...row }));
    const existing = items.find(row => row.productName === item.productName && row.storeId === item.storeId && row.productoFerreteriaId === item.productoFerreteriaId);
    if (existing) { existing.quantity += item.quantity; existing.unitPrice = item.unitPrice; }
    else items.push({ ...item });
    this.commit(items);
  }
  quantity(index: number, value: unknown): void {
    const quantity = Math.floor(Number(value));
    if (!Number.isSafeInteger(quantity) || quantity < 1) return;
    this.commit(this.items().map((item, i) => i === index ? { ...item, quantity } : item));
  }
  remove(index: number): void { this.commit(this.items().filter((_, i) => i !== index)); }
  fingerprint(): string { return JSON.stringify(this.items()); }
  clearIfUnchanged(fingerprint: string): void { if (this.fingerprint() === fingerprint) this.commit([]); }
  private commit(items: MaterialListItem[]): void {
    this.items.set(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); this.storageWarning.set(''); }
    catch { this.storageWarning.set('Tu navegador no permite guardar la lista. Se conservará mientras mantengas esta página abierta.'); }
  }
}
