import { prepareCatalogIndex, SearchIndexSnapshot } from './catalog-search-index.util';
const snapshot:SearchIndexSnapshot={schema:1,version:'test',categories:[{id:'c',name:'Maderas y tableros'}],
 subcategories:[{id:'s',name:'Tableros',categoryId:'c'}],families:[{id:'f',name:'Tableros MDF',subcategoryId:'s'}],products:[
 {id:'1',name:'Tablero MDF 18 mm negro',brand:'Árauco',type:'MDF',categoryId:'c',subcategoryId:'s',familyId:'f'},
 {id:'2',name:'Tablero MDF rojo',brand:'Por especificar',type:'MDF',categoryId:'c',subcategoryId:'s',familyId:'f'}]};
describe('local catalog search',()=>{
 const search=prepareCatalogIndex(snapshot);
 it('matches words in any order, accents and joined units',()=>{
  expect(search('negro mdf 18mm')[0].items[0].id).toBe('1');
  expect(search('arauco')[0].items[0].id).toBe('1');
 });
 it('returns classifications and real related brands without inventing placeholder brands',()=>{
  const groups=search('mdf');
  expect(groups.map(group=>group.kind)).toEqual(['product','family','brand']);
  expect(groups.find(group=>group.kind==='brand')?.items.map(item=>item.name)).toEqual(['Árauco']);
  expect(groups.find(group=>group.kind==='family')?.items[0].queryParams).toEqual({categoria:'c',subcategoria:'s',familia:'f'});
 });
 it('finds products through their classification and does not return products for conflicting colors',()=>{
  expect(search('maderas')[0].items).toHaveLength(2);
  expect(search('negro rojo')).toEqual([]);
  expect(search('m')).toEqual([]);
 });
});

it('groups variants by stable brand identity and opens an ID-based brand filter',()=>{
 const search=prepareCatalogIndex({...snapshot,brands:[{id:'b1',name:'Arauco'}],products:snapshot.products.map(p=>({...p,brand:'ARAUCO',brandId:'b1'}))});
 const brand=search('mdf').find(g=>g.kind==='brand')!.items;
 expect(brand).toHaveLength(1);expect(brand[0].count).toBe(2);
 expect(brand[0].queryParams).toEqual({marca:'Arauco',marcaId:'b1'});
});
