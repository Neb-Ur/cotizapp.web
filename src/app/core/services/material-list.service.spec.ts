import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MaterialListService } from './material-list.service';
const item = { productName: 'Cemento', productoMaestroId: 'p', storeId: 's', storeName: 'Local', productoFerreteriaId: 'o', quantity: 2, unitPrice: 5000 };
describe('material list persistence', () => {
  beforeEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });
  it('restores quantities and offer identity after registration or a reload', () => {
    const list = TestBed.inject(MaterialListService); list.add(item); list.add({ ...item, quantity: 1 });
    list.add({ ...item, storeId: 'other', productoFerreteriaId: 'other-offer' });
    list.items.set([]); list.restore();
    expect(list.items()).toEqual([{ ...item, quantity: 3 }, { ...item, storeId: 'other', productoFerreteriaId: 'other-offer' }]);
    list.quantity(0, 4); list.remove(1); list.restore(); expect(list.items()).toEqual([{ ...item, quantity: 4 }]);
  });
  it('retains concurrent edits and clears only the list successfully saved', () => {
    const list = TestBed.inject(MaterialListService); list.add(item); const imported = list.fingerprint();
    list.quantity(0, 3); list.clearIfUnchanged(imported); expect(list.items()).toHaveLength(1);
    list.clearIfUnchanged(list.fingerprint()); list.restore(); expect(list.items()).toEqual([]);
  });
  it('rejects corrupted stored quantities and keeps a working list when storage is unavailable', () => {
    const list = TestBed.inject(MaterialListService);
    localStorage.setItem('trovio-material-list:v1', JSON.stringify([{ ...item, quantity: -1 }, { ...item, storeId: {} }, item]));
    list.restore(); expect(list.items()).toEqual([item]);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    list.add(item); expect(list.items()[0].quantity).toBe(4); expect(list.storageWarning()).toContain('navegador'); spy.mockRestore();
  });
});
