import { Injectable } from '@angular/core';
import { ProjectItem, ProjectSummary } from '../models/app.models';

export type GuestQuotation = ProjectSummary;
const STORAGE_KEY = 'trovio-guest-quotations:v1';
@Injectable({ providedIn: 'root' })
export class GuestQuotationService {
  private quotes: GuestQuotation[] = [];
  private restored = false;
  storageWarning = '';
  all(): GuestQuotation[] { this.restore(); return structuredClone(this.quotes); }
  get(id: string): GuestQuotation | null { return this.all().find(quote => quote.id === id) || null; }
  create(name: string, address = '', items: ProjectItem[] = []): GuestQuotation {
    const quote: GuestQuotation = { id: crypto.randomUUID(), name: name.trim() || 'Mi cotización', address, items: this.normalizeItems(items), createdAt: new Date().toISOString(), totalOptimal: 0, saving: 0 };
    this.restore(); this.quotes.unshift(quote); this.persist(); return structuredClone(quote);
  }
  update(id: string, changes: Partial<Omit<GuestQuotation, 'id' | 'createdAt'>>): GuestQuotation {
    this.restore(); const quote = this.quotes.find(quote => quote.id === id);
    if (!quote) throw new Error('No encontramos esta cotización en tu navegador.');
    const normalized = structuredClone(changes);
    if (normalized.items) normalized.items = this.normalizeItems(normalized.items, quote.items);
    Object.assign(quote, normalized); this.persist(); return structuredClone(quote);
  }
  add(id: string, item: ProjectItem): GuestQuotation {
    const quote = this.get(id); if (!quote) throw new Error('Selecciona o crea una cotización.');
    const existing = quote.items.find(row => row.productName === item.productName && row.storeId === item.storeId && row.productoFerreteriaId === item.productoFerreteriaId);
    if (existing) existing.quantity += item.quantity; else quote.items.push(structuredClone(item));
    return this.update(id, { items: quote.items });
  }
  remove(id: string): void { this.restore(); this.quotes = this.quotes.filter(quote => quote.id !== id); this.persist(); }
  private normalizeItems(items: ProjectItem[], previous: ProjectItem[] = []): ProjectItem[] {
    return items.filter(item => typeof item.productName === 'string' && item.productName.trim()).map(item => {
      const old = previous.find(row => row.productName === item.productName && row.storeId === item.storeId && row.productoFerreteriaId === item.productoFerreteriaId);
      return { ...structuredClone(item), quantity: Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : old?.quantity || 1 };
    });
  }
  private restore(): void {
    if (this.restored || typeof window === 'undefined') return;
    this.restored = true;
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(value)) this.quotes = value.filter(quote => quote && typeof quote.id === 'string' && typeof quote.name === 'string' && Array.isArray(quote.items)
        && quote.items.every((item: ProjectItem) => typeof item.productName === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0));
    } catch { /* A missing local draft must not block the catalog. */ }
  }
  private persist(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.quotes)); this.storageWarning = ''; }
    catch { this.storageWarning = 'Tu navegador no permite conservar la cotización al cerrar la página.'; }
  }
}
