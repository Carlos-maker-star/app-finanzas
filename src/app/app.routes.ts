import { Routes } from '@angular/router';
import { adminGuard, authGuard, invitadoGuard } from './core/auth/guards';

// `data.titulo` es el texto de la barra superior; `title`, el de la pestaña del navegador.
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [invitadoGuard],
    title: 'Iniciar sesión · MisFinanzas',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    canActivate: [invitadoGuard],
    title: 'Crear cuenta · MisFinanzas',
    loadComponent: () => import('./features/auth/registro').then((m) => m.Registro),
  },
  {
    path: 'recuperar',
    canActivate: [invitadoGuard],
    title: 'Recuperar contraseña · MisFinanzas',
    loadComponent: () => import('./features/auth/recuperar').then((m) => m.Recuperar),
  },
  {
    // Sin guard: se llega desde el enlace del correo, que trae una sesión temporal
    path: 'restablecer',
    title: 'Nueva contraseña · MisFinanzas',
    loadComponent: () => import('./features/auth/restablecer').then((m) => m.Restablecer),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · MisFinanzas',
        data: { titulo: 'Dashboard' },
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'movimientos',
        title: 'Movimientos · MisFinanzas',
        data: { titulo: 'Movimientos' },
        loadComponent: () => import('./features/movimientos/movimientos-list').then((m) => m.MovimientosList),
      },
      {
        path: 'cuentas',
        title: 'Cuentas · MisFinanzas',
        data: { titulo: 'Cuentas' },
        loadComponent: () => import('./features/cuentas/cuentas-list').then((m) => m.CuentasList),
      },
      {
        path: 'cuentas/:id',
        title: 'Cuenta · MisFinanzas',
        data: { titulo: 'Cuentas' },
        loadComponent: () => import('./features/cuentas/cuenta-detail').then((m) => m.CuentaDetail),
      },
      {
        path: 'categorias',
        title: 'Categorías · MisFinanzas',
        data: { titulo: 'Categorías' },
        loadComponent: () => import('./features/categorias/categorias').then((m) => m.Categorias),
      },
      {
        path: 'perfil',
        title: 'Perfil · MisFinanzas',
        data: { titulo: 'Perfil' },
        loadComponent: () => import('./features/perfil/perfil').then((m) => m.PerfilPage),
      },
      {
        path: 'admin/usuarios',
        canActivate: [adminGuard],
        title: 'Usuarios · MisFinanzas',
        data: { titulo: 'Usuarios' },
        loadComponent: () => import('./features/admin/usuarios').then((m) => m.Usuarios),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
