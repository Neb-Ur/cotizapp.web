import { Router } from 'express';
import { contactRouter } from './contact.routes.js';
import { authRouter } from './auth.routes.js';
import { taxonomyRouter } from './taxonomy.routes.js';
import { masterProductsRouter } from './master-products.routes.js';
import { searchRouter } from './search.routes.js';
import { storeCatalogRouter } from './store-catalog.routes.js';
import { projectsRouter } from './projects.routes.js';
import { productRequestsRouter } from './product-requests.routes.js';
import { adminUsersRouter } from './admin-users.routes.js';

// Preserve route registration order and the existing /api and direct URL contracts.
export const mvpRouter = Router();
mvpRouter.use(contactRouter);
mvpRouter.use(authRouter);
mvpRouter.use(taxonomyRouter);
mvpRouter.use(masterProductsRouter);
mvpRouter.use(searchRouter);
mvpRouter.use(storeCatalogRouter);
mvpRouter.use(projectsRouter);
mvpRouter.use(productRequestsRouter);
mvpRouter.use(adminUsersRouter);
