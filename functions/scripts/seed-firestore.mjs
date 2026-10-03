import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('FIREBASE_PROJECT_ID es obligatorio para ejecutar el seed.');
if (process.env.ENABLE_DEMO_SEED !== 'true' || process.env.DEMO_SEED_PROJECT_ID !== projectId) {
  throw new Error('Seed bloqueado. Usa un proyecto exclusivo de demostración y confirma ENABLE_DEMO_SEED=true y DEMO_SEED_PROJECT_ID.');
}
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}-catalog-assets`;
const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket });
const auth = getAuth(app);
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const seedTag = 'pilot-catalog-auth-v3-2026-09-30';
const createdAt = '2026-09-30T10:40:00.000Z';
const updatedAt = new Date().toISOString();
const demoPassword = process.env.DEMO_PASSWORD;
if (!demoPassword || demoPassword.length < 12) {
  throw new Error('DEMO_PASSWORD es obligatorio y debe tener al menos 12 caracteres.');
}

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
  { id: 'prod-silicona-transparente-300', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Silicona sellante transparente 300 ml', basePrice: 4490, stock: 44 },
  { id: 'prod-cemento-alta-resistencia-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-cemento', nombre: 'Cemento alta resistencia 25 kg', basePrice: 5790, stock: 105 },
  { id: 'prod-cemento-especial-425kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-cemento', nombre: 'Cemento especial 42,5 kg', basePrice: 8790, stock: 82 },
  { id: 'prod-mortero-estuco-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-mortero', nombre: 'Mortero estuco exterior 25 kg', basePrice: 6190, stock: 68 },
  { id: 'prod-mortero-radier-25kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-cementos-morteros', familiaId: 'fam-mortero', nombre: 'Mortero para radier 25 kg', basePrice: 6790, stock: 74 },
  { id: 'prod-arena-fina-40kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-aridos', familiaId: 'fam-aridos', nombre: 'Arena fina saco 40 kg', basePrice: 3190, stock: 95 },
  { id: 'prod-estabilizado-40kg', categoriaId: 'cat-obra-gruesa', subcategoriaId: 'sub-aridos', familiaId: 'fam-aridos', nombre: 'Estabilizado saco 40 kg', basePrice: 3690, stock: 78 },
  { id: 'prod-mdf-15mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Plancha MDF 15 mm 1,52 x 2,44 m', basePrice: 26990, stock: 28 },
  { id: 'prod-melamina-blanca-15mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Melamina blanca 15 mm 1,83 x 2,50 m', basePrice: 42990, stock: 22 },
  { id: 'prod-osb-111mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Plancha OSB 11,1 mm 1,22 x 2,44 m', basePrice: 18990, stock: 38 },
  { id: 'prod-terciado-9mm', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-tableros', familiaId: 'fam-tableros', nombre: 'Terciado estructural 9 mm 1,22 x 2,44 m', basePrice: 17990, stock: 31 },
  { id: 'prod-pino-2x2-320', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-madera-dimensionada', familiaId: 'fam-madera', nombre: 'Pino dimensionado 2x2\" 3,20 m', basePrice: 3290, stock: 125 },
  { id: 'prod-pino-2x3-320', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-madera-dimensionada', familiaId: 'fam-madera', nombre: 'Pino dimensionado 2x3\" 3,20 m', basePrice: 4290, stock: 115 },
  { id: 'prod-pino-1x4-320', categoriaId: 'cat-maderas-tableros', subcategoriaId: 'sub-madera-dimensionada', familiaId: 'fam-madera', nombre: 'Pino cepillado 1x4\" 3,20 m', basePrice: 3990, stock: 88 },
  { id: 'prod-yesocarton-rh-125mm', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-yeso-carton', familiaId: 'fam-yeso-carton', nombre: 'Plancha yeso-cartón RH 12,5 mm 1,20 x 2,40 m', basePrice: 14990, stock: 42 },
  { id: 'prod-yesocarton-rf-15mm', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-yeso-carton', familiaId: 'fam-yeso-carton', nombre: 'Plancha yeso-cartón RF 15 mm 1,20 x 2,40 m', basePrice: 17990, stock: 36 },
  { id: 'prod-pasta-muro-25kg', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Pasta muro interior 25 kg', basePrice: 20990, stock: 33 },
  { id: 'prod-latex-exterior-galon', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Pintura látex exterior blanca 1 galón', basePrice: 22990, stock: 27 },
  { id: 'prod-esmalte-sintetico-galon', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Esmalte sintético brillante 1 galón', basePrice: 25990, stock: 21 },
  { id: 'prod-primer-anticorrosivo-galon', categoriaId: 'cat-terminaciones', subcategoriaId: 'sub-pinturas', familiaId: 'fam-pinturas', nombre: 'Primer anticorrosivo gris 1 galón', basePrice: 23990, stock: 19 },
  { id: 'prod-pvc-75x6', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Tubería PVC sanitario 75 mm x 6 m', basePrice: 8990, stock: 44 },
  { id: 'prod-codo-pvc-110', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Codo PVC sanitario 110 mm 87,5°', basePrice: 3490, stock: 72 },
  { id: 'prod-codo-pvc-50', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Codo PVC sanitario 50 mm 87,5°', basePrice: 1490, stock: 96 },
  { id: 'prod-tee-pvc-110', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Tee PVC sanitario 110 mm', basePrice: 5790, stock: 51 },
  { id: 'prod-copla-pvc-50', categoriaId: 'cat-gasfiteria', subcategoriaId: 'sub-pvc', familiaId: 'fam-pvc', nombre: 'Copla PVC sanitario 50 mm', basePrice: 990, stock: 110 },
  { id: 'prod-cable-thhn-15-100', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Cable eléctrico THHN 1,5 mm² 100 m', basePrice: 28990, stock: 24 },
  { id: 'prod-cable-thhn-4-100', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Cable eléctrico THHN 4 mm² 100 m', basePrice: 61990, stock: 14 },
  { id: 'prod-conduit-20x3', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Tubo conduit PVC 20 mm x 3 m', basePrice: 2390, stock: 130 },
  { id: 'prod-enchufe-doble-10a', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Enchufe doble 10 A blanco', basePrice: 4990, stock: 68 },
  { id: 'prod-automatico-16a', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Interruptor automático 1P 16 A', basePrice: 6490, stock: 47 },
  { id: 'prod-diferencial-25a', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Interruptor diferencial 2P 25 A 30 mA', basePrice: 23990, stock: 16 },
  { id: 'prod-caja-embutir-electrica', categoriaId: 'cat-electricidad', subcategoriaId: 'sub-cables-mecanismos', familiaId: 'fam-electricos', nombre: 'Caja eléctrica para embutir 5/8', basePrice: 690, stock: 160 },
  { id: 'prod-tornillo-yesocarton-158', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Tornillo yeso-cartón punta fina 1 5/8\" caja 100', basePrice: 4990, stock: 76 },
  { id: 'prod-tornillo-roscalata-8x1', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Tornillo roscalata 8 x 1\" caja 100', basePrice: 4590, stock: 81 },
  { id: 'prod-tarugo-nylon-6mm', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Tarugo nylon 6 mm bolsa 100', basePrice: 2690, stock: 92 },
  { id: 'prod-clavo-corriente-2', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Clavo corriente 2\" bolsa 1 kg', basePrice: 3990, stock: 64 },
  { id: 'prod-perno-anclaje-38x3', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-tornillos-tarugos', familiaId: 'fam-fijaciones', nombre: 'Perno de anclaje 3/8 x 3\" unidad', basePrice: 1290, stock: 118 },
  { id: 'prod-sellante-poliuretano-gris', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Sellante poliuretano gris 300 ml', basePrice: 7990, stock: 39 },
  { id: 'prod-sellante-acrilico-blanco', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Sellante acrílico blanco 300 ml', basePrice: 3490, stock: 53 },
  { id: 'prod-espuma-poliuretano-500', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Espuma expansiva poliuretano 500 ml', basePrice: 6990, stock: 41 },
  { id: 'prod-adhesivo-montaje-300', categoriaId: 'cat-fijaciones-sellantes', subcategoriaId: 'sub-sellantes', familiaId: 'fam-sellantes', nombre: 'Adhesivo de montaje 300 ml', basePrice: 5490, stock: 46 }
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

async function ensureAuthUser(email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    return auth.updateUser(existing.uid, {
      displayName,
      password: demoPassword,
      emailVerified: true,
      disabled: false
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    return auth.createUser({
      email,
      displayName,
      password: demoPassword,
      emailVerified: true,
      disabled: false
    });
  }
}

const storeAuth = [];
for (const store of stores) {
  const firebaseUser = await ensureAuthUser(store.correo, store.nombre);
  storeAuth.push({ ...store, uid: firebaseUser.uid });
}
const adminAuthUser = await ensureAuthUser('admin@demo.cl', 'Admin Demo CotizApp');
const maestroAuthUser = await ensureAuthUser('maestro@demo.cl', 'Maestro Demo');

const brandByFamily = {
  'fam-cemento': 'Melón',
  'fam-mortero': 'Topex',
  'fam-aridos': 'Áridos Santiago',
  'fam-tableros': 'Arauco',
  'fam-madera': 'Arauco',
  'fam-yeso-carton': 'Volcán',
  'fam-pinturas': 'Ceresita',
  'fam-pvc': 'Vinilit',
  'fam-electricos': 'Schneider Electric',
  'fam-fijaciones': 'Fixser',
  'fam-sellantes': 'Sika'
};

const catalogImageAssetByFamily = {
  'fam-cemento': 'cement-bag.webp',
  'fam-mortero': 'cement-bag.webp',
  'fam-aridos': 'aggregates.webp',
  'fam-tableros': 'wood-boards.webp',
  'fam-madera': 'wood-boards.webp',
  'fam-yeso-carton': 'drywall.webp',
  'fam-pinturas': 'paint.webp',
  'fam-pvc': 'pvc.webp',
  'fam-electricos': 'electrical.webp',
  'fam-fijaciones': 'fixings-sealants.webp',
  'fam-sellantes': 'fixings-sealants.webp'
};

async function uploadCatalogImage(assetName) {
  const sourcePath = fileURLToPath(new URL(`./assets/catalog/${assetName}`, import.meta.url));
  const source = await readFile(sourcePath);
  const contentHash = createHash('sha256').update(source).digest('hex').slice(0, 12);
  const destination = `catalogo/seed/${assetName.replace('.webp', '')}-${contentHash}.webp`;
  const file = bucket.file(destination);
  const [exists] = await file.exists();

  if (!exists) {
    await bucket.upload(sourcePath, {
      destination,
      resumable: false,
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public,max-age=31536000,immutable',
        metadata: { seedTag }
      }
    });
  }

  const publicObjectPath = destination.split('/').map(encodeURIComponent).join('/');
  return `https://storage.googleapis.com/${bucket.name}/${publicObjectPath}`;
}

