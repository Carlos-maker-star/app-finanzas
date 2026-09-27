import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { CatalogoService } from '../../core/api/catalogo.service';
import { DashboardService } from '../../core/api/dashboard.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { AuthService } from '../../core/auth/auth.service';
import { colorVisible, TIPOS_CUENTA } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { formatoSoles, hoyISO, inicioDeMes, mesAbreviado, nombreMes, sumarMeses, variacion } from '../../core/formato';
import { Movimiento, ResumenDashboard } from '../../core/models';
import { TemaService } from '../../core/tema.service';
import { ChipIcono } from '../../shared/chip-icono';
import { EstadoVacio } from '../../shared/estado-vacio';
import { FechaRelativaPipe } from '../../shared/fecha-relativa.pipe';
import { Monto } from '../../shared/monto';
import { SolesPipe } from '../../shared/soles.pipe';
import { AccionesMovimiento } from '../movimientos/acciones-movimiento';

interface Comparacion {
  texto: string;
  /** Si el cambio es bueno para el usuario (más ingresos, menos egresos). */
  bueno: boolean | null;
}

/** Tope "redondo" del eje: 5,850 → 6,000 (3 tramos de 2,000). */
export function escalaEje(maximo: number, tramos = 3): number {
  if (maximo <= 0) {
    return tramos * 100;
  }
  const bruto = maximo / tramos;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / potencia;
  const paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * potencia;
  return paso * tramos;
}

function etiquetaEje(valor: number): string {
  return valor >= 1000 ? `${valor / 1000}k` : String(valor);
}

