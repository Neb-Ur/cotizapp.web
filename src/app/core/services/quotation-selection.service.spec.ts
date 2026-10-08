import { QuotationSelectionService } from './quotation-selection.service';
it('keeps the selected quotation between product pages and isolates accounts',()=>{
 localStorage.clear();const service=new QuotationSelectionService();service.select('owner','project');
 expect(new QuotationSelectionService().read('owner')).toBe('project');expect(service.read('other')).toBe('');
 service.select('owner','');expect(new QuotationSelectionService().read('owner')).toBe('');localStorage.clear();
});
