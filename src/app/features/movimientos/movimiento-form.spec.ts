import { FormControl, FormGroup } from '@angular/forms';
import { aMovimientoForm, desdeMovimiento, validarMonto, validarMovimiento, ValoresMovimiento } from './movimiento-form';

const base: ValoresMovimiento = {
  tipo: 'egreso',
  monto: '186.40',
  fecha: '2026-09-26',
  cuentaId: 'visa',
  destinoId: '',
  categoriaId: 'supermercado',
  descripcion: '  Plaza Vea  ',
  nota: '',
  programado: false,
};

function grupo(v: ValoresMovimiento): FormGroup {
  return new FormGroup(Object.fromEntries(Object.entries(v).map(([k, valor]) => [k, new FormControl(valor)])));
}

describe('formulario de movimiento', () => {
  it('valida el monto', () => {
    expect(validarMonto(new FormControl('45.90'))).toBeNull();
    expect(validarMonto(new FormControl(''))).toEqual({ required: true });
    expect(validarMonto(new FormControl('0'))).toEqual({ positivo: true });
    expect(validarMonto(new FormControl('1.234'))).toEqual({ formato: true });
    expect(validarMonto(new FormControl('9999999999999'))).toEqual({ maximo: true });
  });

  it('un egreso necesita categoría', () => {
    expect(validarMovimiento(grupo({ ...base, categoriaId: '' }))).toEqual({ faltaCategoria: true });
    expect(validarMovimiento(grupo(base))).toBeNull();
  });

  it('una transferencia necesita dos cuentas distintas y no pide categoría', () => {
    const t = { ...base, tipo: 'transferencia' as const, categoriaId: '' };
    expect(validarMovimiento(grupo(t))).toEqual({ faltaDestino: true });
    expect(validarMovimiento(grupo({ ...t, destinoId: 'visa' }))).toEqual({ cuentasIguales: true });
    expect(validarMovimiento(grupo({ ...t, cuentaId: 'bcp', destinoId: 'visa' }))).toBeNull();
  });

  it('arma el registro para la base de datos', () => {
    expect(aMovimientoForm(base)).toEqual({
      tipo: 'egreso',
      estado: 'confirmado',
      monto: 186.4,
      fecha: '2026-09-26',
      cuenta_id: 'visa',
      cuenta_destino_id: null,
      categoria_id: 'supermercado',
      descripcion: 'Plaza Vea',
      nota: null,
    });
  });

  it('una transferencia se guarda sin categoría aunque quede una elegida', () => {
    const registro = aMovimientoForm({ ...base, tipo: 'transferencia', cuentaId: 'bcp', destinoId: 'visa', programado: true });
    expect(registro.categoria_id).toBeNull();
    expect(registro.cuenta_destino_id).toBe('visa');
    expect(registro.estado).toBe('programado');
  });

  it('carga un movimiento existente para editarlo', () => {
    const valores = desdeMovimiento({
      id: '1', tipo: 'ingreso', estado: 'programado', monto: 650, fecha: '2026-09-25', cuenta_id: 'bcp', cuenta_destino_id: null,
      categoria_id: 'trabajos', descripcion: null, nota: 'Andina', anulado_en: null, creado_en: '',
    });
    expect(valores).toMatchObject({ monto: '650.00', programado: true, descripcion: '', nota: 'Andina', destinoId: '' });
  });
});
