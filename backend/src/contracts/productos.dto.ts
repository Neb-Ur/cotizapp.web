import type { EstadoGenerico } from '../models/entities.js';

export interface FiltroProductosMaestroQueryDto {
  query?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  familiaId?: string;
}

export interface ProductoMaestroRequestDto {
  categoriaId: string;
  subcategoriaId: string;
  familiaId: string;
  nombre: string;
  marca: string;
  descripcionCorta?: string;
  descripcionLarga?: string;
  imagenPrincipalUrl?: string;
  galeriaJson?: string[];
  estado?: EstadoGenerico;
}

export interface AtributoValorRequestDto {
  definicionAtributoId: string;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorBooleano?: boolean | null;
  valorOpcion?: string | null;
}
