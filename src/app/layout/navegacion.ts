export interface ItemNav {
  etiqueta: string;
  /** Ícono de Material Symbols. */
  icono: string;
  ruta: string;
}

export interface SeccionNav {
  titulo: string;
  items: ItemNav[];
  /** Solo la ven los administradores. */
  soloAdmin?: boolean;
}

// El orden aquí es el orden en el menú lateral.
export const NAVEGACION: SeccionNav[] = [
  {
    titulo: 'Principal',
    items: [
      { etiqueta: 'Dashboard', icono: 'space_dashboard', ruta: '/dashboard' },
      { etiqueta: 'Movimientos', icono: 'receipt_long', ruta: '/movimientos' },
      { etiqueta: 'Cuentas', icono: 'account_balance', ruta: '/cuentas' },
      { etiqueta: 'Categorías', icono: 'sell', ruta: '/categorias' },
    ],
  },
  {
    titulo: 'Mi cuenta',
    items: [{ etiqueta: 'Perfil', icono: 'person', ruta: '/perfil' }],
  },
  {
    titulo: 'Administración',
    soloAdmin: true,
    items: [{ etiqueta: 'Usuarios', icono: 'group', ruta: '/admin/usuarios' }],
  },
];

/** Ruta a la que envía el buscador de la barra superior (con `?q=`). */
export const RUTA_BUSQUEDA = '/movimientos';
