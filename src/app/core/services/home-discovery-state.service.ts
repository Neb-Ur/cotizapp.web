import { Injectable } from '@angular/core';
import { SearchFilters } from '../models/app.models';
@Injectable({providedIn:'root'})
export class HomeDiscoveryStateService {
  value: {area: SearchFilters['area']; brand: string; model: string; year: string} = {area:undefined,brand:'',model:'',year:''};
}
