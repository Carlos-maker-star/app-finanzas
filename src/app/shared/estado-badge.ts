import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { ESTADOS } from '../core/etiquetas';
import { EstadoMovimiento } from '../core/models';

@Component({
  selector: 'app-estado-badge',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold"
      [class]="info().clases"
    >
      @if (info().icono) {
        <mat-icon class="icono-xs" aria-hidden="true">{{ info().icono }}</mat-icon>
      }
      {{ info().etiqueta }}
    </span>
  `,
})
export class EstadoBadge {
  readonly estado = input.required<EstadoMovimiento>();
  protected readonly info = computed(() => ESTADOS[this.estado()]);
}
