import type { TipoDatoAtributo } from '../models/entities.js';

export interface TaxonomiaFiltroDto {
  categoriaId?: string;
  subcategoriaId?: string;
  familiaId?: string;
}

export interface DefinicionAtributoRequestDto {
  codigo: string;
  etiqueta: string;
  tipoDato: TipoDatoAtributo;
  esFiltrable: boolean;
  esObligatorio: boolean;
  opcionesJson?: string[];
  orden?: number;
}
