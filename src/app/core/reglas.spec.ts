import { escalaEje } from '../features/dashboard/dashboard';
import { saldosCorridos } from '../features/cuentas/cuenta-detail';
import { aCsv, celdaCsv } from './csv';
import { accionesMovimiento, colorVisible } from './etiquetas';
import { Movimiento } from './models';

function mov(parcial: Partial<Movimiento>): Movimiento {
  return {
    id: crypto.randomUUID(),
    tipo: 'egreso',
    estado: 'confirmado',
    monto: 10,
    fecha: '2026-09-20',
    cuenta_id: 'bcp',
    cuenta_destino_id: null,
    categoria_id: 'cat',
    descripcion: null,
    nota: null,
    anulado_en: null,
    creado_en: '2026-09-20T10:00:00Z',
    ...parcial,
  };
}

describe('acciones por estado (espejo del trigger validar_movimiento)', () => {
  it('programado se puede confirmar, editar y anular', () => {
    expect(accionesMovimiento('programado')).toEqual(['confirmar', 'editar', 'anular']);
  });
  it('confirmado se puede editar y anular, pero no volver a programado', () => {
    expect(accionesMovimiento('confirmado')).toEqual(['editar', 'anular']);
  });
  it('anulado ya no admite cambios', () => {
    expect(accionesMovimiento('anulado')).toEqual([]);
  });
});

describe('saldo después de cada movimiento en una cuenta', () => {
  it('recorre del más reciente al más antiguo; los programados no afectan', () => {
    const filas = saldosCorridos('bcp', 4812.4, [
      mov({ estado: 'programado', monto: 1200 }),
      mov({ tipo: 'transferencia', cuenta_destino_id: 'visa', categoria_id: null, monto: 1500 }),
      mov({ tipo: 'ingreso', monto: 650 }),
      mov({ tipo: 'transferencia', cuenta_id: 'efectivo', cuenta_destino_id: 'bcp', categoria_id: null, monto: 100 }),
    ]);
    expect(filas.map((f) => f.saldo)).toEqual([null, 4812.4, 6312.4, 5662.4]);
    expect(filas.map((f) => f.entrada)).toEqual([false, false, true, true]);
  });
});

describe('eje del gráfico', () => {
  it('redondea el tope hacia arriba en tramos bonitos', () => {
    expect(escalaEje(5850)).toBe(6000);
    expect(escalaEje(1000)).toBe(1500);
    expect(escalaEje(0)).toBe(300);
  });
});

describe('colores de datos del usuario', () => {
  it('en modo oscuro usa la variante clara del color', () => {
    expect(colorVisible('#1D4ED8', false)).toBe('#1D4ED8');
    expect(colorVisible('#1d4ed8', true)).toBe('#60A5FA');
    expect(colorVisible(null, false)).toBe('#64748B');
  });
});

describe('CSV', () => {
  it('escapa comas, comillas y saltos de línea', () => {
    expect(celdaCsv('Plaza Vea, San Isidro')).toBe('"Plaza Vea, San Isidro"');
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv(45.9)).toBe('45.90');
    expect(celdaCsv(null)).toBe('');
  });
  it('neutraliza textos que Excel ejecutaría como fórmula', () => {
    expect(celdaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
  it('arma filas separadas por CRLF', () => {
    expect(aCsv(['A', 'B'], [[1, 'x']])).toBe('A,B\r\n1.00,x');
  });
});
