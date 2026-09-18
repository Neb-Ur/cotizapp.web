import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Router, type Request, type Response } from 'express';
import { adminAuth, db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';

export const mvpRouter = Router();

type UserRole = 'maestro' | 'ferreteria' | 'admin';
type ProjectStatus = 'pendiente' | 'aceptada' | 'rechazada';

type ProjectItem = {
  productName: string;
  quantity: number;
};

type SearchRow = {
  productoMaestroId: string;
  productoFerreteriaId: string;
  productName: string;
  storeName: string;
  storeId: string;
  price: number;
  distanceKm: number;
  balanceScore: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  familyId: string;
  familyName: string;
  stock: number;
  sku: string;
};

const COLLECTIONS = {
  users: 'usuarios',
  stores: 'ferreterias',
  categories: 'categorias',
  subcategories: 'subcategorias',
  families: 'familias',
  familyDefinitions: 'definicionesAtributoFamilia',
  masterProducts: 'productosMaestro',
  masterAttributes: 'atributosProductoMaestro',
  storeProducts: 'productosFerreteria',
  projects: 'proyectos',
  productRequests: 'solicitudesCreacionProducto'
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function validRole(value: unknown): value is UserRole {
  return value === 'maestro' || value === 'ferreteria' || value === 'admin';
}

async function rows(collectionName: string): Promise<any[]> {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function row(collectionName: string, id: string): Promise<any | null> {
  const snapshot = await db.collection(collectionName).doc(id).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function createRow(collectionName: string, payload: Record<string, unknown>, id = randomUUID()): Promise<any> {
  await db.collection(collectionName).doc(id).set(payload);
  return { id, ...payload };
}

async function patchRow(collectionName: string, id: string, payload: Record<string, unknown>): Promise<any | null> {
  const ref = db.collection(collectionName).doc(id);
  const current = await ref.get();
  if (!current.exists) return null;
  await ref.update(payload);
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

async function deleteRowsByIds(collectionName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (let offset = 0; offset < ids.length; offset += 400) {
    const batch = db.batch();
    ids.slice(offset, offset + 400).forEach((id) => batch.delete(db.collection(collectionName).doc(id)));
    await batch.commit();
  }
}

function canAccessOwner(req: Request, ownerId: string): boolean {
  return req.authRole === 'admin' || req.authUserId === ownerId;
}

async function storeOwnedBy(storeId: string, userId: string): Promise<boolean> {
  const store = await row(COLLECTIONS.stores, storeId);
  return !!store && store.usuarioDuenoId === userId;
}

async function requireStoreWriteAccess(req: Request, res: Response, storeId: string): Promise<boolean> {
  if (req.authRole === 'admin') return true;
  if (!req.authUserId || req.authRole !== 'ferreteria') {
    fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para modificar esta ferreteria.', 403);
    return false;
  }
  if (!(await storeOwnedBy(storeId, req.authUserId))) {
    fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para modificar esta ferreteria.', 403);
    return false;
  }
  return true;
}

async function authUserResponse(userId: string): Promise<any | null> {
  const user = await row(COLLECTIONS.users, userId);
  if (!user) return null;
  const stores = await rows(COLLECTIONS.stores);
  const store = stores.find((item) => item.usuarioDuenoId === userId);
  return {
    ...user,
    ferreteriaId: store?.id,
    nombreComercial: store?.nombreComercial,
    rut: store?.rut ?? user.rut
  };
}

async function buildSearchRows(): Promise<SearchRow[]> {
  const [offers, products, stores, categories, subcategories, families] = await Promise.all([
    rows(COLLECTIONS.storeProducts),
    rows(COLLECTIONS.masterProducts),
    rows(COLLECTIONS.stores),
    rows(COLLECTIONS.categories),
    rows(COLLECTIONS.subcategories),
    rows(COLLECTIONS.families)
  ]);

  const productById = new Map(products.map((item) => [item.id, item]));
  const storeById = new Map(stores.map((item) => [item.id, item]));
  const categoryById = new Map(categories.map((item) => [item.id, item]));
  const subcategoryById = new Map(subcategories.map((item) => [item.id, item]));
  const familyById = new Map(families.map((item) => [item.id, item]));

  return offers
    .filter((offer) => offer.activo !== false && offer.publicado !== false)
    .map((offer) => {
      const product = productById.get(offer.productoMaestroId);
      const store = storeById.get(offer.ferreteriaId);
      if (!product || !store || product.estado === 'inactivo' || store.estado === 'inactivo') return null;

      const price = numberValue(offer.precio);
      return {
        productoMaestroId: product.id,
        productoFerreteriaId: offer.id,
        productName: product.nombre,
        storeName: store.nombreComercial,
        storeId: store.id,
        price,
        distanceKm: 0,
        balanceScore: price,
        categoryId: product.categoriaId,
        categoryName: categoryById.get(product.categoriaId)?.nombre || 'Sin categoria',
        subcategoryId: product.subcategoriaId,
        subcategoryName: subcategoryById.get(product.subcategoriaId)?.nombre || 'Sin subcategoria',
        familyId: product.familiaId,
        familyName: familyById.get(product.familiaId)?.nombre || 'Sin familia',
        stock: numberValue(offer.stock),
        sku: offer.skuFerreteria || ''
      } satisfies SearchRow;
    })
    .filter((item): item is SearchRow => item !== null);
}

function normalizeItems(value: unknown): ProjectItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      productName: normalizeText(item?.productName),
      quantity: Math.max(1, Math.floor(numberValue(item?.quantity, 1)))
    }))
    .filter((item) => item.productName.length > 0);
}

async function optimizeItems(items: ProjectItem[]): Promise<any> {
  const searchRows = await buildSearchRows();
  const normalized = normalizeItems(items);
  const lines = normalized.map((item) => {
    const candidates = searchRows
      .filter((offer) => offer.productName.toLowerCase() === item.productName.toLowerCase() && offer.stock >= item.quantity)
      .sort((a, b) => a.price - b.price);
    const best = candidates[0];
    const unitPrice = best?.price || 0;
    return {
      productName: item.productName,
      quantity: item.quantity,
      bestStoreName: best?.storeName || 'Sin datos',
      unitPrice,
      subtotal: unitPrice * item.quantity,
      productoFerreteriaId: best?.productoFerreteriaId || null
    };
  });

  const optimalTotal = lines.reduce((acc, item) => acc + item.subtotal, 0);

  const storeNames = Array.from(new Set(searchRows.map((item) => item.storeName)));
  const totalsByStore = storeNames
    .map((storeName) => {
      let total = 0;
      for (const item of normalized) {
        const offer = searchRows
          .filter((candidate) => candidate.storeName === storeName
            && candidate.productName.toLowerCase() === item.productName.toLowerCase()
            && candidate.stock >= item.quantity)
          .sort((a, b) => a.price - b.price)[0];
        if (!offer) return null;
        total += offer.price * item.quantity;
      }
      return { storeName, total };
    })
    .filter((item): item is { storeName: string; total: number } => item !== null)
    .sort((a, b) => a.total - b.total);

  const bestStore = totalsByStore[0] || { storeName: 'Sin tienda unica disponible', total: optimalTotal };
  return {
    lines,
    totalsByStore,
    bestStore,
    optimalTotal,
    mixedSaving: Math.max(0, bestStore.total - optimalTotal)
  };
}

async function projectView(project: any): Promise<any> {
  const items = normalizeItems(project.items);
  const optimization = await optimizeItems(items);
  return {
    id: project.id,
    name: project.name || project.nombre || 'Cotizacion',
    address: project.address || project.direccionObra || '',
    createdAt: project.createdAt || project.creadoEn || nowIso(),
    status: (project.status || 'pendiente') as ProjectStatus,
    statusUpdatedAt: project.statusUpdatedAt || project.updatedAt || project.createdAt || project.creadoEn || nowIso(),
    items,
    totalOptimal: optimization.optimalTotal,
    saving: optimization.mixedSaving
  };
}

mvpRouter.get('/health', (_req, res) => ok(res, { status: 'ok', service: 'cotizapp-functions' }));

// Authentication/profile. Firebase Authentication owns credentials; Firestore stores the app profile.
mvpRouter.post('/auth/register', requireAuth, async (req, res) => {
  const role = req.body?.rol;
  if (!req.authUserId || !validRole(role) || role === 'admin') {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Datos invalidos para crear el perfil.', 400);
  }

  const firebaseUser = await adminAuth.getUser(req.authUserId);
  const userPayload = {
    rol: role,
    nombre: normalizeText(req.body?.nombre),
    correo: (firebaseUser.email || normalizeText(req.body?.correo)).toLowerCase(),
    telefono: normalizeText(req.body?.telefono),
    telefonoSecundario: normalizeText(req.body?.telefonoSecundario),
    region: normalizeText(req.body?.region),
    ciudad: normalizeText(req.body?.ciudad),
    comuna: normalizeText(req.body?.comuna),
    direccion: normalizeText(req.body?.direccion),
    planSuscripcion: 'basico',
    estadoCuenta: 'activo',
    creadoEn: nowIso(),
    especialidad: normalizeText(req.body?.especialidad),
    anosExperiencia: numberValue(req.body?.anosExperiencia),
    metodoContactoPreferido: req.body?.metodoContactoPreferido || 'whatsapp'
  };

  if (!userPayload.nombre || !userPayload.correo) {
    return fail(res, 'AUTH_INVALID_PAYLOAD', 'Nombre y correo son obligatorios.', 400);
  }

  await db.collection(COLLECTIONS.users).doc(req.authUserId).set(userPayload, { merge: true });

  if (role === 'ferreteria') {
    const existingStores = (await rows(COLLECTIONS.stores)).filter((store) => store.usuarioDuenoId === req.authUserId);
    if (existingStores.length === 0) {
      await createRow(COLLECTIONS.stores, {
        usuarioDuenoId: req.authUserId,
        nombreComercial: normalizeText(req.body?.nombreComercial) || userPayload.nombre,
        rut: normalizeText(req.body?.rut),
        estado: 'activo',
        creadoEn: nowIso()
      });
    }
  }

  const profile = await authUserResponse(req.authUserId);
  return ok(res, { usuario: profile }, 201);
});

mvpRouter.get('/auth/me', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  const profile = await authUserResponse(req.authUserId);
  if (!profile) return fail(res, 'AUTH_USER_NOT_FOUND', 'No se encontro el perfil del usuario.', 404);
  return ok(res, profile);
});

