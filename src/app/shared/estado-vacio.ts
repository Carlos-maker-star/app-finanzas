import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';

/** Estado vacío: ícono en círculo, título, una línea de ayuda y (proyectada) la acción. */
@Component({
  selector: 'app-estado-vacio',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span class="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <mat-icon aria-hidden="true">{{ icono() }}</mat-icon>
      </span>
      <p class="m-0 text-base font-semibold">{{ titulo() }}</p>
      @if (texto()) {
        <p class="m-0 max-w-sm text-sm text-muted">{{ texto() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EstadoVacio {
  readonly icono = input('inbox');
  readonly titulo = input.required<string>();
  readonly texto = input<string>();
}
