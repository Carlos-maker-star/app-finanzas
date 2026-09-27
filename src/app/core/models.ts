// Tipos que reflejan las tablas, vistas y funciones de Supabase (supabase/*.sql).
// Los nombres de campo son los de la base de datos (snake_case) para no traducirlos en cada consulta.

export type Rol = 'usuario' | 'admin';
export type TipoCuenta = 'efectivo' | 'banco' | 'tarjeta_credito' | 'ahorro' | 'billetera_digital';
export type TipoCategoria = 'ingreso' | 'egreso';
export type TipoMovimiento = 'ingreso' | 'egreso' | 'transferencia';
export type EstadoMovimiento = 'programado' | 'confirmado' | 'anulado';

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
}

/** Fila de la vista `v_saldos_cuentas`: la cuenta con su saldo calculado. */
export interface Cuenta {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  color: string | null;
  icono: string | null;
  archivada: boolean;
  saldo_inicial: number;
  saldo_actual: number;
  /** Movimientos confirmados que afectan a la cuenta. */
  cantidad_movimientos: number;
}

export interface CuentaForm {
  nombre: string;
  tipo: TipoCuenta;
  saldo_inicial: number;
  color: string;
  icono: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoCategoria;
  padre_id: string | null;
  icono: string | null;
  color: string | null;
  activa: boolean;
}

export interface CategoriaForm {
  nombre: string;
  tipo: TipoCategoria;
  padre_id: string | null;
  icono: string;
  color: string;
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  estado: EstadoMovimiento;
  monto: number;
  /** Fecha sin hora: `YYYY-MM-DD`. */
  fecha: string;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  descripcion: string | null;
  nota: string | null;
  anulado_en: string | null;
  creado_en: string;
}

/** Lo que se envía al crear o editar un movimiento. */
export interface MovimientoForm {
  tipo: TipoMovimiento;
  estado: 'programado' | 'confirmado';
  monto: number;
  fecha: string;
  cuenta_id: string;
  cuenta_destino_id: string | null;
  categoria_id: string | null;
  descripcion: string | null;
  nota: string | null;
}

export interface FiltroMovimientos {
  desde?: string | null;
  hasta?: string | null;
  tipo?: TipoMovimiento | null;
  estado?: EstadoMovimiento | null;
  cuentaId?: string | null;
  categoriaId?: string | null;
  busqueda?: string | null;
}

export interface Pagina<T> {
  contenido: T[];
  total: number;
}

export interface TotalesMovimientos {
  cantidad: number;
  ingresos: number;
  egresos: number;
}

/** Respuesta de la función `resumen_dashboard(p_mes)`. */
export interface ResumenDashboard {
  mes: string;
  saldo_total: number;
  ingresos_mes: number;
  egresos_mes: number;
  ahorro_mes: number;
  tasa_ahorro: number | null;
  ingresos_mes_anterior: number;
  egresos_mes_anterior: number;
  serie_6_meses: { mes: string; ingresos: number; egresos: number }[];
  gastos_por_categoria: { categoria_id: string; nombre: string; icono: string | null; color: string | null; total: number }[];
}

export interface PuntoSaldo {
  mes: string;
  saldo: number;
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  creado_en: string;
  ultimo_acceso: string | null;
}

export interface ResumenUsuarios {
  total: number;
  activos: number;
  inactivos: number;
  nuevos_mes: number;
  con_actividad_30_dias: number;
}
