import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { CuentasService } from '../../core/api/cuentas.service';
import { COLORES, colorVisible, LISTA_TIPOS_CUENTA, TIPOS_CUENTA } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { leerMonto } from '../../core/formato';
import { Cuenta, CuentaForm, TipoCuenta } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { TemaService } from '../../core/tema.service';
import { ChipIcono } from '../../shared/chip-icono';
import { SolesPipe } from '../../shared/soles.pipe';
import { MONTO_MAXIMO } from '../movimientos/movimiento-form';

/** Saldo inicial: 0 o positivo (en tarjetas es la deuda, que se guarda en negativo). */
function saldoValido(texto: string): boolean {
  if (texto.trim() === '') {
    return true;
  }
  const monto = leerMonto(texto);
  return monto !== null && monto <= MONTO_MAXIMO;
}

@Component({
  selector: 'app-cuenta-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButton, MatButtonToggleGroup, MatButtonToggle, MatFormField, MatLabel, MatError,
    MatHint, MatPrefix, MatInput, MatIcon, MatProgressBar, ChipIcono, SolesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ cuenta ? 'Editar cuenta' : 'Nueva cuenta' }}</h2>
    <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
      <mat-dialog-content class="flex! flex-col gap-4 pt-2!">
        @if (error()) {
          <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
        }
        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" maxlength="60" placeholder="Ej. BCP Sueldo, Efectivo, Yape" />
          <mat-hint>Así la verás en tus movimientos y reportes.</mat-hint>
          @if (form.controls.nombre.hasError('required')) {
            <mat-error>Ponle un nombre a la cuenta</mat-error>
          }
        </mat-form-field>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-medium" id="tipo-cuenta">Tipo de cuenta</span>
          <mat-button-toggle-group formControlName="tipo" aria-labelledby="tipo-cuenta" class="grid! grid-cols-2 sm:grid-cols-5" hideSingleSelectionIndicator>
            @for (t of tipos; track t) {
              <mat-button-toggle [value]="t" class="h-auto!">
                <span class="flex flex-col items-center gap-1 py-2 text-xs leading-tight font-semibold whitespace-normal">
                  <mat-icon aria-hidden="true">{{ etiquetas[t].icono }}</mat-icon>{{ etiquetas[t].etiqueta }}
                </span>
              </mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>

        <mat-form-field>
          <mat-label>{{ esTarjeta() ? 'Deuda actual de la tarjeta' : 'Saldo inicial' }}</mat-label>
          <span matTextPrefix class="mr-1 font-semibold text-subtle">S/</span>
          <input matInput formControlName="saldo" inputmode="decimal" placeholder="0.00" class="font-mono" />
          <mat-hint>
            {{ esTarjeta() ? 'Lo que debes hoy. Tus compras con la tarjeta la aumentan; tus pagos la reducen.' : 'Lo que tienes hoy en esta cuenta.' }}
            @if (cuenta) { Cambiarlo recalcula el saldo. }
          </mat-hint>
          @if (form.controls.saldo.hasError('saldo')) {
            <mat-error>Usa solo números, con hasta 2 decimales (ej. 1500.00)</mat-error>
          }
        </mat-form-field>

        <div class="flex flex-col gap-2">
          <span class="text-[13px] font-medium" id="color-cuenta">Color</span>
          <div role="radiogroup" aria-labelledby="color-cuenta" class="flex flex-wrap gap-2.5">
            @for (c of colores; track c.claro) {
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="form.controls.color.value === c.claro"
                [attr.aria-label]="c.nombre"
                class="flex size-8 cursor-pointer items-center justify-center rounded-full border-0"
                [style.background]="visible(c.claro)"
                [style.box-shadow]="form.controls.color.value === c.claro ? '0 0 0 2px var(--app-surface), 0 0 0 4px ' + visible(c.claro) : 'none'"
                (click)="form.controls.color.setValue(c.claro)"
              >
                @if (form.controls.color.value === c.claro) {
                  <mat-icon class="icono-sm text-white dark:text-app" aria-hidden="true">check</mat-icon>
                }
              </button>
            }
          </div>
        </div>

        <div class="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
          <span class="text-xs font-medium text-subtle">Vista previa</span>
          <app-chip-icono [icono]="icono()" [color]="valores().color" />
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="truncate font-medium">{{ valores().nombre || 'Nombre de la cuenta' }}</span>
            <span class="text-xs text-subtle">{{ etiquetas[valores().tipo].etiqueta }}</span>
          </div>
          <span class="font-mono font-semibold" [class.text-egreso]="saldoFirmado() < 0">{{ saldoFirmado() | soles }}</span>
        </div>
      </mat-dialog-content>

      <div class="h-1">
        @if (guardando()) {
          <mat-progress-bar mode="indeterminate" />
        }
      </div>
      <mat-dialog-actions align="end">
        <button matButton="outlined" type="button" mat-dialog-close>Cancelar</button>
        <button matButton="filled" type="submit" [disabled]="guardando()"><mat-icon>check</mat-icon>{{ cuenta ? 'Guardar' : 'Crear cuenta' }}</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CuentaDialog {
  protected readonly cuenta = inject<{ cuenta?: Cuenta }>(MAT_DIALOG_DATA)?.cuenta;
  private readonly ref = inject<MatDialogRef<CuentaDialog, boolean>>(MatDialogRef);
  private readonly servicio = inject(CuentasService);
  private readonly notificar = inject(NotificacionService);
  private readonly tema = inject(TemaService);

  protected readonly tipos = LISTA_TIPOS_CUENTA;
  protected readonly etiquetas = TIPOS_CUENTA;
  protected readonly colores = COLORES;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [this.cuenta?.nombre ?? '', [Validators.required, Validators.maxLength(60)]],
    tipo: (this.cuenta?.tipo ?? 'banco') as TipoCuenta,
    saldo: [this.cuenta ? Math.abs(this.cuenta.saldo_inicial).toFixed(2) : '', (c: AbstractControl) => (saldoValido(String(c.value)) ? null : { saldo: true })],
    color: this.cuenta?.color ?? COLORES[0].claro,
  });

  protected readonly valores = toSignal(this.form.valueChanges.pipe(map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });
  protected readonly esTarjeta = computed(() => this.valores().tipo === 'tarjeta_credito');
  protected readonly icono = computed(() => TIPOS_CUENTA[this.valores().tipo].icono);
  /** En tarjetas, la deuda se guarda en negativo: resta del patrimonio. */
  protected readonly saldoFirmado = computed(() => {
    const monto = leerMonto(this.valores().saldo) ?? 0;
    return this.esTarjeta() ? -monto : monto;
  });

  protected visible(color: string): string {
    return colorVisible(color, this.tema.oscuro());
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const datos: CuentaForm = {
      nombre: v.nombre.trim(),
      tipo: v.tipo,
      saldo_inicial: this.saldoFirmado(),
      color: v.color,
      icono: TIPOS_CUENTA[v.tipo].icono,
    };
    this.guardando.set(true);
    this.error.set(null);
    try {
      if (this.cuenta) {
        await this.servicio.actualizar(this.cuenta.id, datos);
        this.notificar.exito('Cuenta actualizada.');
      } else {
        await this.servicio.crear(datos);
        this.notificar.exito(`Cuenta "${datos.nombre}" creada.`);
      }
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
