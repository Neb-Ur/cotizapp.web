import {Injectable} from '@angular/core';
import {ApiClientService} from './api-client.service';
import {OfferPhoto} from '../models/app.models';
import {OfferCondition} from '../utils/offer-condition.util';
export interface DonorPart {id:string;nombre:string;sistema:string;seleccionada:boolean;precio:number|null;stock:number|null;condicion:OfferCondition;productoMaestroId:string|null;ofertaId?:string|null;solicitudId?:string|null;fotosPublicacion:OfferPhoto[];estado?:string;error?:string;publicado?:boolean;}
export interface DonorVehicle {fotosVehiculo?:OfferPhoto[];id:string;marcaId:string;modeloId:string;marcaNombre?:string;modeloNombre?:string;anio:number;motor:string;patente:string;vin:string;transmision:string;codigoInterno:string;estado:string;revision?:number;piezas:DonorPart[];actualizadoEn?:string;}
export interface DonorCandidate {id:string;nombre:string;nombrePieza:string;detalleVariante:string;sugeridaPara:string[];}
export interface DonorInventory {vehicles:DonorVehicle[];template:Array<{id:string;sistema:string;nombre:string}>;}
@Injectable({providedIn:'root'})
export class DonorInventoryService {
 constructor(private readonly api:ApiClientService){}
 private base(storeId:string){return `/ferreterias/${encodeURIComponent(storeId)}/vehiculos-donantes`;}
 list(storeId:string){return this.api.get<DonorInventory>(this.base(storeId),true);}
 save(storeId:string,vehicle:DonorVehicle){return this.api.put<DonorVehicle>(`${this.base(storeId)}/${encodeURIComponent(vehicle.id)}`,vehicle,true);}
 remove(storeId:string,id:string){return this.api.delete(`${this.base(storeId)}/${encodeURIComponent(id)}`,true);}
 candidates(storeId:string,id:string){return this.api.get<{items:DonorCandidate[]}>(`${this.base(storeId)}/${encodeURIComponent(id)}/candidatos`,true);}
 publish(storeId:string,id:string,piezaIds:string[]){return this.api.post<{vehicle:DonorVehicle;results:Array<{id:string;estado:string;error?:string}>}>(`${this.base(storeId)}/${encodeURIComponent(id)}/publicar`,{piezaIds},true);}
 photoPath(storeId:string,id:string,itemId:string){return `${this.base(storeId)}/${encodeURIComponent(id)}/piezas/${encodeURIComponent(itemId)}/fotos`;}
}
