import { v4 as uuidv4 } from 'uuid';
import type {
  AtributoProductoMaestro,
  Categoria,
  DefinicionAtributoFamilia,
  Familia,
  Ferreteria,
  ProductoFerreteria,
  ProductoMaestro,
  SolicitudCreacionProducto,
  Subcategoria,
  UsuarioPersistido
} from '../models/entities.js';

export interface Sesion {
  token: string;
  usuarioId: string;
  creadaEn: string;
}

const nowIso = (): string => new Date().toISOString();

class InMemoryDbService {
  public readonly usuarios: UsuarioPersistido[] = [];
  public readonly ferreterias: Ferreteria[] = [];
  public readonly categorias: Categoria[] = [];
  public readonly subcategorias: Subcategoria[] = [];
  public readonly familias: Familia[] = [];
  public readonly definicionesAtributoFamilia: DefinicionAtributoFamilia[] = [];
  public readonly productosMaestro: ProductoMaestro[] = [];
  public readonly atributosProductoMaestro: AtributoProductoMaestro[] = [];
  public readonly productosFerreteria: ProductoFerreteria[] = [];
  public readonly solicitudesCreacionProducto: SolicitudCreacionProducto[] = [];
  public readonly sesiones: Sesion[] = [];

  constructor() {
    this.seed();
  }