const catalogImageUrlByAsset = new Map();
for (const assetName of new Set(Object.values(catalogImageAssetByFamily))) {
  catalogImageUrlByAsset.set(assetName, await uploadCatalogImage(assetName));
}

const maxWritesPerBatch = 400;
let batch = db.batch();
let pendingWrites = 0;
let committedBatches = 0;

async function flushBatch() {
  if (pendingWrites === 0) return;
  await batch.commit();
  batch = db.batch();
  pendingWrites = 0;
  committedBatches += 1;
}

async function setDoc(ref, data, options = { merge: true }) {
  batch.set(ref, data, options);
  pendingWrites += 1;
  if (pendingWrites >= maxWritesPerBatch) await flushBatch();
}

async function deleteDoc(ref) {
  batch.delete(ref);
  pendingWrites += 1;
  if (pendingWrites >= maxWritesPerBatch) await flushBatch();
}

const merge = true;

for (const item of categories) {
  await setDoc(db.collection('categorias').doc(item.id), { nombre: item.nombre, seedTag }, { merge });
}
for (const item of subcategories) {
  await setDoc(db.collection('subcategorias').doc(item.id), { categoriaId: item.categoriaId, nombre: item.nombre, seedTag }, { merge });
}
for (const item of families) {
  await setDoc(db.collection('familias').doc(item.id), { subcategoriaId: item.subcategoriaId, nombre: item.nombre, seedTag }, { merge });
}

