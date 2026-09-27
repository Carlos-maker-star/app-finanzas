import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { CatalogoService } from '../../core/api/catalogo.service';
import { CuentasService } from '../../core/api/cuentas.service';
import { accionesMovimiento, TIPOS_CUENTA } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { finDeMes, formatoSoles, hoyISO, inicioDeMes, mesAbreviado, nombreMes } from '../../core/formato';
import { Movimiento, PuntoSaldo } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { ChipIcono } from '../../shared/chip-icono';
import { ConfirmarDatos, ConfirmarDialog } from '../../shared/confirmar-dialog';
import { EstadoBadge } from '../../shared/estado-badge';
import { EstadoVacio } from '../../shared/estado-vacio';
import { FechaRelativaPipe } from '../../shared/fecha-relativa.pipe';
import { Monto } from '../../shared/monto';
import { SolesPipe } from '../../shared/soles.pipe';
import { AccionesMovimiento } from '../movimientos/acciones-movimiento';
import { CuentaDialog } from './cuenta-dialog';

/** Movimiento visto desde una cuenta: si entra o sale dinero y el saldo que dejó. */
interface FilaCuenta {
  m: Movimiento;
  entrada: boolean;
  /** Saldo después del movimiento; null si es programado (todavía no afecta). */
  saldo: number | null;
}

/**
 * Saldo después de cada movimiento, del más reciente al más antiguo, partiendo del saldo actual.
 * Solo los confirmados afectan el saldo.
 */
export function saldosCorridos(cuentaId: string, saldoActual: number, movimientos: Movimiento[]): FilaCuenta[] {
  let saldo = saldoActual;
  return movimientos.map((m) => {
    const entrada = m.cuenta_destino_id === cuentaId || m.tipo === 'ingreso';
    if (m.estado !== 'confirmado') {
      return { m, entrada, saldo: null };
    }
    const fila = { m, entrada, saldo };
    // En céntimos para no arrastrar errores de coma flotante
    saldo = Math.round((saldo - (entrada ? m.monto : -m.monto)) * 100) / 100;
    return fila;
  });
}