mvpRouter.patch('/auth/me', requireAuth, async (req, res) => {
  if (!req.authUserId) return fail(res, 'AUTH_REQUIRED', 'Debes iniciar sesion.', 401);
  const allowed = [
    'nombre', 'telefono', 'telefonoSecundario', 'region', 'ciudad', 'comuna', 'direccion',
    'especialidad', 'anosExperiencia', 'metodoContactoPreferido', 'contactoEmergenciaNombre',
    'contactoEmergenciaTelefono'
  ];
  const patch: Record<string, unknown> = {};
  allowed.forEach((key) => {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  });
  if (Object.keys(patch).length > 0) await db.collection(COLLECTIONS.users).doc(req.authUserId).set(patch, { merge: true });

  const stores = (await rows(COLLECTIONS.stores)).filter((store) => store.usuarioDuenoId === req.authUserId);
  if (stores[0]) {
    const storePatch: Record<string, unknown> = {};
    if (req.body?.nombreComercial !== undefined) storePatch['nombreComercial'] = normalizeText(req.body.nombreComercial);
    if (req.body?.rut !== undefined) storePatch['rut'] = normalizeText(req.body.rut);
    if (Object.keys(storePatch).length > 0) await db.collection(COLLECTIONS.stores).doc(stores[0].id).set(storePatch, { merge: true });
  }

  return ok(res, await authUserResponse(req.authUserId));
});

