import mappings from './source-mapping.json' with {type:'json'};
import columns from './table-columns.json' with {type:'json'};
import type {Data} from './port.js';
import {sqlSchemaVariant} from './config.js';

export const sqlTableName=(table:string):string=>sqlSchemaVariant()==='compact'&&table==='offers'?'store_products':table;

export interface CompactField {source:string;column:string;dataType:string;}
const identifier=(value:string)=>'"'+value.replaceAll('"','""')+'"';
const literal=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const overrides:Record<string,Record<string,string>>={
 products:{marca:'legacy_brand_label',modelo:'model_label',codigoFabricante:'manufacturer_code',evidenciaCatalogo:'catalog_evidence',caracteristicasDestacadas:'features'},
 quotations:{singleStoreId:'single_store_reference'},
 offer_history:{ferreteriaId:'store_reference',productoFerreteriaId:'offer_reference',productoMaestroId:'product_reference'},
 store_agreements:{ferreteriaId:'store_reference'},
 price_reports:{storeId:'store_reference',offerId:'offer_reference'}
};
const fieldCache=new Map<string,CompactField[]>();
export function compactFields(table:string):CompactField[]{
 const cached=fieldCache.get(table);if(cached)return cached;
 const mapping=Object.values(mappings).find(value=>value.tables[0]===table&&value.sourceCollection!=='real_projectOwnerLocks');
 const fields=new Map<string,string>();
 for(const [source,target]of Object.entries(mapping?.fields||{})){
  const match=new RegExp('^'+table+'\\.([a-z_][a-z0-9_]*)$').exec(target);
  if(match&&columns.some(col=>col.table_name===table&&col.column_name===match[1]))fields.set(source,match[1]);
 }
 for(const [source,column]of Object.entries(overrides[table]||{}))fields.set(source,column);
 const result=[...fields].map(([source,column])=>({source,column,dataType:column==='features'?'ARRAY':columns.find(col=>col.table_name===table&&col.column_name===column)?.data_type||'text'}));
 fieldCache.set(table,result);return result;
}
function jsonType(value:unknown):string{return value===null?'null':Array.isArray(value)?'array':typeof value;}
const equalJson=(left:unknown,right:unknown):boolean=>{
 if(left===right)return true;
 if(Array.isArray(left)&&Array.isArray(right))return left.length===right.length&&left.every((value,index)=>equalJson(value,right[index]));
 if(left&&right&&typeof left==='object'&&typeof right==='object'){
  const a=Object.keys(left),b=Object.keys(right);return a.length===b.length&&a.every(key=>Object.hasOwn(right,key)&&equalJson((left as Data)[key],(right as Data)[key]));
 }
 return false;
};
function storedValue(field:CompactField,value:unknown):unknown{
 if(value===null||value===undefined)return null;
 if(field.dataType==='timestamp with time zone'||field.dataType==='timestamp without time zone')return new Date(value as string).toISOString();
 if(field.dataType==='date')return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);
 if(['numeric','bigint','integer','smallint','real','double precision'].includes(field.dataType))return Number(value);
 if(field.dataType==='jsonb'||field.dataType==='json')return typeof value==='string'?JSON.parse(value):value;
 if(field.dataType==='ARRAY')return value;
 if(field.dataType==='boolean')return value;
 return String(value);
}
/** Only move a value when SQL can reproduce the original JSON exactly. */
export function packCompactDocument(table:string,input:Data,values:Data):{api_fields:Data;api_extra:Data}{
 const api_fields:Data={},api_extra:Data={...input};
 for(const field of compactFields(table)){
  if(!Object.hasOwn(input,field.source)||!Object.hasOwn(values,field.column))continue;
  let restored:unknown;try{restored=storedValue(field,values[field.column]);}catch{continue;}
  if(equalJson(input[field.source],restored)){
   api_fields[field.source]=jsonType(input[field.source]);delete api_extra[field.source];
  }
 }
 return {api_fields,api_extra};
}
export function compactColumnJson(field:CompactField,alias?:string):string{
 const column=(alias?identifier(alias)+'.':'')+identifier(field.column);
 if(field.dataType==='timestamp with time zone')return `to_jsonb(to_char(${column} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;
 if(field.dataType==='timestamp without time zone')return `to_jsonb(to_char(${column},'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))`;
 if(field.dataType==='date')return `to_jsonb(to_char(${column},'YYYY-MM-DD'))`;
 return `to_jsonb(${column})`;
}
/** SQL expression, not a view: typed columns override only explicitly present DTO fields. */
export function compactDocumentSql(table:string,alias?:string):string{
 const prefix=alias?identifier(alias)+'.':'';
 const fields=compactFields(table);
 if(!fields.length)return `${prefix}api_extra`;
 const cases=fields.map(field=>`WHEN ${literal(field.source)} THEN ${compactColumnJson(field,alias)}`).join(' ');
 return `(${prefix}api_extra || COALESCE((SELECT jsonb_object_agg(compact_field.key,CASE compact_field.key ${cases} ELSE NULL::jsonb END) FROM jsonb_each(${prefix}api_fields) AS compact_field),'{}'::jsonb))`;
}
