import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'cotizapp-d71c8';
const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const seedTag = 'pilot-catalog-auth-v2-2026-09-30';
const createdAt = '2026-09-30T10:40:00.000Z';
const updatedAt = new Date().toISOString();

const categories = [
  { id: 'cat-obra-gruesa', nombre: 'Obra gruesa' },
  { id: 'cat-maderas-tableros', nombre: 'Maderas y tableros' },
  { id: 'cat-terminaciones', nombre: 'Terminaciones' },
  { id: 'cat-gasfiteria', nombre: 'Gasfitería' },
  { id: 'cat-electricidad', nombre: 'Electricidad' },
  { id: 'cat-fijaciones-sellantes', nombre: 'Fijaciones y sellantes' }
];

const subcategories = [
  { id: 'sub-cementos-morteros', categoriaId: 'cat-obra-gruesa', nombre: 'Cementos y morteros' },
  { id: 'sub-aridos', categoriaId: 'cat-obra-gruesa', nombre: 'Áridos' },
  { id: 'sub-tableros', categoriaId: 'cat-maderas-tableros', nombre: 'Tableros' },
  { id: 'sub-madera-dimensionada', categoriaId: 'cat-maderas-tableros', nombre: 'Madera dimensionada' },
  { id: 'sub-yeso-carton', categoriaId: 'cat-terminaciones', nombre: 'Yeso-cartón' },
  { id: 'sub-pinturas', categoriaId: 'cat-terminaciones', nombre: 'Pinturas' },
  { id: 'sub-pvc', categoriaId: 'cat-gasfiteria', nombre: 'PVC sanitario' },
  { id: 'sub-cables-mecanismos', categoriaId: 'cat-electricidad', nombre: 'Cables y mecanismos' },
  { id: 'sub-tornillos-tarugos', categoriaId: 'cat-fijaciones-sellantes', nombre: 'Tornillos y tarugos' },
  { id: 'sub-sellantes', categoriaId: 'cat-fijaciones-sellantes', nombre: 'Sellantes' }
];

const families = [
  { id: 'fam-cemento', subcategoriaId: 'sub-cementos-morteros', nombre: 'Cemento' },
  { id: 'fam-mortero', subcategoriaId: 'sub-cementos-morteros', nombre: 'Morteros preparados' },
  { id: 'fam-aridos', subcategoriaId: 'sub-aridos', nombre: 'Áridos ensacados' },
  { id: 'fam-tableros', subcategoriaId: 'sub-tableros', nombre: 'Tableros estructurales' },
  { id: 'fam-madera', subcategoriaId: 'sub-madera-dimensionada', nombre: 'Madera dimensionada' },
  { id: 'fam-yeso-carton', subcategoriaId: 'sub-yeso-carton', nombre: 'Planchas yeso-cartón' },
  { id: 'fam-pinturas', subcategoriaId: 'sub-pinturas', nombre: 'Pinturas y esmaltes' },
  { id: 'fam-pvc', subcategoriaId: 'sub-pvc', nombre: 'Tuberías y adhesivos PVC' },
  { id: 'fam-electricos', subcategoriaId: 'sub-cables-mecanismos', nombre: 'Material eléctrico' },
  { id: 'fam-fijaciones', subcategoriaId: 'sub-tornillos-tarugos', nombre: 'Fijaciones' },
  { id: 'fam-sellantes', subcategoriaId: 'sub-sellantes', nombre: 'Sellantes' }
];