mvpRouter.post('/auth/logout', requireAuth, async (_req, res) => ok(res, { success: true }));

// Chile locations bundled with the Functions source.
function locationsData(): any {
  const url = new URL('../../data/chile-locations.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf-8'));
}

mvpRouter.get('/ubicaciones/regiones', (req, res) => {
  const q = normalizeText(req.query['q']).toLowerCase();
  const data = locationsData().regions
    .filter((item: any) => !q || item.name.toLowerCase().includes(q));
  return ok(res, data);
});

mvpRouter.get('/ubicaciones/ciudades', (req, res) => {
  const regionId = normalizeText(req.query['regionId']);
  const q = normalizeText(req.query['q']).toLowerCase();
  const data = locationsData().cities
    .filter((item: any) => !regionId || item.regionId === regionId)
    .filter((item: any) => !q || item.name.toLowerCase().includes(q));
  return ok(res, data);
});

mvpRouter.get('/ubicaciones/comunas', (req, res) => {
  const cityId = normalizeText(req.query['cityId']);
  const q = normalizeText(req.query['q']).toLowerCase();
  const data = locationsData().communes
    .filter((item: any) => !cityId || item.cityId === cityId)
    .filter((item: any) => !q || item.name.toLowerCase().includes(q));
  return ok(res, data);
});

// Taxonomy.
mvpRouter.get('/categorias', async (_req, res) => ok(res, (await rows(COLLECTIONS.categories)).sort((a, b) => a.nombre.localeCompare(b.nombre))));

mvpRouter.post('/categorias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  if (!nombre) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Nombre requerido.', 400);
  return ok(res, await createRow(COLLECTIONS.categories, { nombre }), 201);
});

mvpRouter.patch('/categorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const updated = await patchRow(COLLECTIONS.categories, req.params.id, { nombre });
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Categoria no encontrada.', 404);
});

mvpRouter.delete('/categorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.categories).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

mvpRouter.get('/subcategorias', async (req, res) => {
  const categoryId = normalizeText(req.query['categoriaId']);
  const data = (await rows(COLLECTIONS.subcategories))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return ok(res, data);
});

mvpRouter.post('/subcategorias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const categoriaId = normalizeText(req.body?.categoriaId);
  if (!nombre || !categoriaId) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Categoria y nombre son requeridos.', 400);
  return ok(res, await createRow(COLLECTIONS.subcategories, { nombre, categoriaId }), 201);
});

mvpRouter.patch('/subcategorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const patch: Record<string, unknown> = {};
  if (req.body?.nombre !== undefined) patch['nombre'] = normalizeText(req.body.nombre);
  if (req.body?.categoriaId !== undefined) patch['categoriaId'] = normalizeText(req.body.categoriaId);
  const updated = await patchRow(COLLECTIONS.subcategories, req.params.id, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Subcategoria no encontrada.', 404);
});

mvpRouter.delete('/subcategorias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.subcategories).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

mvpRouter.get('/familias', async (req, res) => {
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const data = (await rows(COLLECTIONS.families))
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return ok(res, data);
});

mvpRouter.post('/familias', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  const subcategoriaId = normalizeText(req.body?.subcategoriaId);
  if (!nombre || !subcategoriaId) return fail(res, 'TAXONOMIA_INVALID_PAYLOAD', 'Subcategoria y nombre son requeridos.', 400);
  return ok(res, await createRow(COLLECTIONS.families, { nombre, subcategoriaId }), 201);
});

