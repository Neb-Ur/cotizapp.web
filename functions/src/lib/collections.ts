import { collectionForMode } from './data-mode.js';

const names = {
  users: 'usuarios',
  stores: 'ferreterias',
  categories: 'categorias',
  subcategories: 'subcategorias',
  families: 'familias',
  brands: 'marcas',
  familyDefinitions: 'definicionesAtributoFamilia',
  masterProducts: 'productosMaestro',
  masterAttributes: 'atributosProductoMaestro',
  storeProducts: 'productosFerreteria',
  priceHistory: 'historialPrecios',
  storeAgreements: 'contratosFerreteria',
  projects: 'proyectos',
  productRequests: 'solicitudesCreacionProducto',
  contactRequests: 'solicitudesContacto',
  consentRecords: 'registrosConsentimiento',
  marketingSuppressions: 'supresionesMarketing',
  priceReports: 'reclamosPrecios',
  privacyRequests: 'solicitudesDerechos',
  deletionReceipts: 'comprobantesEliminacion',
  adminAuditLogs: 'bitacoraAdministrativa',
  securityIncidents: 'registroIncidentesSeguridad',
  intellectualPropertyReports: 'denunciasPropiedadIntelectual',
  governanceEvidence: 'evidenciasGobiernoDatos',
  publicCache: 'cachePublico',
  storeMetrics: 'storeMetrics',
  storeDailyAnalytics: 'storeDailyAnalytics',
  analyticsJobs: 'analyticsJobs',
  projectOwnerLocks: 'projectOwnerLocks'
} as const;

export const COLLECTIONS = new Proxy(names, {
  get(target, property) {
    return typeof property === 'string' && property in target
      ? collectionForMode(target[property as keyof typeof names]) : Reflect.get(target, property);
  }
});
