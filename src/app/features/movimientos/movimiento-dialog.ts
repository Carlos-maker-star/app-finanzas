import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOption, MatSelect, MatSelectTrigger } from '@angular/material/select';
import { Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { CatalogoService } from '../../core/api/catalogo.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { LISTA_TIPOS_MOVIMIENTO, TIPOS_MOVIMIENTO } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { hoyISO } from '../../core/formato';
import { Movimiento, TipoMovimiento } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { ChipIcono } from '../../shared/chip-icono';
import { SolesPipe } from '../../shared/soles.pipe';
import { aMovimientoForm, desdeMovimiento, validarMonto, validarMovimiento, ValoresMovimiento } from './movimiento-form';

export interface MovimientoDialogDatos {
  /** Si viene, se edita; si no, se crea. */
  movimiento?: Movimiento;
  tipo?: TipoMovimiento;
  cuentaId?: string;
}

/** Crear o editar un movimiento. Se cierra con `true` si guardó al menos uno. */
@Component({
  selector: 'app-movimiento-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleGroup, MatButtonToggle, MatCheckbox, MatFormField,
    MatLabel, MatError, MatHint, MatPrefix, MatInput, MatSelect, MatSelectTrigger, MatOption, MatIcon, MatProgressBar,
    ChipIcono, SolesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimiento-dialog.html',
})
export class MovimientoDialog {
  private readonly datos = inject<MovimientoDialogDatos>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<MovimientoDialog, boolean>>(MatDialogRef);
  private readonly servicio = inject(MovimientosService);
  private readonly notificar = inject(NotificacionService);
  private readonly router = inject(Router);
  protected readonly catalogo = inject(CatalogoService);

  protected readonly tipos = LISTA_TIPOS_MOVIMIENTO;
  protected readonly etiquetasTipo = TIPOS_MOVIMIENTO;
  protected readonly editando = this.datos.movimiento;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  private guardados = 0;

  private readonly montoInput = viewChild<ElementRef<HTMLInputElement>>('montoInput');

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      tipo: this.datos.tipo ?? ('egreso' as TipoMovimiento),
      monto: ['', validarMonto],
      fecha: [hoyISO(), Validators.required],
      cuentaId: this.datos.cuentaId ?? this.catalogo.cuentasActivas()[0]?.id ?? '',
      destinoId: '',
      categoriaId: '',
      descripcion: ['', Validators.maxLength(200)],
      nota: ['', Validators.maxLength(1000)],
      programado: false,
    },
    { validators: validarMovimiento },
  );

  protected readonly tipo = toSignal(this.form.controls.tipo.valueChanges, { initialValue: this.form.controls.tipo.value });
  private readonly valores = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Cuentas elegibles: las activas y, al editar, la que ya tenía aunque esté archivada. */
  protected readonly cuentas = computed(() => {
    const actuales = [this.editando?.cuenta_id, this.editando?.cuenta_destino_id];
    return this.catalogo.cuentas().filter((c) => !c.archivada || actuales.includes(c.id));
  });

  /** Categorías del tipo elegido: activas y, al editar, la que ya tenía aunque esté desactivada. */
  protected readonly grupos = computed(() => {
    const tipo = this.tipo() === 'ingreso' ? 'ingreso' : 'egreso';
    const actual = this.editando?.categoria_id;
    const visible = (id: string, activa: boolean) => activa || id === actual;
    return this.catalogo
      .grupos(tipo)
      .filter((g) => visible(g.categoria.id, g.categoria.activa) || g.subcategorias.some((s) => visible(s.id, s.activa)))
      .map((g) => ({ ...g, subcategorias: g.subcategorias.filter((s) => visible(s.id, s.activa)) }));
  });

  protected readonly cuentaElegida = computed(() => this.catalogo.cuenta(this.valores().cuentaId));
  protected readonly destinoElegido = computed(() => this.catalogo.cuenta(this.valores().destinoId));
  protected readonly categoriaElegida = computed(() => this.catalogo.categoria(this.valores().categoriaId));

  /** Un movimiento ya confirmado no puede volver a programado (regla de la base de datos). */
  protected readonly mostrarProgramado = !this.editando || this.editando.estado === 'programado';

  constructor() {
    if (this.editando) {
      this.form.setValue(desdeMovimiento(this.editando));
    }
    // Cerrar con Esc o clic fuera también informa si se guardó algo ("Guardar y registrar otro")
    this.ref.disableClose = true;
    this.ref.backdropClick().pipe(takeUntilDestroyed()).subscribe(() => this.cerrar());
    this.ref
      .keydownEvents()
      .pipe(filter((e) => e.key === 'Escape'), takeUntilDestroyed())
      .subscribe(() => this.cerrar());
    // Al cambiar de tipo se limpian los campos que ya no aplican
    this.form.controls.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      if (tipo === 'transferencia') {
        this.form.patchValue({ categoriaId: '' });
      } else {
        this.form.patchValue({ destinoId: '' });
        const categoria = this.catalogo.categoria(this.form.controls.categoriaId.value);
        if (categoria && categoria.tipo !== tipo) {
          this.form.patchValue({ categoriaId: '' });
        }
      }
    });
  }

  protected irACuentas(): void {
    this.ref.close(false);
    this.router.navigate(['/cuentas']);
  }

  protected async guardar(otro = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando.set(true);
    this.error.set(null);
    const movimiento = aMovimientoForm(this.form.getRawValue() as ValoresMovimiento);
    try {
      if (this.editando) {
        await this.servicio.actualizar(this.editando.id, movimiento);
        this.notificar.exito('Movimiento actualizado.');
      } else {
        await this.servicio.crear(movimiento);
        this.notificar.exito(movimiento.estado === 'programado' ? 'Movimiento programado.' : 'Movimiento registrado.');
      }
      this.guardados++;
      await this.catalogo.recargarCuentas();
      if (otro) {
        // Conserva tipo, fecha, cuenta y categoría: lo habitual es registrar varios parecidos
        this.form.patchValue({ monto: '', descripcion: '', nota: '' });
        this.form.markAsUntouched();
        this.montoInput()?.nativeElement.focus();
      } else {
        this.ref.close(true);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected cerrar(): void {
    this.ref.close(this.guardados > 0);
  }
}
