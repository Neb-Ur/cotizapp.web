-- Ejecutar luego en PostgreSQL (recomendado PG14+)
-- Crea esquema MVP completo con soporte de variantes y filtros dinamicos.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol text NOT NULL CHECK (rol IN ('maestro', 'ferreteria', 'admin')),
  nombre text NOT NULL,
  correo text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  telefono text NOT NULL,
  ciudad text NOT NULL,
  comuna text NOT NULL,
  direccion text NOT NULL,
  plan_suscripcion text NOT NULL CHECK (plan_suscripcion IN ('basico', 'pro', 'premium')),
  estado_cuenta text NOT NULL CHECK (estado_cuenta IN ('activo', 'bloqueado', 'pendiente')),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ferreterias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_dueno_id uuid NOT NULL REFERENCES usuarios(id),
  nombre_comercial text NOT NULL,
  rut text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('activo', 'inactivo')),
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_ferreteria_usuario UNIQUE (usuario_dueno_id)
);

CREATE TABLE categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE
);

CREATE TABLE subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES categorias(id),
  nombre text NOT NULL,
  CONSTRAINT uq_subcategoria UNIQUE (categoria_id, nombre)
);

CREATE TABLE familias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategoria_id uuid NOT NULL REFERENCES subcategorias(id),
  nombre text NOT NULL,
  CONSTRAINT uq_familia UNIQUE (subcategoria_id, nombre)
);

CREATE TABLE definiciones_atributo_familia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES familias(id),
  codigo text NOT NULL,
  etiqueta text NOT NULL,
  tipo_dato text NOT NULL CHECK (tipo_dato IN ('texto', 'numero', 'seleccion', 'booleano')),
  alcance text NOT NULL CHECK (alcance IN ('producto', 'variante')),
  es_filtrable boolean NOT NULL DEFAULT false,
  es_obligatorio boolean NOT NULL DEFAULT false,
  opciones_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  orden integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_definicion_codigo UNIQUE (familia_id, codigo)
);

CREATE TABLE productos_maestro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL REFERENCES categorias(id),
  subcategoria_id uuid NOT NULL REFERENCES subcategorias(id),
  familia_id uuid NOT NULL REFERENCES familias(id),
  nombre text NOT NULL,
  marca text NOT NULL,
  descripcion_corta text NOT NULL DEFAULT '',
  descripcion_larga text NOT NULL DEFAULT '',
  imagen_principal_url text NOT NULL DEFAULT '',
  galeria_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  estado text NOT NULL CHECK (estado IN ('activo', 'inactivo')) DEFAULT 'activo',
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_producto_maestro_nombre UNIQUE (familia_id, nombre, marca)
);

CREATE TABLE atributos_producto_maestro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_maestro_id uuid NOT NULL REFERENCES productos_maestro(id) ON DELETE CASCADE,
  definicion_atributo_id uuid NOT NULL REFERENCES definiciones_atributo_familia(id),
  valor_texto text NULL,
  valor_numero numeric(14,4) NULL,
  valor_booleano boolean NULL,
  valor_opcion text NULL,
  CONSTRAINT uq_atributo_producto UNIQUE (producto_maestro_id, definicion_atributo_id)
);

CREATE TABLE variantes_producto_maestro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_maestro_id uuid NOT NULL REFERENCES productos_maestro(id) ON DELETE CASCADE,
  codigo_barras_gtin text NOT NULL,
  sku_variante_base text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('activa', 'inactiva')) DEFAULT 'activa',
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variante_gtin UNIQUE (codigo_barras_gtin),
  CONSTRAINT uq_variante_sku_base UNIQUE (producto_maestro_id, sku_variante_base)
);

CREATE TABLE atributos_variante_maestra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_maestra_id uuid NOT NULL REFERENCES variantes_producto_maestro(id) ON DELETE CASCADE,
  definicion_atributo_id uuid NOT NULL REFERENCES definiciones_atributo_familia(id),
  valor_texto text NULL,
  valor_numero numeric(14,4) NULL,
  valor_booleano boolean NULL,
  valor_opcion text NULL,
  CONSTRAINT uq_atributo_variante UNIQUE (variante_maestra_id, definicion_atributo_id)
);

CREATE TABLE productos_ferreteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id uuid NOT NULL REFERENCES ferreterias(id),
  producto_maestro_id uuid NOT NULL REFERENCES productos_maestro(id),
  publicado boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_producto_ferreteria UNIQUE (ferreteria_id, producto_maestro_id)
);