const products = [
  { id: 'prod-cemento-gris-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-cemento', nombre: 'Cemento gris 25 kg', basePrice: 4990, stock: 120 },
  { id: 'prod-mortero-pega-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-mortero', nombre: 'Mortero pega albañilería 25 kg', basePrice: 5890, stock: 90 },
  { id: 'prod-hormigon-preparado-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-mortero', nombre: 'Hormigón preparado 25 kg', basePrice: 6490, stock: 75 },
  { id: 'prod-yeso-polvo-25kg', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-yeso-carton', familiaId: 'fam-yeso-carton', nombre: 'Yeso en polvo 25 kg', basePrice: 7490, stock: 55 },
  { id: 'prod-arena-gruesa-40kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-aridos', familiaId: 'fam-aridos', nombre: 'Arena gruesa saco 40 kg', basePrice: 3290, stock: 80 },
  { id: 'prod-gravilla-40kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-aridos', familiaId: 'fam-aridos', nombre: 'Gravilla saco 40 kg', basePrice: 3490, stock: 70 },
  { id: 'prod-yesocarton-st-10mm', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-yeso-carton', familiaId: 'fam-yeso-carton', nombre: 'Plancha yeso-cartón ST 10 mm 1,20 x 2,40 m', basePrice: 8990, stock: 65 },
  { id: 'prod-osb-95mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Plancha OSB 9,5 mm 1,22 x 2,44 m', basePrice: 15990, stock: 45 },
  { id: 'prod-terciado-15mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Terciado estructural 15 mm 1,22 x 2,44 m', basePrice: 24990, stock: 35 },
  { id: 'prod-pino-2x4-320', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-madera-dimensionada', familiaId: 'fam-madera', nombre: 'Pino dimensionado 2x4" 3,20 m', basePrice: 5490, stock: 100 },
  { id: 'prod-latex-blanco-galon', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Pintura látex interior blanca 1 galón', basePrice: 18990, stock: 30 },
  { id: 'prod-esmalte-agua-galon', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Esmalte al agua blanco 1 galón', basePrice: 27990, stock: 24 },
  { id: 'prod-pvc-110x6', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Tubería PVC sanitario 110 mm x 6 m', basePrice: 11990, stock: 40 },
  { id: 'prod-pvc-50x6', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Tubería PVC sanitario 50 mm x 6 m', basePrice: 6490, stock: 50 },
  { id: 'prod-adhesivo-pvc-240', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Adhesivo PVC 240 cc', basePrice: 5790, stock: 32 },
  { id: 'prod-cable-thhn-25-100', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Cable eléctrico THHN 2,5 mm² 100 m', basePrice: 39990, stock: 18 },
  { id: 'prod-interruptor-simple-10a', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Interruptor simple 10 A', basePrice: 3490, stock: 60 },
  { id: 'prod-tornillo-yesocarton-1', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Tornillo yeso-cartón punta fina 1" caja 100', basePrice: 3990, stock: 85 },
  { id: 'prod-tarugo-nylon-8mm', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Tarugo nylon 8 mm bolsa 50', basePrice: 2990, stock: 70 },
  { id: 'prod-silicona-transparente-300', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Silicona sellante transparente 300 ml', basePrice: 4490, stock: 44 }
];

const stores = [
  ['store-piloto-centro', 'Ferretería Demo Santiago Centro', 'Santiago', 'Santiago Centro', -33.4489, -70.6693],
  ['store-piloto-maipu', 'Ferretería Demo Maipú', 'Maipú', 'Maipú', -33.5106, -70.7572],
  ['store-piloto-florida', 'Ferretería Demo La Florida', 'La Florida', 'La Florida', -33.5227, -70.5986],
  ['store-piloto-nunoa', 'Ferretería Demo Ñuñoa', 'Ñuñoa', 'Ñuñoa', -33.4569, -70.5979],
  ['store-piloto-providencia', 'Ferretería Demo Providencia', 'Providencia', 'Providencia', -33.4319, -70.6093],
  ['store-piloto-las-condes', 'Ferretería Demo Las Condes', 'Las Condes', 'Las Condes', -33.4088, -70.5671],
  ['store-piloto-penalolen', 'Ferretería Demo Peñalolén', 'Peñalolén', 'Peñalolén', -33.4862, -70.5334],
  ['store-piloto-puente-alto', 'Ferretería Demo Puente Alto', 'Puente Alto', 'Puente Alto', -33.6117, -70.5758],
  ['store-piloto-san-miguel', 'Ferretería Demo San Miguel', 'San Miguel', 'San Miguel', -33.4977, -70.6518],
  ['store-piloto-la-cisterna', 'Ferretería Demo La Cisterna', 'La Cisterna', 'La Cisterna', -33.5344, -70.6630],
  ['store-piloto-quilicura', 'Ferretería Demo Quilicura', 'Quilicura', 'Quilicura', -33.3667, -70.7333],
  ['store-piloto-huechuraba', 'Ferretería Demo Huechuraba', 'Huechuraba', 'Huechuraba', -33.3742, -70.6360],
  ['store-piloto-recoleta', 'Ferretería Demo Recoleta', 'Recoleta', 'Recoleta', -33.4063, -70.6425],
  ['store-piloto-independencia', 'Ferretería Demo Independencia', 'Independencia', 'Independencia', -33.4167, -70.6333],
  ['store-piloto-pudahuel', 'Ferretería Demo Pudahuel', 'Pudahuel', 'Pudahuel', -33.4378, -70.7606],
  ['store-piloto-cerrillos', 'Ferretería Demo Cerrillos', 'Cerrillos', 'Cerrillos', -33.5028, -70.7167],
  ['store-piloto-estacion-central', 'Ferretería Demo Estación Central', 'Estación Central', 'Estación Central', -33.4592, -70.6996],
  ['store-piloto-macul', 'Ferretería Demo Macul', 'Macul', 'Macul', -33.4869, -70.5996],
  ['store-piloto-la-reina', 'Ferretería Demo La Reina', 'La Reina', 'La Reina', -33.4411, -70.5344],
  ['store-piloto-san-bernardo', 'Ferretería Demo San Bernardo', 'San Bernardo', 'San Bernardo', -33.5922, -70.6996]
].map((row, index) => ({
  id: row[0],
  nombre: row[1],
  comuna: row[2],
  direccion: row[3],
  latitud: row[4],
  longitud: row[5],
  correo: 'ferreteria' + String(index + 1).padStart(2, '0') + '@demo.cl',
  priceFactor: [1.00,0.97,1.04,0.99,1.02,1.06,0.96,0.95,1.01,0.98,1.03,1.05,0.99,1.00,0.97,1.02,1.04,0.98,1.01,0.96][index],
  stockFactor: [1.00,0.85,1.15,1.05,0.95,0.90,1.10,1.20,0.92,1.08,1.12,0.88,1.00,0.94,1.06,1.14,0.98,1.03,0.91,1.18][index]
}));

const storeAuth = [];
for (const store of stores) {
  const firebaseUser = await auth.getUserByEmail(store.correo);
  storeAuth.push({ ...store, uid: firebaseUser.uid });
}
const adminAuthUser = await auth.getUserByEmail('admin@demo.cl');
const maestroAuthUser = await auth.getUserByEmail('maestro@demo.cl');

const batch = db.batch();
const merge = true;

for (const item of categories) {
  batch.set(db.collection('categorias').doc(item.id), { nombre: item.nombre, seedTag }, { merge });
}
for (const item of subcategories) {
  batch.set(db.collection('subcategorias').doc(item.id), { categoriaId: item.categoriaId, nombre: item.nombre, seedTag }, { merge });
}
for (const item of families) {
  batch.set(db.collection('familias').doc(item.id), { subcategoriaId: item.subcategoriaId, nombre: item.nombre, seedTag }, { merge });
}

for (const product of products) {
  batch.set(db.collection('productosMaestro').doc(product.id), {
    categoriaId: product.categoriaId,
    subcategoriaId: product.subcategoriaId,
    familiaId: product.familiaId,
    nombre: product.nombre,
    marca: 'Genérico',
    descripcionCorta: 'Producto de catálogo piloto para pruebas funcionales de CotizApp.',
    descripcionLarga: 'Dato demostrativo. Precio y stock deben reemplazarse por información entregada por la ferretería antes de uso comercial.',
    imagenPrincipalUrl: '',
    galeriaJson: [],
    estado: 'activo',
    creadoEn: createdAt,
    seedTag
  }, { merge });
}

for (const store of storeAuth) {
  batch.set(db.collection('usuarios').doc(store.uid), {
    rol: 'ferreteria',
    nombre: store.nombre,
    correo: store.correo,
    telefono: '+56900000000',
    region: 'Región Metropolitana',
    ciudad: 'Santiago',
    comuna: store.comuna,
    direccion: store.direccion,
    estadoCuenta: 'activo',
    creadoEn: createdAt,
    seedTag
  }, { merge });

  batch.set(db.collection('ferreterias').doc(store.id), {
    usuarioDuenoId: store.uid,
    nombreComercial: store.nombre,
    rut: '',
    latitud: store.latitud,
    longitud: store.longitud,
    estado: 'activo',
    creadoEn: createdAt,
    seedTag
  }, { merge });

  for (let i = 0; i < products.length; i += 1) {
    const product = products[i];
    const priceWave = [1, 1.015, 0.985, 1.03, 0.97][i % 5];
    const price = Math.max(100, Math.round((product.basePrice * store.priceFactor * priceWave) / 10) * 10);
    const stock = Math.max(1, Math.round(product.stock * store.stockFactor) - (i % 7));
    const offerId = 'offer-' + store.id + '-' + product.id;

    batch.set(db.collection('productosFerreteria').doc(offerId), {
      ferreteriaId: store.id,
      productoMaestroId: product.id,
      skuFerreteria: store.id.replace('store-piloto-', '').toUpperCase() + '-' + String(i + 1).padStart(3, '0'),
      codigoBarras: null,
      precio: price,
      stock,
      activo: true,
      publicado: true,
      creadoEn: createdAt,
      actualizadoEn: updatedAt,
      seedTag
    }, { merge });
  }
}

batch.set(db.collection('usuarios').doc(adminAuthUser.uid), {
  rol: 'admin',
  nombre: 'Admin Demo CotizApp',
  correo: 'admin@demo.cl',
  telefono: '+56900000000',
  region: 'Región Metropolitana',
  ciudad: 'Santiago',
  comuna: 'Santiago',
  direccion: 'Santiago',
  estadoCuenta: 'activo',
  creadoEn: createdAt,
  seedTag
}, { merge });

batch.set(db.collection('usuarios').doc(maestroAuthUser.uid), {
  rol: 'maestro',
  nombre: 'Maestro Demo',
  correo: 'maestro@demo.cl',
  telefono: '+56900000000',
  region: 'Región Metropolitana',
  ciudad: 'Santiago',
  comuna: 'Santiago',
  direccion: 'Santiago',
  estadoCuenta: 'activo',
  creadoEn: createdAt,
  seedTag
}, { merge });

for (const staleId of ['user-piloto-centro', 'user-piloto-maipu', 'user-piloto-florida']) {
  batch.delete(db.collection('usuarios').doc(staleId));
}

await batch.commit();

console.log(JSON.stringify({
  ok: true,
  projectId,
  seedTag,
  categories: categories.length,
  subcategories: subcategories.length,
  families: families.length,
  masterProducts: products.length,
  stores: stores.length,
  storeProducts: stores.length * products.length,
  adminUid: adminAuthUser.uid,
  maestroUid: maestroAuthUser.uid
}, null, 2));
