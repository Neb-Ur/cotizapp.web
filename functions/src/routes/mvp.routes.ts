import { offerPhotosRouter } from './offer-photos.routes.js';
import { storeDirectoryRouter } from './store-directory.routes.js';
import { storeQuotationsRouter } from './store-quotations.routes.js';
import { Router } from 'express';
import { imagesRouter } from './images.routes.js';
import { contactRouter } from './contact.routes.js';
import { authRouter } from './auth.routes.js';
import { taxonomyRouter } from './taxonomy.routes.js';
import { masterProductsRouter } from './master-products.routes.js';
import { searchRouter } from './search.routes.js';
import { storeCatalogRouter } from './store-catalog.routes.js';
import { projectsRouter } from './projects.routes.js';
import { productRequestsRouter } from './product-requests.routes.js';
import { adminUsersRouter } from './admin-users.routes.js';
import { privacyRouter } from './privacy.routes.js';
import { governanceRouter } from './governance.routes.js';
import { storeAgreementRouter } from './store-agreement.routes.js';
import { storeOnboardingRouter } from './store-onboarding.routes.js';
import { intellectualPropertyRouter } from './intellectual-property.routes.js';
import { marketingRouter } from './marketing.routes.js';
import { priceReportsRouter } from './price-reports.routes.js';

// Preserve route registration order and the existing /api and direct URL contracts.
export const mvpRouter = Router();
// Retired automotive endpoints are deliberately unavailable, including old clients.
mvpRouter.use((req, res, next) => {
  if (/^\/(?:admin\/vehiculos(?:\/|$)|vehiculos\/catalogo(?:\/|$))/.test(req.path) || /^\/ferreterias\/[^/]+\/(?:vehiculos|vehiculos-donantes)(?:\/|$)/.test(req.path) || /^\/ferreterias\/[^/]+\/catalogo\/[^/]+\/vehiculos(?:\/|$)/.test(req.path)) {
    res.set('X-Robots-Tag','noindex');
    return res.status(410).json({ok:false,error:{code:'MARKET_RETIRED',message:'El catálogo automotriz ya no está disponible en Trovio.'}});
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && (req.body?.categoriaId === 'cat-repuestos-automotrices' || ['repuestos','desarmaduria'].includes(req.body?.tipoNegocio) || req.body?.ambitoComercial === 'desarmaduria' || req.body?.permiteVehiculos === true || req.body?.compatibilidadVehiculos?.length)) {
    return res.status(400).json({ok:false,error:{code:'MARKET_UNSUPPORTED',message:'Trovio admite ferretería, herramientas y materiales de construcción.'}});
  }
  next();
});
mvpRouter.use(imagesRouter);
mvpRouter.use(contactRouter);
mvpRouter.use(marketingRouter);
mvpRouter.use(priceReportsRouter);
mvpRouter.use(authRouter);
mvpRouter.use(privacyRouter);
mvpRouter.use(governanceRouter);
mvpRouter.use(storeAgreementRouter);
mvpRouter.use(storeOnboardingRouter);
mvpRouter.use(intellectualPropertyRouter);
mvpRouter.use(taxonomyRouter);
mvpRouter.use(offerPhotosRouter);
mvpRouter.use(masterProductsRouter);
mvpRouter.use(searchRouter);
mvpRouter.use(storeDirectoryRouter);
mvpRouter.use(storeCatalogRouter);
mvpRouter.use(projectsRouter);
mvpRouter.use(storeQuotationsRouter);
mvpRouter.use(productRequestsRouter);
mvpRouter.use(adminUsersRouter);