@Component({
  selector: 'app-cuenta-detail',
  imports: [
    MatButton, MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatProgressBar, MatTooltip, RouterLink, ChipIcono,
    EstadoBadge, EstadoVacio, FechaRelativaPipe, Monto, SolesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cuenta-detail.html',
})
export class CuentaDetail {
  /** `:id` de la ruta. */
  readonly id = input.required<string>();

  protected readonly catalogo = inject(CatalogoService);
  private readonly servicio = inject(CuentasService);
  private readonly acciones = inject(AccionesMovimiento);
  private readonly dialog = inject(MatDialog);
  private readonly notificar = inject(NotificacionService);
  private readonly router = inject(Router);

  protected readonly tipos = TIPOS_CUENTA;
  protected readonly accionesDe = accionesMovimiento;
  protected readonly mes = nombreMes(hoyISO()).split(' ')[0].toLowerCase();

  protected readonly cuenta = computed(() => this.catalogo.cuenta(this.id()));
  protected readonly noEncontrada = computed(() => this.catalogo.cargado() && !this.cuenta());
  protected readonly esTarjeta = computed(() => this.cuenta()?.tipo === 'tarjeta_credito');

  protected readonly movimientos = signal<Movimiento[] | null>(null);
  protected readonly evolucion = signal<PuntoSaldo[]>([]);
  protected readonly flujo = signal<{ entradas: number; salidas: number; programado: number } | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly recarga = signal(0);

  protected readonly filas = computed(() => {
    const c = this.cuenta();
    const movimientos = this.movimientos();
    return c && movimientos ? saldosCorridos(c.id, c.saldo_actual, movimientos) : [];
  });

  /** Variación del saldo en el mes: entradas − salidas confirmadas. */
  protected readonly variacionMes = computed(() => {
    const f = this.flujo();
    return f ? f.entradas - f.salidas : 0;
  });

  /** Gráfico de línea: puntos en % del área (x de izquierda a derecha, y desde abajo). */
  protected readonly grafico = computed(() => {
    const puntos = this.evolucion();
    if (puntos.length < 2) {
      return null;
    }
    const valores = puntos.map((p) => p.saldo);
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const margen = (max - min || Math.abs(max) || 1) * 0.15;
    const bajo = min - margen;
    const alto = max + margen;
    const n = puntos.length - 1;
    const marcas = puntos.map((p, i) => ({
      x: (i / n) * 100,
      y: ((p.saldo - bajo) / (alto - bajo)) * 100,
      etiqueta: mesAbreviado(p.mes),
      texto: `${nombreMes(p.mes)}: ${formatoSoles(p.saldo)}`,
      ultimo: i === n,
    }));
    return {
      marcas,
      linea: marcas.map((m) => `${m.x},${100 - m.y}`).join(' '),
      area: `0,100 ${marcas.map((m) => `${m.x},${100 - m.y}`).join(' ')} 100,100`,
      resumen: marcas.map((m) => m.texto).join('. '),
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.recarga();
      this.cargar(id);
    });
  }

  private async cargar(id: string): Promise<void> {
    this.error.set(null);
    const hoy = hoyISO();
    try {
      const [movimientos, evolucion, flujo] = await Promise.all([
        this.servicio.movimientos(id, 12),
        this.servicio.evolucion(id, 6),
        this.servicio.flujo(id, inicioDeMes(hoy), finDeMes(hoy)),
      ]);
      if (id === this.id()) {
        this.movimientos.set(movimientos);
        this.evolucion.set(evolucion);
        this.flujo.set(flujo);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  protected recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  protected titulo(m: Movimiento): string {
    if (m.tipo === 'transferencia') {
      const otra = this.catalogo.cuenta(m.cuenta_id === this.id() ? m.cuenta_destino_id : m.cuenta_id)?.nombre;
      const flecha = m.cuenta_id === this.id() ? '→' : '←';
      return `${m.descripcion || 'Transferencia'} ${flecha} ${otra ?? ''}`.trim();
    }
    return m.descripcion || this.catalogo.nombreCategoria(m.categoria_id);
  }

  protected editar(): void {
    const ref = this.dialog.open(CuentaDialog, { data: { cuenta: this.cuenta() } });
    ref.afterClosed().subscribe((ok) => ok && this.recargar());
  }

  protected async archivar(archivar: boolean): Promise<void> {
    const c = this.cuenta();
    if (!c) {
      return;
    }
    if (archivar) {
      const datos: ConfirmarDatos = {
        titulo: `¿Archivar "${c.nombre}"?`,
        mensaje:
          'Ya no aparecerá al registrar movimientos, pero su historial y su saldo se conservan. Puedes restaurarla cuando quieras.',
        confirmar: 'Archivar',
      };
      const ok = await firstValueFrom(this.dialog.open(ConfirmarDialog, { data: datos, width: '440px' }).afterClosed());
      if (!ok) {
        return;
      }
    }
    try {
      await this.servicio.archivar(c.id, archivar);
      this.notificar.exito(archivar ? 'Cuenta archivada.' : 'Cuenta restaurada.');
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    }
  }

  protected async eliminar(): Promise<void> {
    const c = this.cuenta();
    if (!c) {
      return;
    }
    const datos: ConfirmarDatos = {
      titulo: `¿Eliminar "${c.nombre}"?`,
      mensaje: 'Se borrará para siempre. Solo es posible si la cuenta no tiene ningún movimiento; si tiene, archívala.',
      confirmar: 'Eliminar',
      peligro: true,
    };
    const ok = await firstValueFrom(this.dialog.open(ConfirmarDialog, { data: datos, width: '440px' }).afterClosed());
    if (!ok) {
      return;
    }
    try {
      await this.servicio.eliminar(c.id);
      this.notificar.exito('Cuenta eliminada.');
      await this.router.navigate(['/cuentas']);
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    }
  }

  protected async nuevoMovimiento(transferencia = false): Promise<void> {
    const ok = await this.acciones.nuevo({ cuentaId: this.id(), tipo: transferencia ? 'transferencia' : undefined });
    if (ok) this.recargar();
  }

  protected async editarMovimiento(m: Movimiento): Promise<void> {
    if (await this.acciones.editar(m)) this.recargar();
  }

  protected async confirmarMovimiento(m: Movimiento): Promise<void> {
    if (await this.acciones.confirmar(m)) this.recargar();
  }

  protected async anularMovimiento(m: Movimiento): Promise<void> {
    if (await this.acciones.anular(m)) this.recargar();
  }
}