mvpRouter.patch('/familias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const patch: Record<string, unknown> = {};
  if (req.body?.nombre !== undefined) patch['nombre'] = normalizeText(req.body.nombre);
  if (req.body?.subcategoriaId !== undefined) patch['subcategoriaId'] = normalizeText(req.body.subcategoriaId);
  const updated = await patchRow(COLLECTIONS.families, req.params.id, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_NOT_FOUND', 'Familia no encontrada.', 404);
});

mvpRouter.delete('/familias/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.families).doc(req.params.id).delete();
  return ok(res, { deleted: true });
});

mvpRouter.get('/familias/:familyId/atributos-definicion', async (req, res) => {
  const data = (await rows(COLLECTIONS.familyDefinitions))
    .filter((item) => item.familiaId === req.params.familyId)
    .sort((a, b) => numberValue(a.orden) - numberValue(b.orden));
  return ok(res, data);
});

mvpRouter.post('/familias/:familyId/atributos-definicion', requireAuth, requireRole('admin'), async (req, res) => {
  const created = await createRow(COLLECTIONS.familyDefinitions, {
    familiaId: req.params.familyId,
    codigo: normalizeText(req.body?.codigo),
    etiqueta: normalizeText(req.body?.etiqueta),
    tipoDato: req.body?.tipoDato || 'texto',
    esFiltrable: boolValue(req.body?.esFiltrable),
    esObligatorio: boolValue(req.body?.esObligatorio),
    opcionesJson: Array.isArray(req.body?.opcionesJson) ? req.body.opcionesJson : [],
    orden: numberValue(req.body?.orden)
  });
  return ok(res, created, 201);
});

mvpRouter.patch('/familias/:familyId/atributos-definicion/:definitionId', requireAuth, requireRole('admin'), async (req, res) => {
  const patch = { ...req.body, familiaId: req.params.familyId };
  const updated = await patchRow(COLLECTIONS.familyDefinitions, req.params.definitionId, patch);
  return updated ? ok(res, updated) : fail(res, 'TAXONOMIA_DEFINITION_NOT_FOUND', 'Definicion no encontrada.', 404);
});

mvpRouter.delete('/familias/:familyId/atributos-definicion/:definitionId', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.familyDefinitions).doc(req.params.definitionId).delete();
  return ok(res, { deleted: true });
});

// Master catalog.
mvpRouter.get('/productos-maestro', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const data = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => item.estado !== 'inactivo')
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  return ok(res, data);
});

mvpRouter.get('/productos-maestro/paginado', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const excluded = new Set(normalizeText(req.query['excludeProductoMaestroIds']).split(',').filter(Boolean));
  const page = Math.max(1, Math.floor(numberValue(req.query['page'], 1)));
  const size = Math.min(100, Math.max(1, Math.floor(numberValue(req.query['size'], 25))));
  const all = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => item.estado !== 'inactivo')
    .filter((item) => !excluded.has(item.id))
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const items = all.slice((safePage - 1) * size, safePage * size);
  return ok(res, { items, page: safePage, size, total, totalPages });
});

mvpRouter.get('/productos-maestro/:id', async (req, res) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const atributos = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === product.id);
  return ok(res, { ...product, atributos });
});

mvpRouter.post('/productos-maestro', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  if (!nombre) return fail(res, 'PRODUCTO_MAESTRO_INVALID_PAYLOAD', 'Nombre requerido.', 400);
  const created = await createRow(COLLECTIONS.masterProducts, {
    categoriaId: normalizeText(req.body?.categoriaId),
    subcategoriaId: normalizeText(req.body?.subcategoriaId),
    familiaId: normalizeText(req.body?.familiaId),
    nombre,
    marca: normalizeText(req.body?.marca) || 'Sin marca',
    descripcionCorta: normalizeText(req.body?.descripcionCorta),
    descripcionLarga: normalizeText(req.body?.descripcionLarga),
    imagenPrincipalUrl: normalizeText(req.body?.imagenPrincipalUrl),
    galeriaJson: Array.isArray(req.body?.galeriaJson) ? req.body.galeriaJson : [],
    estado: req.body?.estado === 'inactivo' ? 'inactivo' : 'activo',
    creadoEn: nowIso()
  });
  return ok(res, created, 201);
});

mvpRouter.patch('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const updated = await patchRow(COLLECTIONS.masterProducts, req.params.id, req.body || {});
  return updated ? ok(res, updated) : fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
});

mvpRouter.put('/productos-maestro/:id/atributos', requireAuth, requireRole('admin'), async (req, res) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const current = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, current.map((item) => item.id));
  const result: any[] = [];
  for (const item of Array.isArray(req.body) ? req.body : []) {
    result.push(await createRow(COLLECTIONS.masterAttributes, { productoMaestroId: req.params.id, ...item }));
  }
  return ok(res, result);
});

mvpRouter.delete('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.masterProducts).doc(req.params.id).delete();
  const attributes = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, attributes.map((item) => item.id));
  return ok(res, { deleted: true });
});

