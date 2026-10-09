import { invalidateStaticCatalog } from '../lib/product-sheet-cache.js';
import { markPublicCatalogDirty } from '../lib/public-catalog-cache.js';
import { Router, type Request, type Response } from 'express';
import { db } from '../lib/firebase.js';
import { requireAuth, requireRole } from '../lib/auth.js';
import { fail, ok } from '../lib/http.js';
import { COLLECTIONS } from '../lib/collections.js';
import { nowIso, normalizeText, numberValue } from '../lib/values.js';
import { rows, row, createRow, patchRow, deleteRowsByIds } from '../repositories/firestore.repository.js';
import { resolveProductBrand } from '../lib/brands.js';
export const masterProductsRouter = Router();

const validImageSources = ['external_url', 'ai_generated', 'manufacturer_authorized', 'store_authorized', 'licensed_stock', 'original', 'other'];
const validContentSources = ['manufacturer_authorized', 'store_authorized', 'licensed', 'original', 'ai_assisted_original', 'public_domain', 'other'];

function additionalFields(body: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (Array.isArray(body['caracteristicasDestacadas'])) fields['caracteristicasDestacadas'] = body['caracteristicasDestacadas'].map(value => normalizeText(value).slice(0, 500)).filter(Boolean).slice(0, 30);
  for (const key of ['pesoLogisticoKg', 'volumenLogisticoM3', 'unidadesPorPallet']) {
    if (body[key] !== undefined) fields[key] = body[key] === null ? null : Math.max(0, numberValue(body[key]));
  }
  for (const key of ['imagenStorageUrl','imagenExternaUrl','imagenStoragePath','imagenMiniaturaUrl','imagenMiniaturaPath']) if(body[key] !== undefined) {
    const value=normalizeText(body[key]);
    fields[key]=key.endsWith('Path') ? value : (/^https:\/\//i.test(value) ? value : '');
  }
  if(body['imagenStorageUrl'] !== undefined || body['imagenExternaUrl'] !== undefined)
    fields['imagenPrincipalUrl']=fields['imagenStorageUrl'] || fields['imagenExternaUrl'] || normalizeText(body['imagenPrincipalUrl']);
  return fields;
}

function imageRightsPayload(body: Record<string, any>, reviewerId: string | undefined): Record<string, unknown> | null {
  const imageUrl = normalizeText(body?.['imagenPrincipalUrl']);
  const gallery = Array.isArray(body?.['galeriaJson']) ? body['galeriaJson'].filter((item: unknown) => normalizeText(item)) : [];
  if (!imageUrl && gallery.length === 0) return {};
  const sourceType = normalizeText(body?.['origenImagen']);
  const provider = normalizeText(body?.['proveedorImagen']).slice(0, 200);
  const sourceTermsUrl = normalizeText(body?.['terminosFuenteUrl']).slice(0, 1000);
  const authorizationReference = normalizeText(body?.['referenciaAutorizacion']).slice(0, 500);
  const containsThirdPartyMarks = body?.['contieneMarcasTerceros'] === true;
  const trademarkAuthorizationReference = normalizeText(body?.['referenciaAutorizacionMarca']).slice(0, 500);
  if(sourceType==='external_url') {
    try {const url=new URL(imageUrl);if(url.protocol!=='https:'||url.username||url.password)return null;return {origenImagen:sourceType,proveedorImagen:provider||url.hostname,referenciaAutorizacion:null,derechosRevisadosEn:null,derechosRevisadosPor:null};}
    catch {return null;}
  }
  if (!validImageSources.includes(sourceType) || provider.length < 2 || authorizationReference.length < 3) return null;
  if ((sourceType === 'ai_generated' || sourceType === 'licensed_stock') && !/^https?:\/\//i.test(sourceTermsUrl)) return null;
  if (containsThirdPartyMarks && trademarkAuthorizationReference.length < 3) return null;
  return {
    origenImagen: sourceType,
    proveedorImagen: provider,
    terminosFuenteUrl: sourceTermsUrl || null,
    referenciaAutorizacion: authorizationReference,
    contieneMarcasTerceros: containsThirdPartyMarks,
    referenciaAutorizacionMarca: containsThirdPartyMarks ? trademarkAuthorizationReference : null,
    derechosRevisadosEn: nowIso(),
    derechosRevisadosPor: reviewerId || null
  };
}

function contentRightsPayload(body: Record<string, any>, reviewerId: string | undefined): Record<string, unknown> | null {
  const sourceType = normalizeText(body?.['origenContenido']);
  const sourceUrl = normalizeText(body?.['fuenteContenidoUrl']).slice(0, 1000);
  const authorizationReference = normalizeText(body?.['referenciaDerechosContenido']).slice(0, 500);
  if (!validContentSources.includes(sourceType) || authorizationReference.length < 3) return null;
  return {
    origenContenido: sourceType,
    fuenteContenidoUrl: sourceUrl || null,
    referenciaDerechosContenido: authorizationReference,
    derechosContenidoRevisadosEn: nowIso(),
    derechosContenidoRevisadosPor: reviewerId || null
  };
}

masterProductsRouter.get('/marcas', async (_req, res) => {
  const brands = (await rows(COLLECTIONS.brands)).map(item => ({ id: item.id, nombre: item.nombre })).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  return ok(res, brands);
});

masterProductsRouter.get('/productos-maestro', async (req, res) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const data = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => item.estado !== 'inactivo')
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q) || normalizeText(item.codigoBarras).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  return ok(res, data);
});

