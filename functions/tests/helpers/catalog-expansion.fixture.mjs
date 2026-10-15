import {readFile} from 'node:fs/promises';
import {planInitialVehicleCatalog} from '../../scripts/lib/initial-vehicle-catalog.mjs';
import {buildKuv100CatalogSeed} from '../../scripts/lib/kuv100-catalog-seed.mjs';
export async function expansionFixture(now) {
  const load = async name => JSON.parse(await readFile(new URL('../../../docs/catalogo/' + name, import.meta.url), 'utf8'));
  const seed = await load('semilla-expansion-200.json');
  const inventory = await load('inventario-propuesto.json');
  const refs = planInitialVehicleCatalog({brands: [{name: 'Mahindra', models: ['KUV100']}, {name: 'Hyundai', models: ['Accent']}, {name: 'Kia', models: ['Rio']}]}, [], [], now);
  const brands = refs.creates.filter(d => d.collection === 'marcas').map(d => ({id: d.id, ...d.data}));
  const models = refs.creates.filter(d => d.collection === 'modelosVehiculo').map(d => ({id: d.id, ...d.data}));
  const kuv = buildKuv100CatalogSeed(await load('semilla-kuv100-ampliada.json'), brands, models, now);
  const automotiveSubcategories = [{id: 'sub-repuestos-motor-y-electricidad', nombre: 'Motor y electricidad', categoriaId: 'cat-repuestos-automotrices'}, {id: 'sub-repuestos-frenos-y-suspension', nombre: 'Frenos y suspensión', categoriaId: 'cat-repuestos-automotrices'}, ...kuv.filter(d => d.collection === 'subcategorias').map(d => ({id: d.id, ...d.data}))];
  const stores = ['seed-kuv-store-norte', 'seed-kuv-store-central', 'seed-kuv-store-sur', 'pilot-store-1', 'pilot-store-2', 'pilot-store-3', 'pilot-store-4'].map(id => ({id, usuarioDuenoId: 'owner-' + id, nombreComercial: id + ' (Prueba)', tipoNegocio: id.startsWith('pilot-') ? 'ferreteria' : 'desarmaduria', estado: 'activo', esPrueba: true, contratoEstado: 'pendiente'}));
  const users = stores.map(s => ({id: s.usuarioDuenoId, rol: 'ferreteria', nombre: s.nombreComercial, correo: s.id + '@example.invalid', esPrueba: true, estadoCuenta: 'activo'}));
  const families = [...inventory.families.map(f => ({id: f.id, nombre: f.name, subcategoriaId: f.parentId, permiteVehiculos: false})), ...kuv.filter(d => d.collection === 'familias').map(d => ({id: d.id, ...d.data}))];
  return {seed, state: {brands, models, families, subcategories: [...inventory.subcategories.map(s => ({id: s.id, nombre: s.name, categoriaId: s.parentId})), ...automotiveSubcategories], stores, users, products: []}, categories: [...inventory.categories.map(c => ({id: c.id, nombre: c.name})), {id: 'cat-repuestos-automotrices', nombre: 'Repuestos automotrices'}]};
}
