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
  if (!canAccessOwner(req, req.params