// Search/comparison.
mvpRouter.get('/busqueda', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const sort = normalizeText(req.query['sort']) || 'precio';
  const data = (await buildSearchRows())
    .filter((item) => !q || item.productName.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoryId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoryId === subcategoryId)
    .filter((item) => !familyId || item.familyId === familyId)
    .sort((a, b) => sort === 'cercania'
      ? a.distanceKm - b.distanceKm
      : sort === 'balance'
        ? a.balanceScore - b.balanceScore
        : a.price - b.price);
  return ok(res, data);
});

mvpRouter.get('/productos/opciones', async (req, res) => {
  const familyId = normalizeText(req.query['familiaId']);
  const names = (await buildSearchRows())
    .filter((item) => !familyId || item.familyId === familyId)
    .map((item) => item.productName);
  return ok(res, Array.from(new Set(names)).sort());
});

mvpRouter.get('/familias/:familyId/productos', async (req, res) => {
  const q = normalizeText(req.query['search']).toLowerCase();
  const searchRows = (await buildSearchRows())
    .filter((item) => item.familyId === req.params.familyId)
    .filter((item) => !q || item.productName.toLowerCase().includes(q));
  const grouped = new Map<string, any>();
  searchRows.forEach((item) => {
    const current = grouped.get(item.productName) || {
      productName: item.productName,
      imageUrl: '',
      minPrice: item.price,
      maxPrice: item.price,
      storeCount: 0,
      brand: '',
      productType: '',
      sellers: new Set<string>()
    };
    current.minPrice = Math.min(current.minPrice, item.price);
    current.maxPrice = Math.max(current.maxPrice, item.price);
    current.sellers.add(item.storeName);
    grouped.set(item.productName, current);
  });
  return ok(res, Array.from(grouped.values()).map((item) => ({ ...item, storeCount: item.sellers.size, sellers: Array.from(item.sellers) })));
});

mvpRouter.get('/productos/populares', async (req, res) => {
  const limit = Math.max(1, Math.floor(numberValue(req.query['limit'], 12)));
  const searchRows = await buildSearchRows();
  const grouped = new Map<string, any>();
  searchRows.forEach((item) => {
    const current = grouped.get(item.productName) || { productName: item.productName, score: 0, minPrice: item.price, maxPrice: item.price, sellers: new Set<string>() };
    current.score += item.stock;
    current.minPrice = Math.min(current.minPrice, item.price);
    current.maxPrice = Math.max(current.maxPrice, item.price);
    current.sellers.add(item.storeName);
    grouped.set(item.productName, current);
  });
  return ok(res, Array.from(grouped.values()).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => ({
    productName: item.productName,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    storeCount: item.sellers.size,
    sellers: Array.from(item.sellers)
  })));
});

mvpRouter.get('/productos/detalle', async (req, res) => {
  const name = normalizeText(req.query['producto']).toLowerCase();
  const searchRows = (await buildSearchRows()).filter((item) => item.productName.toLowerCase() === name);
  if (searchRows.length === 0) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
  const product = await row(COLLECTIONS.masterProducts, searchRows[0].productoMaestroId);
  if (!product) return fail(res, 'PRODUCTO_NOT_FOUND', 'No se encontro el producto solicitado.', 404);
  const attributes = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === product.id);
  const stores = searchRows.map((item) => ({
    storeName: item.storeName,
    price: item.price,
    distanceKm: item.distanceKm,
    stock: item.stock,
    sku: item.sku,
    productoFerreteriaId: item.productoFerreteriaId
  })).sort((a, b) => a.price - b.price);
  return ok(res, {
    productoMaestro: product,
    atributosProducto: attributes,
    stores,
    minPrice: stores[0]?.price || 0,
    maxPrice: stores[stores.length - 1]?.price || 0
  });
});

mvpRouter.get('/ofertas/mejor', async (req, res) => {
  const name = normalizeText(req.query['producto']).toLowerCase();
  const offers = (await buildSearchRows())
    .filter((item) => item.productName.toLowerCase() === name)
    .sort((a, b) => a.price - b.price);
  const best = offers[0];
  return ok(res, best ? {
    storeName: best.storeName,
    price: best.price,
    sku: best.sku,
    productoFerreteriaId: best.productoFerreteriaId
  } : null);
});

// Ferreteria catalog.
mvpRouter.get('/ferreterias/by-owner/:ownerId', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para consultar esta ferreteria.', 403);
  const store = (await rows(COLLECTIONS.stores)).find((item) => item.usuarioDuenoId === req.params.ownerId);
  return store ? ok(res, store) : fail(res, 'FERRETERIA_NOT_FOUND', 'No existe ferreteria para el usuario indicado.', 404);
});

mvpRouter.get('/ferreterias/:storeId/catalogo', requireAuth, async (req, res) => {
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  if (req.authRole !== 'admin' && req.authUserId !== store.usuarioDuenoId) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para consultar este catalogo.', 403);
  const products = await rows(COLLECTIONS.masterProducts);
  const productById = new Map(products.map((item) => [item.id, item]));
  const data = (await rows(COLLECTIONS.storeProducts))
    .filter((item) => item.ferreteriaId === req.params.storeId)
    .map((item) => ({ ...item, productoMaestro: productById.get(item.productoMaestroId) }))
    .filter((item) => !!item.productoMaestro);
  return ok(res, data);
});

