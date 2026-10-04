import { describe, expect, it } from 'vitest';
import { findExactMasterMatch } from './catalog-match.util';
const products = [{ id: '25', name: 'Cemento gris 25 kg', barcode: '780001' }, { id: '42', name: 'Cemento gris 42 kg', barcode: '780002' }];
describe('safe catalog matching', () => {
 it('does not publish fuzzy or ambiguous name matches', () => {
  expect(findExactMasterMatch(products, 'Cemento gris')).toBeUndefined();
  expect(findExactMasterMatch([...products, {id:'duplicate',name:products[0].name}], products[0].name)).toBeUndefined();
 });
 it('matches a unique normalized exact name or barcode', () => {
  expect(findExactMasterMatch(products, '  CEMENTO   gris 25 kg ')).toBe(products[0]);
  expect(findExactMasterMatch(products, 'Nombre del proveedor', '780-002')).toBe(products[1]);
 });
 it('rejects conflicting and duplicate barcodes', () => {
  expect(findExactMasterMatch(products, products[0].name, 'unknown')).toBeUndefined();
  expect(findExactMasterMatch([...products, {...products[0],id:'duplicate'}], products[0].name, '780001')).toBeUndefined();
 });
});
