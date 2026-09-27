import { fechaRelativa, finDeMes, formatoSoles, hoyISO, leerMonto, mesAbreviado, montoConSigno, sumarMeses, variacion } from './formato';

/** Intl separa 'S/' del número con un espacio no separable: se normaliza a espacio común para comparar. */
const n = (texto: string) => texto.replace(/\p{Zs}/gu, ' ');

describe('formato', () => {
  it('formatea soles con separador de miles y dos decimales', () => {
    expect(n(formatoSoles(1234.5))).toBe('S/ 1,234.50');
    expect(n(formatoSoles(0))).toBe('S/ 0.00');
    expect(n(formatoSoles(-1284.6))).toBe('−S/ 1,284.60');
  });

  it('pone el signo según el tipo de movimiento', () => {
    expect(n(montoConSigno('ingreso', 650))).toBe('+S/ 650.00');
    expect(n(montoConSigno('egreso', 45.9))).toBe('−S/ 45.90');
    expect(n(montoConSigno('transferencia', 500))).toBe('S/ 500.00');
  });

  it('muestra fechas relativas a hoy', () => {
    const hoy = '2026-09-26';
    expect(fechaRelativa('2026-09-26', hoy)).toBe('Hoy');
    expect(fechaRelativa('2026-09-25', hoy)).toBe('Ayer');
    expect(fechaRelativa('2026-09-27', hoy)).toBe('Mañana');
    expect(fechaRelativa('2026-09-24', hoy)).toMatch(/^24 (set|sep)/);
    expect(fechaRelativa('2025-12-31', hoy)).toMatch(/2025$/);
  });

  it('usa la fecha de Lima, no la de UTC', () => {
    // 26 sep 2026 a las 23:30 en Lima = 27 sep 04:30 UTC
    expect(hoyISO(new Date('2026-09-27T04:30:00Z'))).toBe('2026-09-26');
  });

  it('calcula límites y saltos de mes', () => {
    expect(finDeMes('2026-02-10')).toBe('2026-02-28');
    expect(finDeMes('2028-02-01')).toBe('2028-02-29');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(mesAbreviado('2026-09')).toMatch(/^S(et|ep)/);
  });

  it('lee montos escritos por el usuario', () => {
    expect(leerMonto('1,250.5')).toBe(1250.5);
    expect(leerMonto('S/ 30')).toBe(30);
    expect(leerMonto('45.90')).toBe(45.9);
    expect(leerMonto('12.345')).toBeNull();
    expect(leerMonto('abc')).toBeNull();
    expect(leerMonto('-5')).toBeNull();
  });

  it('calcula la variación porcentual contra el mes anterior', () => {
    expect(variacion(5850, 5200)).toBe(12.5);
    expect(variacion(3412.7, 3655.2)).toBe(-6.6);
    expect(variacion(100, 0)).toBeNull();
  });
});