mvpRouter.post('/ferreterias/:storeId/catalogo', requireAuth, async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  const masterId = normalizeText(req.body?.productoMaestroId);
  const product = await row(COLLECTIONS.masterProducts, masterId);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro indicado.', 404);
  const current = (await rows(COLLECTIONS.storeProducts)).find((item) => item.ferreteriaId === req.params.storeId && item.productoMaestroId === masterId);
  if (current) return fail(res, 'CATALOGO_ALREADY_LINKED', 'El producto ya esta vinculado en la ferreteria.', 409);
  const created = await createRow(COLLECTIONS.storeProducts, {
    ferreteriaId: req.params.storeId,
    productoMaestroId: masterId,
    skuFerreteria: normalizeText(req.body?.skuFerreteria),
    codigoBarras: normalizeText(req.body?.codigoBarras) || null,
    precio: Math.max(0, numberValue(req.body?.precio)),
    stock: Math.max(0, Math.floor(numberValue(req.body?.stock))),
    activo: req.body?.activo !== false,
    publicado: req.body?.publicado !== false,
    creadoEn: nowIso(),
    actualizadoEn: nowIso()
  });
  return ok(res, { ...created, productoMaestro: product }, 201);
});

mvpRouter.patch('/ferreterias/:storeId/catalogo/:offerId', requireAuth, async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  const existing = await row(COLLECTIONS.storeProducts, req.params.offerId);
  if (!existing || existing.ferreteriaId !== req.params.storeId) return fail(res, 'CATALOGO_NOT_FOUND', 'Producto de ferreteria no encontrado.', 404);
  const patch: Record<string, unknown> = { actualizadoEn: nowIso() };
  ['skuFerreteria', 'codigoBarras', 'precio', 'stock', 'activo', 'publicado'].forEach((key) => {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  });
  const updated = await patchRow(COLLECTIONS.storeProducts, req.params.offerId, patch);
  const product = await row(COLLECTIONS.masterProducts, existing.productoMaestroId);
  return ok(res, { ...updated, productoMaestro: product });
});

mvpRouter.delete('/ferreterias/:storeId/catalogo/:offerId', requireAuth, async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  await db.collection(COLLECTIONS.storeProducts).doc(req.params.offerId).delete();
  return ok(res, { deleted: true });
});

// Projects/cotizaciones.
mvpRouter.get('/maestros/:ownerId/proyectos', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para estas cotizaciones.', 403);
  const projects = (await rows(COLLECTIONS.projects))
    .filter((item) => item.ownerId === req.params.ownerId)
    .sort((a, b) => normalizeText(b.createdAt).localeCompare(normalizeText(a.createdAt)));
  const data = await Promise.all(projects.map(projectView));
  return ok(res, data);
});

mvpRouter.post('/maestros/:ownerId/proyectos', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para crear esta cotizacion.', 403);
  const name = normalizeText(req.body?.nombre);
  if (!name) return fail(res, 'PROYECTO_INVALID_PAYLOAD', 'Nombre de cotizacion requerido.', 400);
  const created = await createRow(COLLECTIONS.projects, {
    ownerId: req.params.ownerId,
    name,
    address: normalizeText(req.body?.direccionObra),
    items: normalizeItems(req.body?.items),
    status: 'pendiente',
    createdAt: nowIso(),
    statusUpdatedAt: nowIso()
  });
  return ok(res, await projectView(created), 201);
});

mvpRouter.get('/maestros/:ownerId/proyectos/:projectId', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  return ok(res, await projectView(project));
});

mvpRouter.put('/maestros/:ownerId/proyectos/:projectId', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const updated = await patchRow(COLLECTIONS.projects, req.params.projectId, {
    name: normalizeText(req.body?.nombre) || project.name,
    address: normalizeText(req.body?.direccionObra),
    items: normalizeItems(req.body?.items),
    updatedAt: nowIso()
  });
  return ok(res, await projectView(updated));
});

mvpRouter.post('/maestros/:ownerId/proyectos/:projectId/items', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const nextItems = [...normalizeItems(project.items), ...normalizeItems([req.body])];
  const updated = await patchRow(COLLECTIONS.projects, req.params.projectId, { items: nextItems, updatedAt: nowIso() });
  return ok(res, await projectView(updated), 201);
});

mvpRouter.patch('/maestros/:ownerId/proyectos/:projectId/estado', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const status = req.body?.estado;
  if (!['pendiente', 'aceptada', 'rechazada'].includes(status)) return fail(res, 'COTIZACION_INVALID_STATUS', 'Estado invalido.', 400);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  const updated = await patchRow(COLLECTIONS.projects, req.params.projectId, { status, statusUpdatedAt: nowIso() });
  return ok(res, await projectView(updated));
});

