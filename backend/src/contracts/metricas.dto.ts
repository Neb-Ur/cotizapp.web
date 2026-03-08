export interface FechaRangoQueryDto {
  from?: string;
  to?: string;
}

export interface PlanCapabilitiesResponseDto {
  plan: string;
  label: string;
  maxPendingQuotations?: number | null;
  maxCatalogProducts?: number | null;
  hasHistory?: boolean;
  allowCsvImport?: boolean;
  allowAdvancedMetrics?: boolean;
}
