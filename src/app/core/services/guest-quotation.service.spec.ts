import { GuestQuotationService } from './guest-quotation.service';
describe('guest quotations in the browser', () => {
  beforeEach(() => localStorage.clear());
  it('creates several quotations and restores their identities and offer quantities after authentication or reload', () => {
    const service = new GuestQuotationService(); const first = service.create('Cocina'); const second = service.create('Baño');
    service.add(first.id, { productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o' });
    const restored = new GuestQuotationService(); expect(restored.all()).toHaveLength(2);
    expect(restored.get(first.id)?.items[0]).toEqual({ productName: 'Cemento', quantity: 3, storeId: 's', productoMaestroId: 'p', productoFerreteriaId: 'o' });
    restored.remove(first.id); expect(new GuestQuotationService().get(first.id)).toBeNull(); expect(restored.get(second.id)?.name).toBe('Baño');
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
