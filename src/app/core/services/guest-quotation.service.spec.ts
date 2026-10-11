import { GuestQuotationService } from './guest-quotation.service';
describe('guest quotations in the browser', () => {
  beforeEach(() => localStorage.clear());
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
  it('does not expose a mutable reference and ignores corrupt stored quotations', () => {
    localStorage.setItem('trovio-guest-quotations:v1', JSON.stringify([{ id: 'bad', name: 'Bad', items: [{ quantity: -1 }] }]));
    const service = new GuestQuotationService(); expect(service.all()).toEqual([]);
    const quote = service.create('Obra'); quote.name = 'Modified'; expect(service.get(quote.id)?.name).toBe('Obra');
  });
});
