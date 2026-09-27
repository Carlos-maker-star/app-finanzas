import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { leerMonto } from '../../core/formato';
import { Movimiento, MovimientoForm, TipoMovimiento } from '../../core/models';

/** Valores del formulario de movimiento tal como los edita el usuario. */
export interface ValoresMovimiento {
  tipo: TipoMovimiento;
  monto: string;
  fecha: string;
  cuentaId: string;
  destinoId: string;
  categoriaId: string;
  descripcion: string;
  nota: string;
  programado: boolean;
}

export const MONTO_MAXIMO = 999_999_999_999.99;

/** Monto > 0, con hasta 2 decimales y dentro del máximo de la columna numeric(14,2). */
export const validarMonto: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const texto = String(control.value ?? '').trim();
  if (!texto) {
    return { required: true };
  }
  const monto = leerMonto(texto);
  if (monto === null) {
    return { formato: true };
  }
  if (monto <= 0) {
    return { positivo: true };
  }
  return monto > MONTO_MAXIMO ? { maximo: true } : null;
};

/**
 * Reglas que dependen del tipo (las mismas que el check `movimientos_forma_ck`):
 * transferencia → cuenta destino distinta y sin categoría; ingreso/egreso → con categoría.
 */
export const validarMovimiento: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const v = grupo.value as Partial<ValoresMovimiento>;
  const errores: ValidationErrors = {};
  if (!v.cuentaId) {
    errores['faltaCuenta'] = true;
  }
  if (v.tipo === 'transferencia') {
    if (!v.destinoId) {
      errores['faltaDestino'] = true;
    } else if (v.destinoId === v.cuentaId) {
      errores['cuentasIguales'] = true;
    }
  } else if (!v.categoriaId) {
    errores['faltaCategoria'] = true;
  }
  return Object.keys(errores).length ? errores : null;
};

/** Convierte el formulario en lo que se guarda en `movimientos`. */
export function aMovimientoForm(v: ValoresMovimiento): MovimientoForm {
  const esTransferencia = v.tipo === 'transferencia';
  return {
    tipo: v.tipo,
    estado: v.programado ? 'programado' : 'confirmado',
    monto: leerMonto(v.monto) ?? 0,
    fecha: v.fecha,
    cuenta_id: v.cuentaId,
    cuenta_destino_id: esTransferencia ? v.destinoId || null : null,
    categoria_id: esTransferencia ? null : v.categoriaId || null,
    descripcion: v.descripcion.trim() || null,
    nota: v.nota.trim() || null,
  };
}

/** Valores iniciales para editar un movimiento existente. */
export function desdeMovimiento(m: Movimiento): ValoresMovimiento {
  return {
    tipo: m.tipo,
    monto: m.monto.toFixed(2),
    fecha: m.fecha,
    cuentaId: m.cuenta_id,
    destinoId: m.cuenta_destino_id ?? '',
    categoriaId: m.categoria_id ?? '',
    descripcion: m.descripcion ?? '',
    nota: m.nota ?? '',
    programado: m.estado === 'programado',
  };
}
