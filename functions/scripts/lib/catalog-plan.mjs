export function catalogSlug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function buildCatalogDocuments(plan, timestamp) {
  const tables = ['categories', 'subcategories', 'families', 'productTypes'];
  for (const table of tables) {
    if (!Array.isArray(plan[table]) || !plan[table].length) throw new Error(`Inventario inválido: ${table}`);
    const ids = new Set();
    for (const item of plan[table]) {
      if (!item.id || item.id.includes('/') || !item.name?.trim() || ids.has(item.id)) throw new Error(`ID/nombre inválido o duplicado en ${table}`);
      ids.add(item.id);
    }
  }
  const categories = new Map(plan.categories.map(item => [item.id, item]));
  const subcategories = new Map(plan.subcategories.map(item => [item.id, item]));
  const families = new Map(plan.families.map(item => [item.id, item]));
  const result = [];
  const add = (collection, id, data) => result.push({ collection, id, data: { ...data, catalogoPlanVersion: plan.version, catalogoPlanFecha: plan.date } });
  for (const item of categories.values()) add('categorias', item.id, { nombre: item.name });
  for (const item of subcategories.values()) {
    if (!categories.has(item.parentId)) throw new Error(`Categoría inexistente: ${item.id}`);
    add('subcategorias', item.id, { nombre: item.name, categoriaId: item.parentId });
  }
  for (const family of families.values()) {
    if (subcategories.get(family.parentId)?.parentId !== family.categoryId) throw new Error(`Jerarquía inválida: ${family.id}`);
    add('familias', family.id, { nombre: family.name, subcategoriaId: family.parentId });
    const productTypes = plan.productTypes.filter(item => item.familyId === family.id).map(item => item.name);
    const fields = ['Tipo de producto', ...family.attributesToResearch];
    const codes = new Set();
    fields.forEach((label, order) => {
      const code = order === 0 ? 'tipo_producto' : catalogSlug(label).replaceAll('-', '_');
      if (codes.has(code)) throw new Error(`Atributo duplicado: ${family.id}/${code}`);
      codes.add(code);
      const unit = label.match(/\b(mm²|mm|kg|m²|m2|V|W)$/)?.[1] || '';
      const numeric = !!unit && !label.includes(';') && !/nominal y|\bo\b| y |masa por|sección nominal/.test(label);
      add('definicionesAtributoFamilia', `${family.id}--${code}`, {
        familiaId: family.id, codigo: code, etiqueta: label, tipoDato: order === 0 ? 'seleccion' : numeric ? 'numero' : 'texto',
        esFiltrable: !/ficha|document|condicion|seguridad/.test(label), esObligatorio: order === 0 || (family.requiredAttributes || []).includes(label),
        opcionesJson: order === 0 ? productTypes : [], unidad: unit, orden: order
      });
    });
  }
  for (const item of plan.productTypes) {
    const family = families.get(item.familyId);
    if (!family || item.commercialSku !== false || item.status !== 'propuesto') throw new Error(`Tipo propuesto inválido: ${item.id}`);
    const id = `base-${item.id}`;
    add('productosMaestro', id, {
      nombre: item.name, tipoProducto: item.name, marca: 'Por especificar', codigoBarras: '',
      categoriaId: family.categoryId, subcategoriaId: family.parentId, familiaId: family.id,
      unidadVenta: 'Por especificar', presentacion: 'Por especificar',
      descripcionCorta: '', descripcionLarga: '', imagenPrincipalUrl: '', galeriaJson: [],
      origenContenido: 'original', fuenteContenidoUrl: '', referenciaDerechosContenido: 'CotizApp: inventario editorial propio 2026-10-05',
      estado: 'activo', catalogoNivel: 'tipo_base', tandaCatalogo: item.batch,
      creadoEn: timestamp
    });
    add('atributosProductoMaestro', `${id}--tipo_producto`, {
      productoMaestroId: id, definicionAtributoId: `${family.id}--tipo_producto`, codigo: 'tipo_producto',
      etiqueta: 'Tipo de producto', valorOpcion: item.name, valorTexto: null, valorNumero: null, valorBooleano: null
    });
  }
  return result;
}

// Preserve existing and administrator-edited records on every repeat run.
export function classifyCatalogDocuments(documents, existing) {
  const create = [], skipped = [], conflicts = [];
  for (const doc of documents) {
    const path = `${doc.collection}/${doc.id}`;
    const current = existing.get(path);
    if (!current) create.push(doc);
    else if (['categorias', 'subcategorias', 'familias', 'definicionesAtributoFamilia'].includes(doc.collection)
      && ['nombre', 'categoriaId', 'subcategoriaId', 'familiaId', 'codigo'].some(key => doc.data[key] !== undefined && current[key] !== doc.data[key])) conflicts.push(path);
    else skipped.push(path);
  }
  return { create, skipped, conflicts };
}
