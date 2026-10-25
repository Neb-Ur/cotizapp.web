export interface CatalogCalculationSpecs {saleUnit:'caja'|'envase'|'plancha'|'unidad';coveragePerPackage:number|null;litersPerPackage:number|null;paintCoverage:number|null;source:string;}
export function normalizeCatalogCalculationSpecs(v:any):CatalogCalculationSpecs|null {
 if(v==null)return null;
 if(!['caja','envase','plancha','unidad'].includes(v.saleUnit)||typeof v.source!=='string'||v.source.trim().length<5||v.source.length>1000)throw new Error('Indica unidad de venta y fuente verificable de la presentación.');
 const n=(value:any)=>{if(value==null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>10000)throw new Error('El rendimiento y la presentación deben ser positivos.');return value;};
 const specs={saleUnit:v.saleUnit,coveragePerPackage:n(v.coveragePerPackage),litersPerPackage:n(v.litersPerPackage),paintCoverage:n(v.paintCoverage),source:v.source.trim()};
 if(specs.paintCoverage&&(!specs.litersPerPackage||specs.saleUnit!=='envase'))throw new Error('El rendimiento de pintura requiere litros por envase y venta por envase.');
 return specs;
}
