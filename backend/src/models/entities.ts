export type RolUsuario = 'maestro' | 'ferreteria' | 'admin';
export type PlanSuscripcion = 'basico' | 'pro' | 'premium';
export type EstadoCuenta = 'activo' | 'bloqueado' | 'pendiente';

export type EstadoGenerico = 'activo' | 'inactivo';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export type TipoDatoAtributo = 'texto' | 'numero' | 'seleccion' | 'booleano';

export interface Usuario {
  id: string;
  rol: RolUsuario;
  nombre: string;
  correo: string;
  telefono: string;
  ciudad: string;
  comuna: string;
  direccion: string;
  planSuscripcion: PlanSuscripcion;
  estadoCuenta: EstadoCuenta;
  creadoEn: string;
}

export interface UsuarioPersistido extends Usuario {
  passwordHash: string;
}

export interface Ferreteria {
  id: string;
  usuarioDuenoId: string;
  nombreComercial: string;
  rut: string;
  estado: EstadoGenerico;
  creadoEn: string;
}

export interface Categoria {
  id: string;
  nombre: string;
}

export interface Subcategoria {
  id: string;
  categoriaId: string;
  nombre: string;
}

export interface Familia {
  id: string;
  subcategoriaId: string;
  nombre: string;
}

export interface DefinicionAtributoFamilia {
  id: string;
  familiaId: string;
  codigo: string;
  etiqueta: string;
  tipoDato: TipoDatoAtributo;
  esFiltrable: boolean;
  esObligatorio: boolean;
  opcionesJson: string[];
  orden: number;
}

export interface ProductoMaestro {
  id: string;
  categoriaId: string;
  subcategoriaId: string;
  familiaId: string;
  nombre: string;
  marca: string;
  descripcionCorta: string;
  descripcionLarga: string;
  imagenPrincipalUrl: string;
  galeriaJson: string[];
  estado: EstadoGenerico;
  creadoEn: string;
}

export interface AtributoProductoMaestro {
  id: string;
  productoMaestroId: string;
  definicionAtributoId: string;
  valorTexto: string | null;
  valorNumero: number | null;
  valorBooleano: boolean | null;
  valorOpcion: string | null;
}

export interface ProductoFerreteria {
  id: string;
  ferreteriaId: string;
  productoMaestroId: string;
  skuFerreteria: string;
  codigoBarras: string | null;
  precio: number;
  stock: number;
  activo: boolean;
  publicado: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SolicitudCreacionProducto {
  id: string;
  ferreteriaId: string;
  usuarioSolicitanteId: string;
  usuarioAdminId: string | null;
  nombreProducto: string;
  codigoBarras: string;
  cantidadReferencia: number;
  precioReferencia: number;
  estado: EstadoSolicitud;
  productoMaestroSugeridoId: string | null;
  notasAdmin: string;
  fechaCreacion: string;
  fechaResolucion: string | null;
}

export interface SesionAuth {
  token: string;
  usuarioId: string;
  creadoEn: string;
}