  private seed(): void {
    const adminId = uuidv4();
    const maestroId = uuidv4();
    const userFerreteriaId = uuidv4();
    const ferreteriaId = uuidv4();

    this.usuarios.push(
      {
        id: adminId,
        rol: 'admin',
        nombre: 'Admin Demo',
        correo: 'admin@demo.cl',
        passwordHash: '123456',
        telefono: '+56911111111',
        ciudad: 'Santiago',
        comuna: 'Santiago',
        direccion: 'Av. Admin 1',
        planSuscripcion: 'premium',
        estadoCuenta: 'activo',
        creadoEn: nowIso()
      },
      {
        id: maestroId,
        rol: 'maestro',
        nombre: 'Maestro Demo',
        correo: 'maestro@demo.cl',
        passwordHash: '123456',
        telefono: '+56922222222',
        ciudad: 'Santiago',
        comuna: 'Maipu',
        direccion: 'Pasaje Obra 22',
        planSuscripcion: 'pro',
        estadoCuenta: 'activo',
        creadoEn: nowIso()
      },
      {
        id: userFerreteriaId,
        rol: 'ferreteria',
        nombre: 'Ferreteria Demo',
        correo: 'ferreteria@demo.cl',
        passwordHash: '123456',
        telefono: '+56933333333',
        ciudad: 'Santiago',
        comuna: 'Pudahuel',
        direccion: 'Av. Ferre 123',
        planSuscripcion: 'pro',
        estadoCuenta: 'activo',
        creadoEn: nowIso()
      }
    );

    this.ferreterias.push({
      id: ferreteriaId,
      usuarioDuenoId: userFerreteriaId,
      nombreComercial: 'Ferreteria Demo',
      rut: '76.123.456-7',
      estado: 'activo',
      creadoEn: nowIso()
    });

    const catConstruccion = uuidv4();
    const catTerminaciones = uuidv4();
    this.categorias.push(
      { id: catConstruccion, nombre: 'Construccion' },
      { id: catTerminaciones, nombre: 'Terminaciones' }
    );

    const subCortinas = uuidv4();
    const subFijaciones = uuidv4();
    const subSanitarios = uuidv4();
    this.subcategorias.push(
      { id: subCortinas, categoriaId: catTerminaciones, nombre: 'Cortinas' },
      { id: subFijaciones, categoriaId: catConstruccion, nombre: 'Fijaciones' },
      { id: subSanitarios, categoriaId: catTerminaciones, nombre: 'Sanitarios' }
    );

    const famCortinas = uuidv4();
    const famTornillos = uuidv4();
    const famTazasBano = uuidv4();
    this.familias.push(
      { id: famCortinas, subcategoriaId: subCortinas, nombre: 'Cortinas Blackout' },
      { id: famTornillos, subcategoriaId: subFijaciones, nombre: 'Tornillos Zincados' },
      { id: famTazasBano, subcategoriaId: subSanitarios, nombre: 'Tazas de bano' }
    );

    const defColor = uuidv4();
    const defAncho = uuidv4();
    const defLargo = uuidv4();
    const defDiametro = uuidv4();
    const defTipoDescarga = uuidv4();
    this.definicionesAtributoFamilia.push(
      {
        id: defColor,
        familiaId: famCortinas,
        codigo: 'color',
        etiqueta: 'Color',
        tipoDato: 'seleccion',
        esFiltrable: true,
        esObligatorio: true,
        opcionesJson: ['Blanco', 'Beige', 'Gris'],
        orden: 1
      },
      {
        id: defAncho,
        familiaId: famCortinas,
        codigo: 'ancho_cm',
        etiqueta: 'Ancho (cm)',
        tipoDato: 'numero',
        esFiltrable: true,
        esObligatorio: true,
        opcionesJson: [],
        orden: 2
      },
      {
        id: defLargo,
        familiaId: famCortinas,
        codigo: 'largo_cm',
        etiqueta: 'Largo (cm)',
        tipoDato: 'numero',
        esFiltrable: true,
        esObligatorio: true,
        opcionesJson: [],
        orden: 3
      },
      {
        id: defDiametro,
        familiaId: famTornillos,
        codigo: 'diametro_mm',
        etiqueta: 'Diametro (mm)',
        tipoDato: 'numero',
        esFiltrable: true,
        esObligatorio: true,
        opcionesJson: [],
        orden: 1
      },
      {
        id: defTipoDescarga,
        familiaId: famTazasBano,
        codigo: 'tipo_descarga',
        etiqueta: 'Tipo de descarga',
        tipoDato: 'seleccion',
        esFiltrable: true,
        esObligatorio: true,
        opcionesJson: ['Dual', 'Simple'],
        orden: 1
      }
    );

    const prodCortina = uuidv4();
    const prodTornillo = uuidv4();
    const prodTaza = uuidv4();
    this.productosMaestro.push(
      {
        id: prodCortina,
        categoriaId: catTerminaciones,
        subcategoriaId: subCortinas,
        familiaId: famCortinas,
        nombre: 'Cortina Blackout Premium',
        marca: 'DecoHome',
        descripcionCorta: 'Cortina blackout para dormitorio',
        descripcionLarga: 'Bloquea luz y mejora aislacion termica.',
        imagenPrincipalUrl: 'https://example.com/cortina.jpg',
        galeriaJson: [],
        estado: 'activo',
        creadoEn: nowIso()
      },
      {
        id: prodTornillo,
        categoriaId: catConstruccion,
        subcategoriaId: subFijaciones,
        familiaId: famTornillos,
        nombre: 'Tornillo Zincado Rosca Madera',
        marca: 'FixPro',
        descripcionCorta: 'Uso general en madera',
        descripcionLarga: 'Alta resistencia a la corrosion.',
        imagenPrincipalUrl: 'https://example.com/tornillo.jpg',
        galeriaJson: [],
        estado: 'activo',
        creadoEn: nowIso()
      },
      {
        id: prodTaza,
        categoriaId: catTerminaciones,
        subcategoriaId: subSanitarios,
        familiaId: famTazasBano,
        nombre: 'Taza de Bano Dual Flush',
        marca: 'Hydra',
        descripcionCorta: 'Taza de bano con doble descarga',
        descripcionLarga: 'Incluye sistema ahorrador de agua.',
        imagenPrincipalUrl: 'https://example.com/taza.jpg',
        galeriaJson: [],
        estado: 'activo',
        creadoEn: nowIso()
      }
    );

    this.atributosProductoMaestro.push(
      {
        id: uuidv4(),
        productoMaestroId: prodCortina,
        definicionAtributoId: defColor,
        valorTexto: null,
        valorNumero: null,
        valorBooleano: null,
        valorOpcion: 'Blanco'
      },
      {
        id: uuidv4(),
        productoMaestroId: prodCortina,
        definicionAtributoId: defAncho,
        valorTexto: null,
        valorNumero: 140,
        valorBooleano: null,
        valorOpcion: null
      },
      {
        id: uuidv4(),
        productoMaestroId: prodCortina,
        definicionAtributoId: defLargo,
        valorTexto: null,
        valorNumero: 220,
        valorBooleano: null,
        valorOpcion: null
      },
      {
        id: uuidv4(),
        productoMaestroId: prodTornillo,
        definicionAtributoId: defDiametro,
        valorTexto: null,
        valorNumero: 4,
        valorBooleano: null,
        valorOpcion: null
      },
      {
        id: uuidv4(),
        productoMaestroId: prodTaza,
        definicionAtributoId: defTipoDescarga,
        valorTexto: null,
        valorNumero: null,
        valorBooleano: null,
        valorOpcion: 'Dual'
      }
    );

    this.productosFerreteria.push(
      {
        id: uuidv4(),
        ferreteriaId,
        productoMaestroId: prodCortina,
        skuFerreteria: 'FER-COR-001',
        codigoBarras: '7801234567001',
        precio: 34990,
        stock: 12,
        activo: true,
        publicado: true,
        creadoEn: nowIso(),
        actualizadoEn: nowIso()
      },
      {
        id: uuidv4(),
        ferreteriaId,
        productoMaestroId: prodTornillo,
        skuFerreteria: 'FER-TOR-001',
        codigoBarras: '7809876543001',
        precio: 120,
        stock: 320,
        activo: true,
        publicado: true,
        creadoEn: nowIso(),
        actualizadoEn: nowIso()
      }
    );

    this.solicitudesCreacionProducto.push({
      id: uuidv4(),
      ferreteriaId,
      usuarioSolicitanteId: userFerreteriaId,
      usuarioAdminId: null,
      nombreProducto: 'Canaleta PVC 2m',
      codigoBarras: '7801112223334',
      cantidadReferencia: 10,
      precioReferencia: 4500,
      estado: 'pendiente',
      productoMaestroSugeridoId: null,
      notasAdmin: '',
      fechaCreacion: nowIso(),
      fechaResolucion: null
    });
  }

  public createSession(usuarioId: string): Sesion {
    const token = `mock-${uuidv4()}`;
    const sesion: Sesion = {
      token,
      usuarioId,
      creadaEn: nowIso()
    };
    this.sesiones.push(sesion);
    return sesion;
  }

  public getSession(token: string): Sesion | null {
    return this.sesiones.find((item) => item.token === token) || null;
  }

  public revokeSession(token: string): void {
    const index = this.sesiones.findIndex((item) => item.token === token);
    if (index >= 0) {
      this.sesiones.splice(index, 1);
    }
  }

  public toPublicUser(usuario: UsuarioPersistido): Omit<UsuarioPersistido, 'passwordHash'> {
    const { passwordHash: _passwordHash, ...rest } = usuario;
    return rest;
  }
}

export const db = new InMemoryDbService();
