import { row, rows } from '../repositories/firestore.repository.js';
import { COLLECTIONS } from '../lib/collections.js';
import { coordinateValue } from '../lib/values.js';
export async function authUserResponse(userId: string): Promise<any | null> {
  const user = await row(COLLECTIONS.users, userId);
  if (!user) return null;
  const stores = await rows(COLLECTIONS.stores);
  const store = stores.find((item) => item.usuarioDuenoId === userId);
  return {
    ...user,
    ferreteriaId: store?.id,
    nombreComercial: store?.nombreComercial,
    rut: store?.rut ?? user.rut,
    latitud: coordinateValue(store?.latitud, -90, 90),
    longitud: coordinateValue(store?.longitud, -180, 180),
    contratoFerreteriaEstado: store?.contratoEstado || 'pendiente',
    contratoFerreteriaVersion: store?.contratoVersion || null,
    contratoFerreteriaAceptadoEn: store?.contratoAceptadoEn || null,
    tratamientoBloqueado: user.tratamientoBloqueado === true
  };
}
