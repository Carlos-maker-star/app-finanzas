import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { colorVisible } from '../core/etiquetas';
import { TemaService } from '../core/tema.service';

const TAMANIOS = {
  sm: { caja: 'size-6 rounded-md', icono: 'text-[15px]! size-[15px]!' },
  md: { caja: 'size-9 rounded-[10px]', icono: 'icono-sm' },
  lg: { caja: 'size-10 rounded-[10px]', icono: '' },
  xl: { caja: 'size-13 rounded-xl', icono: 'text-[26px]! size-[26px]!' },
};

/** Ícono sobre un fondo suave del color de la cuenta o categoría (un dato del usuario). */
@Component({
  selector: 'app-chip-icono',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="flex shrink-0 items-center justify-center" [class]="tamanio().caja" [style.background]="fondo()" [style.color]="color()">
      <!-- m-0!: Material le pone margen a los íconos dentro de mat-option y los descentra -->
      <mat-icon class="m-0!" [class]="tamanio().icono" aria-hidden="true">{{ icono() || 'category' }}</mat-icon>
    </span>
  `,
})
export class ChipIcono {
  private readonly tema = inject(TemaService);

  readonly icono = input<string | null | undefined>();
  readonly colorBase = input<string | null | undefined>(null, { alias: 'color' });
  readonly tam = input<keyof typeof TAMANIOS>('md', { alias: 'tamanio' });

  protected readonly tamanio = computed(() => TAMANIOS[this.tam()]);
  protected readonly color = computed(() => colorVisible(this.colorBase(), this.tema.oscuro()));
  /** Mismo color con transparencia: 10% en claro, 18% en oscuro. */
  protected readonly fondo = computed(() => `${this.color()}${this.tema.oscuro() ? '2E' : '1A'}`);
}
