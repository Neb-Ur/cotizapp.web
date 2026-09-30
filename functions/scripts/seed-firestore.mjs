import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || 'cotizapp-d71c8';
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const seedTag = 'pilot-catalog-2026-09-30';
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
  {
    id: 'store-piloto-centro',
    ownerId: 'user-piloto-centro',
    nombre: 'Ferretería Piloto Centro',
    correo: 'piloto-centro@demo.cotizapp.local',
    comuna: 'Santiago',
    direccion: 'Santiago Centro',
    latitud: -33.4489,
    longitud: -70.6693,
    priceFactor: 1.00,
    stockFactor: 1.00
  },
  {
    id: 'store-piloto-maipu',
    ownerId: 'user-piloto-maipu',
    nombre: 'Ferretería Piloto Maipú',
    correo: 'piloto-maipu@demo.cotizapp.local',
    comuna: 'Maipú',
    direccion: 'Maipú',
    latitud: -33.5106,
    longitud: -70.7572,
    priceFactor: 0.97,
    stockFactor: 0.85
  },
  {
    id: 'store-piloto-florida',
    ownerId: 'user-piloto-florida',
    nombre: 'Ferretería Piloto La Florida',
    correo: 'piloto-florida@demo.cotizapp.local',
    comuna: 'La Florida',
    direccion: 'La Florida',
    latitud: -33.5227,
    longitud: -70.5986,
    priceFactor: 1.04,
    stockFactor: 1.15
  }
];

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

for (const store of stores) {
  batch.set(db.collection('usuarios').doc(store.ownerId), {
    rol: 'ferreteria',
    nombre: store.nombre,
    correo: store.correo,
    telefono: '',
    region: 'Región Metropolitana',
    ciudad: 'Santiago',
    comuna: store.comuna,
    direccion: store.direccion,
    estadoCuenta: 'activo',
    creadoEn: createdAt,
    seedTag
  }, { merge });

  batch.set(db.collection('ferreterias').doc(store.id), {
    usuarioDuenoId: store.ownerId,
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
    const offerId = `offer-${store.id}-${product.id}`;

    batch.set(db.collection('productosFerreteria').doc(offerId), {
      ferreteriaId: store.id,
      productoMaestroId: product.id,
      skuFerreteria: `${store.id.replace('store-piloto-', '').toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
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
  storeProducts: stores.length * products.length
}, null, 2));
