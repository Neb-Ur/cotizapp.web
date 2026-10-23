import { GuestQuotationService } from './guest-quotation.service';
describe('guest quotations in the browser', () => {
  beforeEach(() => localStorage.clear());
  it('retains products added in another tab before adding a new product', () => {
    const first = new GuestQuotationService();
    const quote = first.create('Obra');
    const other = new GuestQuotationService(); other.all();
    first.add(quote.id, {productName: 'Cemento', quantity: 2, storeId: 'north'});
    other.add(quote.id, {productName: 'Clavos', quantity: 1, storeId: 'south'});
    expect(first.get(quote.id)?.items.map(item => item.productName)).toEqual(['Cemento', 'Clavos']);
  });
  it('does not restore a quotation deleted in another tab or overwrite its replacement', () => {
    const first = new GuestQuotationService(); const quote = first.create('Obra');
    const other = new GuestQuotationService(); other.all();
    first.remove(quote.id);
    expect(() => other.update(quote.id, {name: 'Obra antigua'})).toThrow('No encontramos');
    const replacement = first.create('Obra nueva');
    other.remove(quote.id);
    expect(first.get(replacement.id)?.name).toBe('Obra nueva');
  });
  it('allows one guest quotation, restores it and permits replacement only after deletion', () => {
    const service = new GuestQuotationService(); const first = service.create('Cocina');
    service.add(first.id, { productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o' });
    const restored = new GuestQuotationService(); expect(restored.all()).toHaveLength(1);
    expect(restored.get(first.id)?.items[0]).toEqual({ productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o' });
    expect(() => restored.create('Baño')).toThrow('una cotización'); expect(restored.canCreate()).toBe(false);
    restored.remove(first.id); expect(new GuestQuotationService().get(first.id)).toBeNull();
    expect(restored.create('Baño').name).toBe('Baño');
  });
  it('checks browser storage before creation even when another tab had an empty cached list', () => {
    const first = new GuestQuotationService(); const other = new GuestQuotationService(); other.all();
    first.create('Cocina'); expect(() => other.create('Baño')).toThrow('una cotización');
    expect(other.all()).toHaveLength(1);
  });
  it('preserves quotations created before the limit and blocks additional creation', () => {
    localStorage.setItem('trovio-guest-quotations:v1', JSON.stringify([{id:'old-1',name:'Obra 1',items:[]},{id:'old-2',name:'Obra 2',items:[]}]));
    const service = new GuestQuotationService(); expect(service.all()).toHaveLength(2); expect(() => service.create('Obra 3')).toThrow('una cotización');
    expect(service.all()).toHaveLength(2);
  });
  it('keeps a recoverable quotation while a quantity field is temporarily cleared', () => {
    const service = new GuestQuotationService(); const quote = service.create('Obra', '', [{ productName: 'Cemento', quantity: 3 }]);
    service.update(quote.id, { items: [{ productName: 'Cemento', quantity: 0 }] });
    expect(new GuestQuotationService().get(quote.id)?.items[0].quantity).toBe(3);
  });
  it('keeps unsaved edits in memory when storage is readable but full', () => {
    const service = new GuestQuotationService(); const quote = service.create('Obra');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    try {
      service.add(quote.id, { productName: 'Cemento', quantity: 2 });
      expect(service.storageWarning).not.toBe('');
      expect(service.get(quote.id)?.items).toEqual([{ productName: 'Cemento', quantity: 2 }]);
      service.add(quote.id, { productName: 'Clavos', quantity: 1 });
      expect(service.get(quote.id)?.items.map(item => item.productName)).toEqual(['Cemento', 'Clavos']);
    } finally { write.mockRestore(); }
    service.update(quote.id, { name: 'Obra recuperada' });
    expect(service.storageWarning).toBe('');
    expect(new GuestQuotationService().get(quote.id)?.items).toHaveLength(2);
  });
  it('does not restore a quotation after its deletion fails to persist', () => {
    const service = new GuestQuotationService(); const quote = service.create('Obra');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    try {
      service.remove(quote.id);
      expect(service.all()).toEqual([]);
      expect(service.canCreate()).toBe(true);
    } finally { write.mockRestore(); }
  });
  it('still observes another tab replacing a quotation after a failed write', () => {
    const service = new GuestQuotationService(); const quote = service.create('Obra');
    const other = new GuestQuotationService(); other.all();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    try { service.update(quote.id, { name: 'Cambio no guardado' }); }
    finally { write.mockRestore(); }
    other.remove(quote.id);
    const replacement = other.create('Otra obra');
    expect(service.get(quote.id)).toBeNull();
    expect(service.get(replacement.id)?.name).toBe('Otra obra');
  });
  it('does not expose a mutable reference and ignores corrupt stored quotations', () => {
    localStorage.setItem('trovio-guest-quotations:v1', JSON.stringify([{ id: 'bad', name: 'Bad', items: [{ quantity: -1 }] }]));
    const service = new GuestQuotationService(); expect(service.all()).toEqual([]);
    const quote = service.create('Obra'); quote.name = 'Modified'; expect(service.get(quote.id)?.name).toBe('Obra');
  });
  it('restores valid quotations even when another stored quotation contains a null item', () => {
    localStorage.setItem('trovio-guest-quotations:v1', JSON.stringify([
      { id: 'valid', name: 'Obra', items: [{ productName: 'Cemento', quantity: 2 }] },
      { id: 'invalid', name: 'Corrupta', items: [null] }
    ]));
    expect(new GuestQuotationService().all().map(quote => quote.id)).toEqual(['valid']);
  });
});