const listMasterPage = async (req: Request, res: Response) => {
  const q = normalizeText(req.query['query']).toLowerCase();
  const categoryId = normalizeText(req.query['categoriaId']);
  const subcategoryId = normalizeText(req.query['subcategoriaId']);
  const familyId = normalizeText(req.query['familiaId']);
  const excluded = new Set(normalizeText(req.query['excludeProductoMaestroIds']).split(',').filter(Boolean));
  const page = Math.max(1, Math.floor(numberValue(req.query['page'], 1)));
  const size = Math.min(100, Math.max(1, Math.floor(numberValue(req.query['size'], 25))));
  const all = (await rows(COLLECTIONS.masterProducts))
    .filter((item) => req.authRole === 'admin' || item.estado !== 'inactivo')
    .filter((item) => !excluded.has(item.id))
    .filter((item) => !q || normalizeText(item.nombre).toLowerCase().includes(q) || normalizeText(item.marca).toLowerCase().includes(q) || normalizeText(item.codigoBarras).toLowerCase().includes(q))
    .filter((item) => !categoryId || item.categoriaId === categoryId)
    .filter((item) => !subcategoryId || item.subcategoriaId === subcategoryId)
    .filter((item) => !familyId || item.familiaId === familyId)
    .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, totalPages);
  const items = all.slice((safePage - 1) * size, safePage * size);
  return ok(res, { items, page: safePage, size, total, totalPages });
};

masterProductsRouter.get('/admin/productos-maestro/paginado', requireAuth, requireRole('admin'), listMasterPage);
masterProductsRouter.get('/productos-maestro/paginado', listMasterPage);

const masterDetail = async (req: Request, res: Response) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product || (product.estado === 'inactivo' && req.authRole !== 'admin')) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const atributos = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === product.id);
  return ok(res, { ...product, atributos });
};
masterProductsRouter.get('/admin/productos-maestro/:id', requireAuth, requireRole('admin'), masterDetail);
masterProductsRouter.get('/productos-maestro/:id', masterDetail);

masterProductsRouter.post('/productos-maestro', requireAuth, requireRole('admin'), async (req, res) => {
  const nombre = normalizeText(req.body?.nombre);
  if (!nombre) return fail(res, 'PRODUCTO_MAESTRO_INVALID_PAYLOAD', 'Nombre requerido.', 400);
  const imageRights = imageRightsPayload(req.body || {}, req.authUserId);
  if (imageRights === null) return fail(res, 'PRODUCT_IMAGE_RIGHTS_REQUIRED', 'Registra el origen, proveedor y respaldo de derechos de la imagen. Las marcas de terceros requieren autorización específica.', 400);
  const contentRights = contentRightsPayload(req.body || {}, req.authUserId);
  if (contentRights === null) return fail(res, 'PRODUCT_CONTENT_RIGHTS_REQUIRED', 'Registra la fuente o autorización de las descripciones y fichas del producto.', 400);
  const created = await createRow(COLLECTIONS.masterProducts, {
    categoriaId: normalizeText(req.body?.categoriaId),
    subcategoriaId: normalizeText(req.body?.subcategoriaId),
    familiaId: normalizeText(req.body?.familiaId),
    nombre,
    tipoProducto: normalizeText(req.body?.tipoProducto),
    unidadVenta: normalizeText(req.body?.unidadVenta),
    presentacion: normalizeText(req.body?.presentacion),
    ...await resolveProductBrand(req.body?.marca),
    codigoBarras: normalizeText(req.body?.codigoBarras),
    descripcionCorta: normalizeText(req.body?.descripcionCorta),
    descripcionLarga: normalizeText(req.body?.descripcionLarga),
    imagenPrincipalUrl: normalizeText(req.body?.imagenPrincipalUrl),
    galeriaJson: Array.isArray(req.body?.galeriaJson) ? req.body.galeriaJson : [],
    ...imageRights,
    ...contentRights,
    ...additionalFields(req.body || {}),
    estado: req.body?.estado === 'inactivo' ? 'inactivo' : 'activo',
    creadoEn: nowIso()
  });
  await Promise.all([invalidateStaticCatalog(), markPublicCatalogDirty()]);
  return ok(res, created, 201);
});

