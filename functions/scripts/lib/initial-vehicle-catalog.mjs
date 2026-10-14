import {createHash} from 'node:crypto';
import {brandIdentity,normalizeBrand} from '../../lib/domain/brand-identity.js';
import {brandUses} from '../../lib/domain/brand-use.js';
export function planInitialVehicleCatalog(catalog, brands, models, now) {
  const creates=[],updates=[],references=[];
  for(const entry of catalog.brands) {
    const identity=brandIdentity(entry.name);
    if(!identity)throw new Error('INVALID_VEHICLE_BRAND');
    const matches=brands.filter(b=>normalizeBrand(b.nombre)===identity.nombreNormalizado);
    if(matches.length>1)throw new Error('AMBIGUOUS_VEHICLE_BRAND');
    const existing=matches[0];const brandId=existing?.id || identity.id;
    if(!existing)creates.push({collection:'marcas',id:brandId,data:{nombre:identity.nombre,nombreNormalizado:identity.nombreNormalizado,usos:['vehiculo'],creadoEn:now,actualizadoEn:now}});
    else if(!brandUses(existing.usos).includes('vehiculo'))updates.push({collection:'marcas',id:brandId,data:{usos:[...brandUses(existing.usos),'vehiculo'],actualizadoEn:now}});
    for(const name of entry.models) {
      const normalized=normalizeBrand(name);
      const found=models.filter(m=>m.marcaId===brandId && normalizeBrand(m.nombre)===normalized);
      if(found.length>1)throw new Error('AMBIGUOUS_VEHICLE_MODEL');
      const id=found[0]?.id || 'modelo-vehiculo-'+createHash('sha256').update(brandId+':'+normalized).digest('hex').slice(0,24);
      if(!found.length)creates.push({collection:'modelosVehiculo',id,data:{marcaId:brandId,nombre:name,nombreNormalizado:normalized,activo:true,creadoEn:now,actualizadoEn:now}});
      references.push({brandId,modelId:id});
    }
  }
  return {creates,updates,references};
}