for (const product of products) {
  const imageAsset = catalogImageAssetByFamily[product.familiaId];
  const imageUrl = imageAsset ? catalogImageUrlByAsset.get(imageAsset) || '' : '';
  await setDoc(db.collection('productosMaestro').doc(product.id), {
    categoriaId: product.categoriaId,
    subcategoriaId: product.subcategoriaId,
    familiaId: product.familiaId,
    nombre: product.nombre,
    marca: brandByFamily[product.familiaId] || 'Genérico',
    descripcionCorta: `${product.nombre}, disponible para cotización y comparación de precios.`,
    descripcionLarga: `Ficha demostrativa de ${product.nombre}. Datos de precio, disponibilidad y stock generados para pruebas funcionales de CotizApp.`,
    imagenPrincipalUrl: imageUrl,
    galeriaJson: imageUrl ? [imageUrl] : [],
    origenImagen: imageUrl ? 'ai_generated' : null,
    proveedorImagen: imageUrl ? 'OpenAI ImageGen' : null,
    terminosFuenteUrl: imageUrl ? 'https://openai.com/policies/terms-of-use/' : null,
    referenciaAutorizacion: imageUrl ? `SEED-AI-ASSET:${imageAsset}` : null,
    contieneMarcasTerceros: false,
    referenciaAutorizacionMarca: null,
    derechosRevisadosEn: createdAt,
    derechosRevisadosPor: 'seed-script',
    origenContenido: 'ai_assisted_original',
    fuenteContenidoUrl: null,
    referenciaDerechosContenido: 'SEED-DEMO-COPY:generated-for-cotizapp',
    derechosContenidoRevisadosEn: createdAt,
    derechosContenidoRevisadosPor: 'seed-script',
    estado: 'activo',
    creadoEn: createdAt,
    seedTag
  }, { merge });
}

