export interface BuscarProductosQueryDto {
  query?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  familiaId?: string;
  sort?: 'precio' | 'cercania' | 'balance';
}

export interface ProductosOpcionesQueryDto {
  categoriaId?: string;
  subcategoriaId?: string;
  familiaId?: string;
}

export interface PopularesQueryDto {
  search?: string;
  limit?: number;
}
