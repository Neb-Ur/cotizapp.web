import { Injectable } from '@angular/core';
@Injectable({providedIn:'root'})
export class QuotationSelectionService {
  private readonly selected = new Map<string,string>();
  read(ownerId: string): string {
    try { return this.selected.get(ownerId) || (typeof localStorage !== 'undefined' ? localStorage.getItem(`findi-selected-quotation:${ownerId}`) : '') || ''; }
    catch { return this.selected.get(ownerId) || ''; }
  }
  select(ownerId: string, projectId: string): void {
    this.selected.set(ownerId,projectId);
    try { if(typeof localStorage !== 'undefined') {
      if(projectId) localStorage.setItem(`findi-selected-quotation:${ownerId}`,projectId);
      else localStorage.removeItem(`findi-selected-quotation:${ownerId}`);
    } } catch { /* Keep this essential workflow preference in memory. */ }
  }
}
