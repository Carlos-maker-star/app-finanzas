import { EstadoMovimiento, Rol, TipoCuenta, TipoMovimiento } from './models';

// Textos, íconos y clases visuales de los valores del dominio.
// Las clases van escritas completas (no concatenadas) para que Tailwind las detecte.

/** Estado del movimiento → rol semántico de color (tailwind.css). */
export const ESTADOS: Record<EstadoMovimiento, { etiqueta: string; clases: string; icono: string | null }> = {
  programado: { etiqueta: 'Programado', clases: 'bg-nuevo-bg text-nuevo-fg', icono: 'schedule' },
  confirmado: { etiqueta: 'Confirmado', clases: 'bg-exito-bg text-exito-fg', icono: null },
  anulado: { etiqueta: 'Anulado', clases: 'bg-peligro-bg text-peligro-fg', icono: null },
};

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { etiqueta: string; icono: string; texto: string }> = {
  egreso: { etiqueta: 'Egreso', icono: 'north_east', texto: 'text-egreso' },
  ingreso: { etiqueta: 'Ingreso', icono: 'south_west', texto: 'text-ingreso' },
  transferencia: { etiqueta: 'Transferencia', icono: 'swap_horiz', texto: 'text-ink' },
};

export const TIPOS_CUENTA: Record<TipoCuenta, { etiqueta: string; icono: string }> = {
  efectivo: { etiqueta: 'Efectivo', icono: 'payments' },
  banco: { etiqueta: 'Banco', icono: 'account_balance' },
  tarjeta_credito: { etiqueta: 'Tarjeta de crédito', icono: 'credit_card' },
  ahorro: { etiqueta: 'Ahorro', icono: 'savings' },
  billetera_digital: { etiqueta: 'Billetera digital', icono: 'smartphone' },
};

export const ROLES: Record<Rol, string> = {
  usuario: 'Usuario',
  admin: 'Administrador',
};

export const LISTA_ESTADOS = Object.keys(ESTADOS) as EstadoMovimiento[];
export const LISTA_TIPOS_MOVIMIENTO = Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[];
export const LISTA_TIPOS_CUENTA = Object.keys(TIPOS_CUENTA) as TipoCuenta[];

/**
 * Colores que el usuario elige para cuentas y categorías. Se guardan en la base de datos con
 * su valor claro; en modo oscuro se muestra la variante clara para mantener el contraste.
 */
export const COLORES: { claro: string; oscuro: string; nombre: string }[] = [
  { claro: '#1D4ED8', oscuro: '#60A5FA', nombre: 'Azul' },
  { claro: '#16A34A', oscuro: '#4ADE80', nombre: 'Verde' },
  { claro: '#CA8A04', oscuro: '#FACC15', nombre: 'Mostaza' },
  { claro: '#7C3AED', oscuro: '#A78BFA', nombre: 'Violeta' },
  { claro: '#DB2777', oscuro: '#F472B6', nombre: 'Rosa' },
  { claro: '#EA580C', oscuro: '#FB923C', nombre: 'Naranja' },
  { claro: '#0891B2', oscuro: '#22D3EE', nombre: 'Cian' },
  { claro: '#64748B', oscuro: '#94A3B8', nombre: 'Gris' },
];

/** Colores de las categorías por defecto que no están en la paleta elegible. */
const OTROS_OSCUROS: Record<string, string> = {
  '#0D9488': '#2DD4BF',
  '#DC2626': '#F87171',
  '#2563EB': '#60A5FA',
  '#9333EA': '#C084FC',
  '#65A30D': '#A3E635',
  '#A16207': '#FACC15',
  '#475569': '#94A3B8',
  '#E11D48': '#FB7185',
};

/** Color de un dato del usuario listo para pintar según el tema. */
export function colorVisible(color: string | null | undefined, oscuro: boolean): string {
  const base = (color ?? '#64748B').toUpperCase();
  if (!oscuro) {
    return base;
  }
  return COLORES.find((c) => c.claro === base)?.oscuro ?? OTROS_OSCUROS[base] ?? base;
}

/** Íconos elegibles para una categoría (Material Symbols). */
export const ICONOS_CATEGORIA = [
  'shopping_cart', 'restaurant', 'restaurant_menu', 'delivery_dining', 'local_cafe', 'directions_car',
  'local_taxi', 'directions_bus', 'local_gas_station', 'home', 'bolt', 'water_drop',
  'wifi', 'smartphone', 'medical_services', 'school', 'movie', 'sports_esports',
  'fitness_center', 'checkroom', 'chair', 'pets', 'flight', 'card_giftcard',
  'account_balance', 'payments', 'work', 'storefront', 'savings', 'redeem',
  'trending_up', 'more_horiz',
];

export type AccionMovimiento = 'confirmar' | 'editar' | 'anular';

/**
 * Acciones que se ofrecen según el estado. Es un reflejo de las reglas de la base de datos
 * (trigger `validar_movimiento`), que es quien realmente las hace cumplir:
 *   programado → confirmado | anulado · confirmado → anulado · anulado → nada.
 */
export function accionesMovimiento(estado: EstadoMovimiento): AccionMovimiento[] {
  switch (estado) {
    case 'programado':
      return ['confirmar', 'editar', 'anular'];
    case 'confirmado':
      return ['editar', 'anular'];
    case 'anulado':
      return [];
  }
}