@Component({
  selector: 'app-dashboard',
  imports: [MatButton, MatIconButton, MatIcon, MatTooltip, RouterLink, ChipIcono, EstadoVacio, FechaRelativaPipe, Monto, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly servicio = inject(DashboardService);
  private readonly movimientos = inject(MovimientosService);
  private readonly acciones = inject(AccionesMovimiento);
  private readonly tema = inject(TemaService);
  protected readonly catalogo = inject(CatalogoService);
  protected readonly tiposCuenta = TIPOS_CUENTA;

  private readonly mesActual = inicioDeMes(hoyISO());
  protected readonly mes = signal(this.mesActual);
  protected readonly esMesActual = computed(() => this.mes() === this.mesActual);
  protected readonly nombreMes = computed(() => nombreMes(this.mes()));
  private readonly nombreMesAnterior = computed(() => nombreMes(sumarMeses(this.mes(), -1)).split(' ')[0].toLowerCase());

  protected readonly resumen = signal<ResumenDashboard | null>(null);
  protected readonly recientes = signal<Movimiento[] | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly recarga = signal(0);

  protected readonly saludo = saludoSegunHora();
  protected readonly primerNombre = computed(() => this.auth.perfil()?.nombre.split(' ')[0] ?? '');
  protected readonly sinCuentas = computed(() => this.catalogo.cargado() && this.catalogo.cuentas().length === 0);

  protected readonly comparacionIngresos = computed(() => {
    const r = this.resumen();
    return r ? this.comparar(r.ingresos_mes, r.ingresos_mes_anterior, true) : null;
  });
  protected readonly comparacionEgresos = computed(() => {
    const r = this.resumen();
    return r ? this.comparar(r.egresos_mes, r.egresos_mes_anterior, false) : null;
  });

  /** Gráfico de barras agrupadas: alturas en % del tope del eje. */
  protected readonly grafico = computed(() => {
    const serie = this.resumen()?.serie_6_meses ?? [];
    const tope = escalaEje(Math.max(0, ...serie.flatMap((p) => [p.ingresos, p.egresos])));
    return {
      lineas: [3, 2, 1, 0].map((i) => ({ etiqueta: etiquetaEje((tope / 3) * i), abajo: `${(i / 3) * 100}%` })),
      meses: serie.map((p, i) => ({
        etiqueta: mesAbreviado(p.mes),
        actual: i === serie.length - 1,
        ingresos: p.ingresos,
        egresos: p.egresos,
        altoIngresos: `${(p.ingresos / tope) * 100}%`,
        altoEgresos: `${(p.egresos / tope) * 100}%`,
        resumen: `${nombreMes(`${p.mes}-01`)}: ingresos ${formatoSoles(p.ingresos)}, egresos ${formatoSoles(p.egresos)}`,
      })),
    };
  });

  protected readonly gastos = computed(() => {
    const r = this.resumen();
    if (!r || !r.gastos_por_categoria.length) {
      return [];
    }
    const total = r.egresos_mes || 1;
    const mayor = r.gastos_por_categoria[0].total || 1;
    const principales = r.gastos_por_categoria.slice(0, 6);
    const resto = r.gastos_por_categoria.slice(6);
    const oscuro = this.tema.oscuro();
    const filas = principales.map((g) => ({
      ...g,
      porcentaje: Math.round((g.total / total) * 100),
      ancho: `${(g.total / mayor) * 100}%`,
      colorBarra: colorVisible(g.color, oscuro),
    }));
    if (resto.length) {
      const suma = resto.reduce((s, g) => s + g.total, 0);
      filas.push({
        categoria_id: 'otras',
        nombre: `Otras (${resto.length} ${resto.length === 1 ? 'categoría' : 'categorías'})`,
        icono: 'more_horiz',
        color: '#64748B',
        total: suma,
        porcentaje: Math.round((suma / total) * 100),
        ancho: `${(suma / mayor) * 100}%`,
        colorBarra: colorVisible('#64748B', oscuro),
      });
    }
    return filas;
  });

  constructor() {
    let peticion = 0;
    effect(() => {
      const mes = this.mes();
      this.recarga();
      const esta = ++peticion;
      untracked(() => this.error.set(null));
      this.servicio
        .resumen(mes)
        .then((r) => esta === peticion && this.resumen.set(r))
        .catch((e) => esta === peticion && this.error.set(mensajeDeError(e)));
    });
    effect(() => {
      this.recarga();
      this.movimientos
        .recientes(5)
        .then((m) => this.recientes.set(m))
        .catch(() => this.recientes.set([]));
    });
  }

  protected cambiarMes(delta: number): void {
    this.resumen.set(null);
    this.mes.update((m) => sumarMeses(m, delta));
  }

  protected titulo(m: Movimiento): string {
    return m.descripcion || (m.tipo === 'transferencia' ? 'Transferencia' : this.catalogo.nombreCategoria(m.categoria_id));
  }

  protected detalle(m: Movimiento): string {
    const categoria = m.tipo === 'transferencia' ? 'Transferencia' : this.catalogo.nombreCategoria(m.categoria_id);
    const origen = this.catalogo.cuenta(m.cuenta_id)?.nombre ?? '';
    const destino = this.catalogo.cuenta(m.cuenta_destino_id)?.nombre;
    return `${categoria} · ${destino ? `${origen} → ${destino}` : origen}`;
  }

  protected async nuevo(): Promise<void> {
    if (await this.acciones.nuevo()) {
      this.recarga.update((n) => n + 1);
    }
  }

  private comparar(actual: number, anterior: number, masEsMejor: boolean): Comparacion {
    const v = variacion(actual, anterior);
    if (v === null) {
      return { texto: `Sin datos de ${this.nombreMesAnterior()} para comparar`, bueno: null };
    }
    const signo = v > 0 ? '+' : v < 0 ? '−' : '';
    return {
      texto: `${signo}${Math.abs(v).toFixed(1)}% vs. ${this.nombreMesAnterior()}`,
      bueno: v === 0 ? null : masEsMejor ? v > 0 : v < 0,
    };
  }
}

function saludoSegunHora(): string {
  const hora = Number(new Intl.DateTimeFormat('es-PE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Lima' }).format(new Date()));
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}
