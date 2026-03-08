export interface VincularProductoFerreteriaRequestDto {
  productoMaestroId: string;
  skuFerreteria: string;
  codigoBarras?: string | null;
  precio: number;
  stock: number;
  activo?: boolean;
  publicado?: boolean;
}

export interface BuscarCatalogoQueryDto {
  query?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  familiaId?: string;
  publicado?: boolean;
}
