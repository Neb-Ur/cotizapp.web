export interface ChileCityOption {
  city: string;
  communes: string[];
}

// Catálogo local para mantener formularios consistentes aun cuando Firebase no tenga tiendas cargadas.
export const CHILE_CITY_OPTIONS: ChileCityOption[] = [
  { city: 'Arica', communes: ['Arica', 'Camarones'] },
  { city: 'Iquique', communes: ['Alto Hospicio', 'Iquique'] },
  { city: 'Antofagasta', communes: ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal'] },
  { city: 'Copiapó', communes: ['Caldera', 'Copiapó', 'Tierra Amarilla'] },
  { city: 'La Serena - Coquimbo', communes: ['Andacollo', 'Coquimbo', 'La Higuera', 'La Serena', 'Paihuano', 'Vicuña'] },
  { city: 'Gran Valparaíso', communes: ['Concón', 'Quilpué', 'Valparaíso', 'Villa Alemana', 'Viña del Mar'] },
  {
    city: 'Santiago',
    communes: [
      'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba',
      'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina',
      'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa',
      'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura',
      'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San Miguel',
      'San Ramón', 'Santiago', 'Vitacura'
    ]
  },
  { city: 'Rancagua', communes: ['Codegua', 'Graneros', 'Machalí', 'Mostazal', 'Olivar', 'Rancagua', 'Requínoa'] },
  { city: 'Talca', communes: ['Constitución', 'Curepto', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Talca'] },
  { city: 'Chillán', communes: ['Bulnes', 'Chillán', 'Chillán Viejo', 'Coihueco', 'Pinto', 'San Carlos'] },
  { city: 'Gran Concepción', communes: ['Chiguayante', 'Concepción', 'Coronel', 'Hualpén', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz', 'Talcahuano', 'Tomé'] },
  { city: 'Temuco', communes: ['Freire', 'Padre Las Casas', 'Temuco', 'Vilcún'] },
  { city: 'Valdivia', communes: ['Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Valdivia'] },
  { city: 'Osorno', communes: ['Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo'] },
  { city: 'Puerto Montt', communes: ['Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Llanquihue', 'Los Muermos', 'Maullín', 'Puerto Montt', 'Puerto Varas'] },
  { city: 'Coyhaique', communes: ['Coyhaique', 'Lago Verde'] },
  { city: 'Punta Arenas', communes: ['Laguna Blanca', 'Punta Arenas', 'Río Verde', 'San Gregorio'] }
];

export function communesForCity(city: string): string[] {
  return CHILE_CITY_OPTIONS.find((option) => option.city === city)?.communes ?? [];
}
