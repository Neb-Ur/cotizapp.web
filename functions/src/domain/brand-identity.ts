import { createHash } from 'node:crypto';

export function normalizeBrand(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
export function brandIdentity(value: unknown): { id: string; nombre: string; nombreNormalizado: string } | null {
  const nombre = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const nombreNormalizado = normalizeBrand(nombre);
  if (!nombreNormalizado || ['sin marca', 'por especificar', 'generico', 'sin especificar'].includes(nombreNormalizado)) return null;
  return { id: `marca-${createHash('sha256').update(nombreNormalizado).digest('hex').slice(0, 24)}`, nombre, nombreNormalizado };
}
