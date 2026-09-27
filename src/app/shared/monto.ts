import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { montoConSigno } from '../core/formato';
import { EstadoMovimiento, TipoMovimiento } from '../core/models';

/**
 * Monto de un movimiento: verde con + (ingreso), rojo con − (egreso), sin signo (transferencia).
 * El signo acompaña siempre al color para no depender solo de él. Anulado: tachado y gris.
 * `sentido` fuerza entrada/salida (p. ej. una transferencia vista desde una cuenta).
 */
@Component({
  selector: 'app-monto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="whitespace-nowrap font-mono text-sm font-semibold tabular-nums" [class]="clases()">{{ texto() }}</span>`,
})
export class Monto {
  readonly tipo = input.required<TipoMovimiento>();
  readonly monto = input.required<number>();
  readonly estado = input<EstadoMovimiento>('confirmado');
  readonly sentido = input<'entrada' | 'salida' | null>(null);

  private readonly tipoVisible = computed<TipoMovimiento>(() => {
    const s = this.sentido();
    return s === 'entrada' ? 'ingreso' : s === 'salida' ? 'egreso' : this.tipo();
  });

  protected readonly texto = computed(() => montoConSigno(this.tipoVisible(), this.monto()));

  protected readonly clases = computed(() => {
    if (this.estado() === 'anulado') {
      return 'text-subtle line-through';
    }
    // Una transferencia vista desde una cuenta lleva signo, pero no se pinta como ingreso/egreso
    if (this.tipo() === 'transferencia') {
      return 'text-ink';
    }
    return this.tipo() === 'ingreso' ? 'text-ingreso' : 'text-egreso';
  });
}
