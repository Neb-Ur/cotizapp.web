import { TaxonomyOption } from '../models/app.models';
export const CATEGORY_ICONS = [{"id": "building", "name": "Construcción y estructuras"}, {"id": "home", "name": "Baño y hogar"}, {"id": "bolt", "name": "Electricidad"}, {"id": "wrench", "name": "Herramientas y fijaciones"}, {"id": "filter", "name": "Gasfitería"}, {"id": "sun", "name": "Iluminación"}, {"id": "palette", "name": "Pinturas"}, {"id": "th-large", "name": "Pisos y revestimientos"}, {"id": "shield", "name": "Seguridad"}, {"id": "box", "name": "Materiales"}, {"id": "truck", "name": "Equipos"}, {"id": "cog", "name": "Herrajes"}, {"id": "sitemap", "name": "Canalización"}, {"id": "cloud", "name": "Cubiertas"}, {"id": "objects-column", "name": "Maderas y tableros"}, {"id": "hashtag", "name": "Cercos y mallas"}];
export function categoryIcon(category: Pick<TaxonomyOption, 'name' | 'icon'>): string {
  if (CATEGORY_ICONS.some(item => item.id === category.icon)) return `pi pi-${category.icon}`;
  const name = category.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rules: Array<[RegExp, string]> = [
    [/acero|estructur|construccion|cement/, 'building'], [/bano|cocina/, 'home'], [/electric/, 'bolt'],
    [/fijacion|herramient/, 'wrench'], [/gasfiter|fluido/, 'filter'], [/ilumin|energia/, 'sun'],
    [/pintur/, 'palette'], [/madera|tablero/, 'objects-column'], [/piso|revest/, 'th-large'],
    [/segur|proteccion/, 'shield'], [/cubierta|tech|aisla/, 'cloud'], [/jardin|exterior/, 'sun'],
    [/cerco|malla/, 'hashtag'], [/herra/, 'cog'], [/impermea|adhesi|quimic/, 'filter']
  ];
  return `pi pi-${rules.find(([rule]) => rule.test(name))?.[1] || 'box'}`;
}