CREATE TABLE variantes_producto_ferreteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_ferreteria_id uuid NOT NULL REFERENCES productos_ferreteria(id) ON DELETE CASCADE,
  variante_maestra_id uuid NOT NULL REFERENCES variantes_producto_maestro(id),
  sku_ferreteria text NOT NULL,
  codigo_barras_override text NULL,
  precio numeric(14,2) NOT NULL CHECK (precio > 0),
  stock integer NOT NULL CHECK (stock >= 0),
  activa boolean NOT NULL DEFAULT true,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variante_ferreteria UNIQUE (producto_ferreteria_id, variante_maestra_id),
  CONSTRAINT uq_sku_ferreteria UNIQUE (producto_ferreteria_id, sku_ferreteria)
);

CREATE TABLE solicitudes_creacion_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id uuid NOT NULL REFERENCES ferreterias(id),
  usuario_solicitante_id uuid NOT NULL REFERENCES usuarios(id),
  nombre_producto text NOT NULL,
  codigo_barras text NOT NULL,
  cantidad_referencia integer NOT NULL CHECK (cantidad_referencia > 0),
  precio_referencia numeric(14,2) NOT NULL CHECK (precio_referencia > 0),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')) DEFAULT 'pendiente',
  notas_admin text NOT NULL DEFAULT '',
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_resolucion timestamptz NULL
);

CREATE TABLE lotes_importacion_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferreteria_id uuid NOT NULL REFERENCES ferreterias(id),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  nombre_archivo text NOT NULL,
  estado text NOT NULL CHECK (estado IN ('activo', 'inactivo')) DEFAULT 'activo',
  total_filas integer NOT NULL DEFAULT 0,
  filas_ok integer NOT NULL DEFAULT 0,
  filas_error integer NOT NULL DEFAULT 0,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE filas_importacion_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid NOT NULL REFERENCES lotes_importacion_catalogo(id) ON DELETE CASCADE,
  numero_fila integer NOT NULL,
  nombre_producto text NOT NULL,
  sku text NOT NULL,
  precio numeric(14,2) NOT NULL,
  stock integer NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('subido', 'fallido', 'nuevo_validacion', 'posible_match')),
  mensaje text NOT NULL DEFAULT ''
);

CREATE TABLE solicitudes_validacion_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_importacion_id uuid NOT NULL REFERENCES filas_importacion_catalogo(id),
  ferreteria_id uuid NOT NULL REFERENCES ferreterias(id),
  usuario_admin_id uuid NULL REFERENCES usuarios(id),
  tipo text NOT NULL CHECK (tipo IN ('nuevo_producto', 'posible_match')),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')) DEFAULT 'pendiente',
  producto_maestro_sugerido_id uuid NULL REFERENCES productos_maestro(id),
  nota_admin text NOT NULL DEFAULT '',
  creada_en timestamptz NOT NULL DEFAULT now(),
  resuelta_en timestamptz NULL
);

CREATE TABLE proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_maestro_id uuid NOT NULL REFERENCES usuarios(id),
  nombre text NOT NULL,
  direccion_obra text NOT NULL DEFAULT '',
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  usuario_maestro_id uuid NOT NULL REFERENCES usuarios(id),
  estado text NOT NULL CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')) DEFAULT 'pendiente',
  total numeric(14,2) NOT NULL DEFAULT 0,
  ahorro_estimado numeric(14,2) NOT NULL DEFAULT 0,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE items_cotizacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  variante_producto_ferreteria_id uuid NOT NULL REFERENCES variantes_producto_ferreteria(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario_snapshot numeric(14,2) NOT NULL CHECK (precio_unitario_snapshot > 0),
  subtotal numeric(14,2) NOT NULL CHECK (subtotal >= 0)
);

-- Indices de lectura frecuentes
CREATE INDEX idx_subcategorias_categoria ON subcategorias(categoria_id);
CREATE INDEX idx_familias_subcategoria ON familias(subcategoria_id);
CREATE INDEX idx_definiciones_familia ON definiciones_atributo_familia(familia_id);
CREATE INDEX idx_productos_maestro_taxonomia ON productos_maestro(categoria_id, subcategoria_id, familia_id);
CREATE INDEX idx_variantes_maestras_producto ON variantes_producto_maestro(producto_maestro_id);
CREATE INDEX idx_productos_ferreteria_ferreteria ON productos_ferreteria(ferreteria_id);
CREATE INDEX idx_variantes_ferreteria_producto ON variantes_producto_ferreteria(producto_ferreteria_id);
CREATE INDEX idx_variantes_ferreteria_precio_stock ON variantes_producto_ferreteria(precio, stock);
CREATE INDEX idx_solicitudes_creacion_estado ON solicitudes_creacion_producto(estado);
CREATE INDEX idx_lotes_ferreteria ON lotes_importacion_catalogo(ferreteria_id, creado_en DESC);
CREATE INDEX idx_validaciones_estado_tipo ON solicitudes_validacion_catalogo(estado, tipo, creada_en DESC);
CREATE INDEX idx_proyectos_maestro ON proyectos(usuario_maestro_id, creado_en DESC);
CREATE INDEX idx_cotizaciones_proyecto ON cotizaciones(proyecto_id, estado);
