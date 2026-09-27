import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject, input, model, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIcon } from '@angular/material/icon';
import { MatSelect } from '@angular/material/select';

/** Teclas que siguen yendo al mat-select para moverse entre opciones y elegir. */
const TECLAS_DE_NAVEGACION = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'PageUp', 'PageDown'];

/**
 * Buscador dentro de un mat-select: se escribe para filtrar y se elige con clic o con el teclado.
 * El componente padre filtra sus opciones con el texto (ver `shared/buscar.ts`).
 *
 * ```html
 * <mat-select formControlName="cuentaId">
 *   <app-buscador-select [(texto)]="busquedaCuenta" />
 *   @for (c of cuentasFiltradas(); track c.id) { <mat-option [value]="c.id">{{ c.nombre }}</mat-option> }
 *   @empty { <mat-option disabled>Sin resultados</mat-option> }
 * </mat-select>
 * ```
 */
@Component({
  selector: 'app-buscador-select',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sticky top-0 z-10 -mt-2 mb-1 flex items-center gap-2 border-b border-line bg-surface px-4">
      <mat-icon class="icono-sm m-0! shrink-0 text-subtle" aria-hidden="true">search</mat-icon>
      <input
        #campo
        type="text"
        autocomplete="off"
        class="h-11 w-full border-0 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-subtle"
        [placeholder]="placeholder()"
        [attr.aria-label]="placeholder()"
        [value]="texto()"
        (input)="texto.set(campo.value)"
        (keydown)="teclas($event)"
      />
      @if (texto()) {
        <button
          type="button"
          class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-subtle hover:bg-surface-2"
          aria-label="Borrar búsqueda"
          (click)="texto.set(''); campo.focus()"
        >
          <mat-icon class="icono-xs m-0!" aria-hidden="true">close</mat-icon>
        </button>
      }
    </div>
  `,
})
export class BuscadorSelect {
  readonly texto = model('');
  readonly placeholder = input('Escribe para buscar…');

  private readonly select = inject(MatSelect);
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  constructor() {
    // Al abrir, el cursor va directo al buscador; al cerrar, se limpia para la próxima vez
    this.select.openedChange.pipe(takeUntilDestroyed()).subscribe((abierto) => {
      if (abierto) {
        this.campo().nativeElement.focus();
      } else {
        this.texto.set('');
      }
    });
    inject(DestroyRef).onDestroy(() => this.texto.set(''));
  }

  /** Letras, espacio, Inicio/Fin… escriben en el buscador en vez de activar el mat-select. */
  protected teclas(evento: KeyboardEvent): void {
    if (!TECLAS_DE_NAVEGACION.includes(evento.key)) {
      evento.stopPropagation();
    }
  }
}