function priceMeasureForName(name) {
  const kilograms = name.match(/([0-9]+(?:[.,][0-9]+)?)\s*kg\b/i);
  if (kilograms) return { unidadMedidaPrecio: 'kg', cantidadMedida: Number(kilograms[1].replace(',', '.')) };
  const millilitres = name.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:ml|cc)\b/i);
  if (millilitres) return { unidadMedidaPrecio: 'l', cantidadMedida: Number(millilitres[1].replace(',', '.')) / 1000 };
  return { unidadMedidaPrecio: null, cantidadMedida: null };
}

for (const store of storeAuth) {
  await setDoc(db.collection('usuarios').doc(store.uid), {
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

  await setDoc(db.collection('ferreterias').doc(store.id), {
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
    const priceMeasure = priceMeasureForName(product.nombre);

    await setDoc(db.collection('productosFerreteria').doc(offerId), {
      ferreteriaId: store.id,
      productoMaestroId: product.id,
      skuFerreteria: store.id.replace('store-piloto-', '').toUpperCase() + '-' + String(i + 1).padStart(3, '0'),
      codigoBarras: null,
      precio: price,
      stock,
      incluyeIva: true,
      unidadMedidaPrecio: priceMeasure.unidadMedidaPrecio,
      cantidadMedida: priceMeasure.cantidadMedida,
      vigenteDesde: updatedAt,
      vigenteHasta: null,
      condicionesOferta: 'Precio final informado por la ferretería, sujeto a stock y confirmación directa. Retiro en local; despacho no incluido.',
      patrocinado: false,
      activo: true,
      publicado: true,
      creadoEn: createdAt,
      actualizadoEn: updatedAt,
      seedTag
    }, { merge });
  }
}

await setDoc(db.collection('usuarios').doc(adminAuthUser.uid), {
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

await setDoc(db.collection('usuarios').doc(maestroAuthUser.uid), {
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
  await deleteDoc(db.collection('usuarios').doc(staleId));
}

await flushBatch();

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
  authUsers: storeAuth.length + 2,
  committedBatches,
  adminUid: adminAuthUser.uid,
  maestroUid: maestroAuthUser.uid
}, null, 2));