mvpRouter.delete('/maestros/:ownerId/proyectos/:projectId', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos para esta cotizacion.', 403);
  const project = await row(COLLECTIONS.projects, req.params.projectId);
  if (!project || project.ownerId !== req.params.ownerId) return fail(res, 'PROYECTO_NOT_FOUND', 'No existe la cotizacion indicada.', 404);
  await db.collection(COLLECTIONS.projects).doc(req.params.projectId).delete();
  return ok(res, { deleted: true });
});

mvpRouter.post('/cotizaciones/optimizar', requireAuth, async (req, res) => {
  return ok(res, await optimizeItems(normalizeItems(req.body?.items)));
});

mvpRouter.get('/maestros/:ownerId/resumen', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos.', 403);
  const projects = (await rows(COLLECTIONS.projects)).filter((item) => item.ownerId === req.params.ownerId);
  const views = await Promise.all(projects.map(projectView));
  return ok(res, {
    activeProjects: views.filter((item) => item.status === 'pendiente').length,
    estimatedSaving: views.reduce((acc, item) => acc + numberValue(item.saving), 0),
    topSearches: []
  });
});

// MVP has no paid tiers yet: capacities are intentionally unlimited.
mvpRouter.get('/maestros/:ownerId/capacidad-cotizaciones', requireAuth, async (req, res) => {
  if (!canAccessOwner(req, req.params.ownerId)) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos.', 403);
  return ok(res, { allowed: true, pendingCount: 0, limit: null, remaining: null, message: '' });
});

mvpRouter.get('/ferreterias/:storeId/capacidad-catalogo', requireAuth, async (req, res) => {
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  if (req.authRole !== 'admin' && req.authUserId !== store.usuarioDuenoId) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos.', 403);
  const currentCount = (await rows(COLLECTIONS.storeProducts)).filter((item) => item.ferreteriaId === req.params.storeId).length;
  return ok(res, { allowed: true, currentCount, limit: null, remaining: null, message: '' });
});

mvpRouter.get('/ferreterias/:storeId/metricas-mvp', requireAuth, async (req, res) => {
  const store = await row(COLLECTIONS.stores, req.params.storeId);
  if (!store) return fail(res, 'FERRETERIA_NOT_FOUND', 'No existe la ferreteria indicada.', 404);
  if (req.authRole !== 'admin' && req.authUserId !== store.usuarioDuenoId) return fail(res, 'AUTH_FORBIDDEN', 'No tienes permisos.', 403);
  const offers = (await rows(COLLECTIONS.storeProducts)).filter((item) => item.ferreteriaId === req.params.storeId && item.activo !== false);
  const published = offers.filter((item) => item.publicado !== false);
  return ok(res, {
    totalProducts: offers.length,
    publishedProducts: published.length,
    lowStockProducts: offers.filter((item) => numberValue(item.stock) > 0 && numberValue(item.stock) < 15).length,
    outOfStockProducts: offers.filter((item) => numberValue(item.stock) === 0).length,
    avgPricePublished: published.length ? Math.round(published.reduce((acc, item) => acc + numberValue(item.precio), 0) / published.length) : 0,
    quotationReach: 0
  });
});

// Product creation requests (kept simple for MVP).
mvpRouter.post('/ferreterias/:storeId/solicitudes-creacion-producto', requireAuth, async (req, res) => {
  if (!(await requireStoreWriteAccess(req, res, req.params.storeId))) return;
  const created = await createRow(COLLECTIONS.productRequests, {
    ferreteriaId: req.params.storeId,
    usuarioSolicitanteId: req.authUserId,
    usuarioAdminId: null,
    nombreProducto: normalizeText(req.body?.nombreProducto),
    codigoBarras: normalizeText(req.body?.codigoBarras),
    cantidadReferencia: Math.max(1, Math.floor(numberValue(req.body?.cantidadReferencia, 1))),
    precioReferencia: Math.max(0, numberValue(req.body?.precioReferencia)),
    estado: 'pendiente',
    productoMaestroSugeridoId: null,
    notasAdmin: '',
    fechaCreacion: nowIso(),
    fechaResolucion: null
  });
  return ok(res, created, 201);
});

mvpRouter.get('/solicitudes-creacion-producto', requireAuth, requireRole('admin'), async (req, res) => {
  const status = normalizeText(req.query['estado']);
  const storeId = normalizeText(req.query['ferreteriaId']);
  const data = (await rows(COLLECTIONS.productRequests))
    .filter((item) => !status || item.estado === status)
    .filter((item) => !storeId || item.ferreteriaId === storeId)
    .sort((a, b) => normalizeText(b.fechaCreacion).localeCompare(normalizeText(a.fechaCreacion)));
  return ok(res, data);
});

mvpRouter.post('/solicitudes-creacion-producto/:id/resolver', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.productRequests, req.params.id);
  if (!current) return fail(res, 'SOLICITUD_NOT_FOUND', 'No existe la solicitud indicada.', 404);
  const action = req.body?.accion;
  if (!['aprobar', 'rechazar'].includes(action)) return fail(res, 'SOLICITUD_INVALID_PAYLOAD', 'Accion invalida.', 400);
  const updated = await patchRow(COLLECTIONS.productRequests, req.params.id, {
    estado: action === 'aprobar' ? 'aprobada' : 'rechazada',
    usuarioAdminId: req.authUserId,
    productoMaestroSugeridoId: normalizeText(req.body?.productoMaestroSugeridoId) || null,
    notasAdmin: normalizeText(req.body?.notaAdmin),
    fechaResolucion: nowIso()
  });
  return ok(res, updated);
});

