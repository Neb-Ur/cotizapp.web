import assert from 'node:assert/strict';
const probeVersion = `smoke-${Date.now()}`;
const base = process.env.PRODUCTION_URL || 'https://cotizapp-d71c8.web.app';
async function get(path) {
 const res = await fetch(`${base}${path}`, { headers: { Accept:'text/html, application/json' }, signal:AbortSignal.timeout(45000) });
 return { status:res.status, body:await res.text(), headers:res.headers };
}
const home = await get('/'); assert.equal(home.status,200); assert.match(home.body,/<app-root/);
const {data:catalog} = JSON.parse((await get(`/api/catalogo-publico?v=${probeVersion}`)).body);
assert.ok(Array.isArray(catalog.searchRows) && Array.isArray(catalog.products));
// Test a published offer if present, otherwise an active master product (valid empty pilot).
const name = catalog.searchRows[0]?.productName || catalog.products[0]?.nombre;
if(name) {
 const detail = await get(`/api/productos/detalle?producto=${encodeURIComponent(name)}`);
 assert.equal(detail.status,200); const {data} = JSON.parse(detail.body);
 assert.equal(data.productoMaestro.nombre,name);
 const catalogOfferIds = new Set(catalog.searchRows.filter(row=>row.productName===name).map(row=>row.productoFerreteriaId));
 assert.ok(data.stores.every(store=>catalogOfferIds.has(store.productoFerreteriaId)));
 const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);
 const page = await get(`/productos/${slug}?v=${probeVersion}`); assert.equal(page.status,200);
 assert.match(page.body,/<h1>/); if((catalog.products.find(product=>product.nombre===name)?.isDemo || /demo|test/i.test(String(data.productoMaestro.seedTag || '')) || /demostrativ|generad.*pruebas/i.test(String(data.productoMaestro.descripcionLarga || '')))) assert.match(page.body,/noindex/); else assert.match(page.body, /application\/ld\+json/); assert.ok(page.body.includes(name));
 assert.ok(page.body.includes(`href="${base}/productos/${slug}"`));
}
for (const path of ['/productos/no-existe-qa-cotizapp-404','/ruta-inexistente-qa-cotizapp-404']) {
 const response = await get(path); assert.equal(response.status,404); assert.match(response.body,/noindex/);
}
const privatePage = await get('/cuenta/privacidad-datos'); assert.match(privatePage.headers.get('x-robots-tag') || '', /noindex/);
const invalidApi = await get('/api/productos/detalle?producto=no-existe-qa-cotizapp-404'); assert.equal(invalidApi.status,404);
console.log(`Smoke production passed: ${catalog.products.length} products, ${catalog.searchRows.length} active offers; initial product HTML, canonical, JSON-LD, detail consistency, private noindex, real 404.`);
