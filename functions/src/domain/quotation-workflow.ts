export const quotationStatuses = ['draft', 'sent', 'accepted', 'rejected'] as const;
export type QuotationStatus = typeof quotationStatuses[number];
export const quotationStatusLabels: Record<QuotationStatus, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado'
};
export function isQuotationStatus(value: unknown): value is QuotationStatus {
  return quotationStatuses.includes(value as QuotationStatus);
}
export function quotationStatus(value: unknown): QuotationStatus {
  return isQuotationStatus(value) ? value : 'draft';
}
