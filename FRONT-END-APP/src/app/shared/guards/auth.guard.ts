import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.hasSession()) {
    return router.createUrlTree(['/auth/login']);
  }

  const me = await auth.me();
  if (!me) {
    await auth.clearSession();
    return router.createUrlTree(['/auth/login']);
  }

  return true;
};