// Admin users.
mvpRouter.get('/admin/usuarios', requireAuth, requireRole('admin'), async (_req, res) => {
  return ok(res, await Promise.all((await rows(COLLECTIONS.users)).map((item) => authUserResponse(item.id))));
});

mvpRouter.post('/admin/usuarios', requireAuth, requireRole('admin'), async (req, res) => {
  const role = req.body?.rol;
  if (!validRole(role)) return fail(res, 'ADMIN_INVALID_ROLE', 'Rol invalido.', 400);
  const firebaseUser = await adminAuth.createUser({
    email: normalizeText(req.body?.correo).toLowerCase(),
    password: normalizeText(req.body?.password),
    displayName: normalizeText(req.body?.nombre)
  });
  await db.collection(COLLECTIONS.users).doc(firebaseUser.uid).set({
    rol: role,
    nombre: normalizeText(req.body?.nombre),
    correo: normalizeText(req.body?.correo).toLowerCase(),
    telefono: normalizeText(req.body?.telefono),
    ciudad: normalizeText(req.body?.ciudad),
    comuna: normalizeText(req.body?.comuna),
    direccion: normalizeText(req.body?.direccion),
    planSuscripcion: req.body?.planSuscripcion || 'basico',
    estadoCuenta: req.body?.estadoCuenta || 'activo',
    creadoEn: nowIso()
  });
  if (role === 'ferreteria') {
    await createRow(COLLECTIONS.stores, {
      usuarioDuenoId: firebaseUser.uid,
      nombreComercial: normalizeText(req.body?.nombreComercial) || normalizeText(req.body?.nombre),
      rut: normalizeText(req.body?.rut),
      estado: 'activo',
      creadoEn: nowIso()
    });
  }
  return ok(res, await authUserResponse(firebaseUser.uid), 201);
});

mvpRouter.patch('/admin/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.users, req.params.id);
  if (!current) return fail(res, 'AUTH_USER_NOT_FOUND', 'Usuario no encontrado.', 404);
  const allowed = ['rol', 'nombre', 'telefono', 'ciudad', 'comuna', 'direccion', 'planSuscripcion', 'estadoCuenta'];
  const patch: Record<string, unknown> = {};
  allowed.forEach((key) => { if (req.body?.[key] !== undefined) patch[key] = req.body[key]; });
  await db.collection(COLLECTIONS.users).doc(req.params.id).set(patch, { merge: true });
  return ok(res, await authUserResponse(req.params.id));
});

mvpRouter.delete('/admin/usuarios/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const stores = (await rows(COLLECTIONS.stores)).filter((item) => item.usuarioDuenoId === req.params.id);
  for (const store of stores) {
    const offers = (await rows(COLLECTIONS.storeProducts)).filter((item) => item.ferreteriaId === store.id);
    await deleteRowsByIds(COLLECTIONS.storeProducts, offers.map((item) => item.id));
    await db.collection(COLLECTIONS.stores).doc(store.id).delete();
  }
  await db.collection(COLLECTIONS.users).doc(req.params.id).delete();
  try { await adminAuth.deleteUser(req.params.id); } catch { /* profile may predate Firebase Auth */ }
  return ok(res, { deleted: true });
});

mvpRouter.get('/admin/metricas', requireAuth, requireRole('admin'), async (_req, res) => {
  const [users, products, requests, projects] = await Promise.all([
    rows(COLLECTIONS.users), rows(COLLECTIONS.masterProducts), rows(COLLECTIONS.productRequests), rows(COLLECTIONS.projects)
  ]);
  return ok(res, {
    totalUsuarios: users.length,
    nuevosUsuarios: users.filter((item) => Date.parse(item.creadoEn || '') >= Date.now() - 30 * 86400000).length,
    usuariosPago: 0,
    usuariosActivos: users.filter((item) => item.estadoCuenta !== 'bloqueado').length,
    maestros: users.filter((item) => item.rol === 'maestro').length,
    ferreterias: users.filter((item) => item.rol === 'ferreteria').length,
    cotizaciones: projects.length,
    cotizacionesRechazadas: projects.filter((item) => item.status === 'rechazada').length,
    cotizacionesAceptadas: projects.filter((item) => item.status === 'aceptada').length,
    productosMaestro: products.length,
    solicitudesPendientes: requests.filter((item) => item.estado === 'pendiente').length
  });
});

// Do not expose advanced paid plan behavior in the MVP.
mvpRouter.get('/planes/maestro/:code/capacidades', requireAuth, async (_req, res) => ok(res, {
  plan: 'mvp', label: 'MVP', maxPendingQuotations: null, hasHistory: true
}));
mvpRouter.get('/planes/ferreteria/:code/capacidades', requireAuth, async (_req, res) => ok(res, {
  plan: 'mvp', label: 'MVP', maxCatalogProducts: null, allowCsvImport: false, allowAdvancedMetrics: false
}));
