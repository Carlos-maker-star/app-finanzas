import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect } from '@angular/material/select';
import { CatalogoService } from '../../core/api/catalogo.service';
import { CategoriasService } from '../../core/api/categorias.service';
import { COLORES, colorVisible, ICONOS_CATEGORIA } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { Categoria, CategoriaForm, TipoCategoria } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { TemaService } from '../../core/tema.service';
import { BuscadorSelect } from '../../shared/buscador-select';
import { filtrar } from '../../shared/buscar';
import { ChipIcono } from '../../shared/chip-icono';

export interface CategoriaDialogDatos {
  categoria?: Categoria;
  tipo?: TipoCategoria;
  /** Para "Agregar subcategoría" desde una categoría principal. */
  padreId?: string;
}

@Component({
  selector: 'app-categoria-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleGroup, MatButtonToggle, MatFormField, MatLabel, MatError,
    MatHint, MatInput, MatSelect, MatOption, MatIcon, MatProgressBar, BuscadorSelect, ChipIcono,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ categoria ? 'Editar categoría' : 'Nueva categoría' }}</h2>
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <mat-dialog-content class="flex! flex-col gap-4 pt-2!">
        @if (error()) {
          <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
        }
        @if (!categoria) {
          <mat-button-toggle-group formControlName="tipo" aria-label="Tipo de categoría" class="grid! grid-cols-2" hideSingleSelectionIndicator>
            <mat-button-toggle value="egreso"><span class="inline-flex items-center gap-1.5"><mat-icon class="icono-sm" aria-hidden="true">north_east</mat-icon>Egreso</span></mat-button-toggle>
            <mat-button-toggle value="ingreso"><span class="inline-flex items-center gap-1.5"><mat-icon class="icono-sm" aria-hidden="true">south_west</mat-icon>Ingreso</span></mat-button-toggle>
          </mat-button-toggle-group>
        }

        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="50" placeholder="Ej. Cafeterías" />
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>Ponle un nombre</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Dentro de (opcional)</mat-label>
          <mat-select formControlName="padreId">
            <app-buscador-select [(texto)]="busquedaPadre" placeholder="Buscar categoría…" />
            <mat-option value="">Ninguna: es una categoría principal</mat-option>
            @for (p of padresFiltrados(); track p.id) {
              <mat-option [value]="p.id">
                <span class="flex items-center gap-2"><app-chip-icono [icono]="p.icono" [color]="p.color" tamanio="sm" />{{ p.nombre }}</span>
              </mat-option>
            } @empty {
              @if (busquedaPadre()) {
                <mat-option disabled>Sin resultados para “{{ busquedaPadre() }}”</mat-option>
              }
            }
          </mat-select>
          <mat-hint>
            {{ tieneHijas ? 'Tiene subcategorías, así que debe seguir siendo principal.' : 'Las subcategorías usan el color de su categoría.' }}
          </mat-hint>
        </mat-form-field>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-medium" id="icono-categoria">Ícono</span>
          <div role="radiogroup" aria-labelledby="icono-categoria" class="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
            @for (i of iconos; track i) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="valores().icono === i"
                [attr.aria-label]="i"
                class="flex h-9 cursor-pointer items-center justify-center rounded-lg border bg-surface p-0"
                [class]="valores().icono === i ? 'border-2' : 'border-line text-muted'"
                [style.border-color]="valores().icono === i ? colorElegido() : null"
                [style.color]="valores().icono === i ? colorElegido() : null"
                (click)="form.controls.icono.setValue(i)"
              >
                <mat-icon class="icono-sm" aria-hidden="true">{{ i }}</mat-icon>
              </button>
            }
          </div>
        </div>

        @if (!valores().padreId) {
          <div class="flex flex-col gap-2">
            <span class="text-[13px] font-medium" id="color-categoria">Color</span>
            <div role="radiogroup" aria-labelledby="color-categoria" class="flex flex-wrap gap-2.5">
              @for (c of colores; track c.claro) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="valores().color === c.claro"
                  [attr.aria-label]="c.nombre"
                  class="flex size-8 cursor-pointer items-center justify-center rounded-full border-0"
                  [style.background]="visible(c.claro)"
                  [style.box-shadow]="valores().color === c.claro ? '0 0 0 2px var(--app-surface), 0 0 0 4px ' + visible(c.claro) : 'none'"
                  (click)="form.controls.color.setValue(c.claro)"
                >
                  @if (valores().color === c.claro) {
                    <mat-icon class="icono-sm text-white dark:text-app" aria-hidden="true">check</mat-icon>
                  }
                </button>
              }
            </div>
          </div>
        }
      </mat-dialog-content>

      <div class="h-1">
        @if (guardando()) {
          <mat-progress-bar mode="indeterminate" />
        }
      </div>
      <mat-dialog-actions align="end">
        <button matButton="outlined" type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="guardando()"><mat-icon>check</mat-icon>{{ categoria ? 'Guardar' : 'Crear categoría' }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CategoriaDialog {
  private readonly datos = inject<CategoriaDialogDatos>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<CategoriaDialog, boolean>>(MatDialogRef);
  private readonly servicio = inject(CategoriasService);
  private readonly catalogo = inject(CatalogoService);
  private readonly notificar = inject(NotificacionService);
  private readonly tema = inject(TemaService);

  protected readonly categoria = this.datos.categoria;
  protected readonly iconos = ICONOS_CATEGORIA;
  protected readonly colores = COLORES;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Una categoría con subcategorías no puede volverse subcategoría (solo hay un nivel). */
  protected readonly tieneHijas = !!this.categoria && this.catalogo.categorias().some((c) => c.padre_id === this.categoria!.id);

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipo: (this.categoria?.tipo ?? this.datos.tipo ?? 'egreso') as TipoCategoria,
    nombre: [this.categoria?.nombre ?? '', [Validators.required, Validators.maxLength(50)]],
    padreId: this.categoria?.padre_id ?? this.datos.padreId ?? '',
    icono: this.categoria?.icono ?? 'shopping_cart',
    color: this.categoria?.color ?? COLORES[5].claro,
  });

  protected readonly valores = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Posibles categorías padre: principales del mismo tipo, sin contarse a sí misma. */
  protected readonly padres = computed(() =>
    this.catalogo
      .categorias()
      .filter((c) => c.tipo === this.valores().tipo && c.padre_id === null && c.id !== this.categoria?.id && c.activa),
  );

  protected readonly busquedaPadre = signal('');
  protected readonly padresFiltrados = computed(() => filtrar(this.padres(), this.busquedaPadre(), (c) => c.nombre));

  /** Color efectivo: el del padre si es subcategoría. */
  protected readonly colorElegido = computed(() => {
    const padre = this.catalogo.categoria(this.valores().padreId);
    return this.visible(padre?.color ?? this.valores().color ?? COLORES[0].claro);
  });

  constructor() {
    if (this.tieneHijas) {
      this.form.controls.padreId.disable();
    }
    // Si cambia el tipo, el padre elegido ya no sirve
    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.form.controls.padreId.setValue(''));
  }

  protected visible(color: string): string {
    return colorVisible(color, this.tema.oscuro());
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const padre = this.catalogo.categoria(v.padreId);
    const datos: CategoriaForm = {
      nombre: v.nombre.trim(),
      tipo: v.tipo,
      padre_id: v.padreId || null,
      icono: v.icono,
      color: padre?.color ?? v.color,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      if (this.categoria) {
        await this.servicio.actualizar(this.categoria.id, datos);
        this.notificar.exito('Categoría actualizada.');
      } else {
        await this.servicio.crear(datos);
        this.notificar.exito(`Categoría "${datos.nombre}" creada.`);
      }
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
