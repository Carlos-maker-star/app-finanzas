import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Los guards son comodidad de navegación: quien protege los datos es el RLS de Supabase.

/** Rutas privadas: sin sesión, al login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return auth.autenticado() || router.createUrlTree(['/login']);
};

/** Login y registro: con sesión, al dashboard. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return !auth.autenticado() || router.createUrlTree(['/dashboard']);
};

/** Solo administradores. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return auth.esAdmin() || router.createUrlTree(['/dashboard']);
};
