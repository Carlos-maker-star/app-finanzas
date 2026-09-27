import { TipoMovimiento } from './models';

// Formato de dinero y fechas para Perú (soles, hora de Lima).

const ZONA = 'America/Lima';
const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const diaMes = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaMesAnio = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const mesAnio = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const mesCorto = new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'UTC' });

/** `S/ 1,234.50`. Los negativos llevan el signo menos tipográfico delante: `−S/ 20.00`. */
export function formatoSoles(monto: number): string {
  const texto = soles.format(Math.abs(monto));
  return monto < 0 ? `−${texto}` : texto;
}

/** Monto con el signo que corresponde al tipo: `+S/ 10.00`, `−S/ 10.00` o sin signo (transferencia). */
export function montoConSigno(tipo: TipoMovimiento, monto: number): string {
  const texto = soles.format(Math.abs(monto));
  if (tipo === 'ingreso') {
    return `+${texto}`;
  }
  if (tipo === 'egreso') {
    return `−${texto}`;
  }
  return texto;
}

/** Fecha de hoy en Lima como `YYYY-MM-DD`. */
export function hoyISO(ahora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** `YYYY-MM-DD` → Date a medianoche UTC (solo para aritmética de días y formato). */
function aFecha(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return aISO(f);
}

/** "Hoy", "Ayer", "Mañana", "24 set." o "24 set. 2025" si es de otro año. */
export function fechaRelativa(iso: string, hoy = hoyISO()): string {
  const dias = Math.round((aFecha(iso).getTime() - aFecha(hoy).getTime()) / 86_400_000);
  if (dias === 0) {
    return 'Hoy';
  }
  if (dias === -1) {
    return 'Ayer';
  }
  if (dias === 1) {
    return 'Mañana';
  }
  const mismaAnio = iso.slice(0, 4) === hoy.slice(0, 4);
  return (mismaAnio ? diaMes : diaMesAnio).format(aFecha(iso));
}

/** Primer día del mes de una fecha: `2026-09-01`. */
export function inicioDeMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha. */
export function finDeMes(iso: string): string {
  const f = aFecha(inicioDeMes(iso));
  f.setUTCMonth(f.getUTCMonth() + 1);
  f.setUTCDate(0);
  return aISO(f);
}

/** Suma meses a un `YYYY-MM-01`. */
export function sumarMeses(inicio: string, meses: number): string {
  const f = aFecha(inicioDeMes(inicio));
  f.setUTCMonth(f.getUTCMonth() + meses);
  return aISO(f);
}

/** "septiembre de 2026" → con mayúscula inicial: "Septiembre de 2026". */
export function nombreMes(iso: string): string {
  const texto = mesAnio.format(aFecha(inicioDeMes(iso)));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Abreviatura para ejes de gráficos: "Set", "Oct". Acepta `YYYY-MM` o `YYYY-MM-DD`. */
export function mesAbreviado(iso: string): string {
  const texto = mesCorto.format(aFecha(iso.length === 7 ? `${iso}-01` : iso)).replace('.', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Convierte lo que escribe el usuario ("1,250.5", "S/ 30") en número con 2 decimales, o null. */
export function leerMonto(texto: string | number | null | undefined): number | null {
  if (typeof texto === 'number') {
    return Number.isFinite(texto) ? Math.round(texto * 100) / 100 : null;
  }
  const limpio = (texto ?? '').replace(/S\/|\s|,/gi, '');
  if (!/^\d+(\.\d{0,2})?$/.test(limpio)) {
    return null;
  }
  return Math.round(Number(limpio) * 100) / 100;
}

/** Variación porcentual con un decimal; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) {
    return null;
  }
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}