masterProductsRouter.patch('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const current = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!current) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const nextImageUrl = req.body?.imagenPrincipalUrl !== undefined ? req.body.imagenPrincipalUrl : current.imagenPrincipalUrl;
  const rightsInput = { ...current, ...(req.body || {}), imagenPrincipalUrl: nextImageUrl };
  // The existing editor changes one URL; keep its replacement/removal semantics.
  if(req.body?.imagenPrincipalUrl !== undefined && req.body?.imagenExternaUrl === undefined
    && nextImageUrl !== (req.body?.imagenStorageUrl || current.imagenStorageUrl)) {
    rightsInput.imagenExternaUrl=nextImageUrl;
    if(current.imagenStorageUrl && req.body?.imagenStorageUrl === undefined) {rightsInput.imagenStorageUrl='';rightsInput.imagenStoragePath='';rightsInput.imagenMiniaturaUrl='';rightsInput.imagenMiniaturaPath='';}
  }
  const imageRights = imageRightsPayload(rightsInput, req.authUserId);
  if (imageRights === null) return fail(res, 'PRODUCT_IMAGE_RIGHTS_REQUIRED', 'Registra el origen, proveedor y respaldo de derechos de la imagen. Las marcas de terceros requieren autorización específica.', 400);
  const contentRights = contentRightsPayload(rightsInput, req.authUserId);
  if (contentRights === null) return fail(res, 'PRODUCT_CONTENT_RIGHTS_REQUIRED', 'Registra la fuente o autorización de las descripciones y fichas del producto.', 400);
  const allowed = [
    'categoriaId', 'subcategoriaId', 'familiaId', 'nombre', 'marca', 'codigoBarras',
    'descripcionCorta', 'descripcionLarga', 'imagenPrincipalUrl', 'galeriaJson', 'estado', 'tipoProducto', 'unidadVenta', 'presentacion'
  ];
  const patch: Record<string, unknown> = { ...imageRights, ...contentRights, ...additionalFields(rightsInput), actualizadoEn: nowIso() };
  allowed.forEach((key) => { if (req.body?.[key] !== undefined) patch[key] = req.body[key]; });
  Object.assign(patch, await resolveProductBrand(req.body?.marca !== undefined ? req.body.marca : current.marca));
  const updated = await patchRow(COLLECTIONS.masterProducts, req.params.id, patch);
  if (updated) await Promise.all([invalidateStaticCatalog(), markPublicCatalogDirty()]);
  return updated ? ok(res, updated) : fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
});

masterProductsRouter.put('/productos-maestro/:id/atributos', requireAuth, requireRole('admin'), async (req, res) => {
  const product = await row(COLLECTIONS.masterProducts, req.params.id);
  if (!product) return fail(res, 'PRODUCTO_MAESTRO_NOT_FOUND', 'No existe el producto maestro.', 404);
  const current = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, current.map((item) => item.id));
  const result: any[] = [];
  for (const item of Array.isArray(req.body) ? req.body : []) {
    result.push(await createRow(COLLECTIONS.masterAttributes, { productoMaestroId: req.params.id, ...item }));
  }
  await invalidateStaticCatalog();
  return ok(res, result);
});

masterProductsRouter.delete('/productos-maestro/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.collection(COLLECTIONS.masterProducts).doc(req.params.id).delete();
  const attributes = (await rows(COLLECTIONS.masterAttributes)).filter((item) => item.productoMaestroId === req.params.id);
  await deleteRowsByIds(COLLECTIONS.masterAttributes, attributes.map((item) => item.id));
  await Promise.all([invalidateStaticCatalog(), markPublicCatalogDirty()]);
  return ok(res, { deleted: true });
});

// Search/comparison.
