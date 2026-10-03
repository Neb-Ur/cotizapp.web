import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StoreAgreementService } from '../services/store-agreement.service';

export const storeAgreementGuard: CanActivateFn = () => {
  const agreements = inject(StoreAgreementService);
  const router = inject(Router);
  return agreements.current()
    .then((overview) => overview.status === 'vigente'
      ? true
      : router.createUrlTree(['/cuenta/contrato-ferreteria'], { queryParams: { reason: 'required' } }))
    .catch(() => router.createUrlTree(['/cuenta/contrato-ferreteria'], { queryParams: { reason: 'required' } }));
};
