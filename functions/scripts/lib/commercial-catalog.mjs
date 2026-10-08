import {catalogSlug} from './catalog-plan.mjs';
import {brandIdentity} from '../../lib/domain/brand-identity.js';

export function buildCommercialDocuments(batch, plan, timestamp) {
 const brands=new Map(batch.brands.map(brand=>[brand.name,brand]));
 const families=new Map(plan.families.map(family=>[family.id,family]));
 const documents=[];const seen=new Set();
 const add=(collection,id,data)=>{
  const key=`${collection}/${id}`;
  if(seen.has(key))throw new Error(`Identidad repetida: ${key}`);
  seen.add(key);documents.push({collection,id,data});
 };
 for(const brand of brands.values()) {
  const identity=brandIdentity(brand.name);if(!identity)throw new Error('Marca comercial inválida');
  add('marcas',identity.id,{nombre:identity.nombre,nombreNormalizado:identity.nombreNormalizado,creadoEn:timestamp});
 }
 const extraDefinitions=new Set();
 for(const product of batch.products) {
  const brand=brands.get(product.brand),family=families.get(product.familyId);
  if(!brand || !family || !brand.familyIds.includes(family.id))throw new Error(`Marca/familia incompatible: ${product.name}`);
  const source=new URL(product.sourceUrl);
  if(source.protocol!=='https:' || !brand.sourceHosts.includes(source.hostname))throw new Error(`Fuente incompatible: ${product.name}`);
  if(!product.name?.trim() || !product.model?.trim() || !product.packaging?.trim())throw new Error('Falta identidad comercial');
  const identity=brandIdentity(product.brand);
  const id=`comercial-${catalogSlug(product.name)}`;
  const attributes={'Tipo de producto':product.productType,'presentación':product.packaging,...product.attributes};
  const allowed=new Set(['Tipo de producto',...family.attributesToResearch,...(family.id==='fam-selladores-y-espumas'?['color']:[])]);
  for(const [label,value] of Object.entries(attributes)) {
   if(!allowed.has(label))throw new Error(`Atributo no definido: ${family.id}/${label}`);
   const code=label==='Tipo de producto'?'tipo_producto':catalogSlug(label).replaceAll('-','_');
   const definitionId=`${family.id}--${code}`;
   if(label==='color' && !family.attributesToResearch.includes(label) && !extraDefinitions.has(definitionId)) {
    extraDefinitions.add(definitionId);
    add('definicionesAtributoFamilia',definitionId,{familiaId:family.id,codigo:code,etiqueta:label,tipoDato:'texto',esFiltrable:true,esObligatorio:false,opcionesJson:[],unidad:'',orden:family.attributesToResearch.length+1});
   }
   const numeric=/\b(mm|kg|W|V)$/.test(label);
   if(numeric && (typeof value!=='number' || !Number.isFinite(value) || value<=0))throw new Error(`Medida inválida: ${product.name}/${label}`);
   add('atributosProductoMaestro',`${id}--${code}`,{productoMaestroId:id,definicionAtributoId:definitionId,codigo:code,etiqueta:label,
    valorOpcion:code==='tipo_producto'?String(value):null,valorTexto:!numeric && code!=='tipo_producto'?String(value):null,valorNumero:numeric?value:null,valorBooleano:null});
  }
  add('productosMaestro',id,{
   nombre:product.name,tipoProducto:product.productType,marca:identity.nombre,marcaId:identity.id,
   modelo:product.model,codigoFabricante:product.manufacturerCode || '',codigoBarras:'',
   categoriaId:family.categoryId,subcategoriaId:family.parentId,familiaId:family.id,
   unidadVenta:product.unit,presentacion:product.packaging,
   descripcionCorta:`${product.productType} ${identity.nombre}. ${product.packaging}.`,
   descripcionLarga:product.note || '',imagenPrincipalUrl:'',galeriaJson:[],
   origenContenido:'original',fuenteContenidoUrl:source.href,
   referenciaDerechosContenido:`CotizApp: identificación y atributos factuales con redacción propia; ${batch.version}. Sin reproducción de imágenes o textos comerciales.`,
   evidenciaCatalogo:{fuenteUrl:source.href,consultadoEn:batch.date,modo:product.evidenceMode,modelo:product.model,codigoFabricante:product.manufacturerCode || ''},
   estado:'activo',catalogoNivel:'producto_comercial',tandaCatalogo:batch.version,creadoEn:timestamp
  });
 }
 return documents;
}

export function classifyCommercialDocuments(documents,existing) {
 const create=[],skipped=[],conflicts=[];
 for(const doc of documents) {
  const key=`${doc.collection}/${doc.id}`,current=existing.get(key);
  if(!current)create.push(doc);
  else {
   const keys=doc.collection==='productosMaestro'?['marcaId','familiaId']:doc.collection==='marcas'?['nombreNormalizado']:doc.collection==='atributosProductoMaestro'?['productoMaestroId','definicionAtributoId']:['familiaId','codigo'];
   if(keys.some(field=>current[field]!==doc.data[field]))conflicts.push(key);else skipped.push(key);
  }
 }
 return {create,skipped,conflicts};
}
