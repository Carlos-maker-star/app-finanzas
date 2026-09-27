import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { CatalogoService } from '../../core/api/catalogo.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { mensajeDeError } from '../../core/errores';
import { Movimiento } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { ChipIcono } from '../../shared/chip-icono';
import { FechaRelativaPipe } from '../../shared/fecha-relativa.pipe';
import { Monto } from '../../shared/monto';

/** Confirma la anulación de un movimiento (no se borra: queda en el historial como Anulado). */
@Component({
  selector: 'app-anular-dialog',
  imports: [MatDialogModule, MatButton, MatIcon, ChipIcono, Monto, FechaRelativaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>¿Anular este movimiento?</h2>
    <mat-dialog-content class="flex! flex-col gap-4">
      <div class="flex items-start gap-4">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-peligro-bg text-peligro-fg">
          <mat-icon aria-hidden="true">block</mat-icon>
        </span>
        <p class="m-0 text-sm leading-relaxed text-muted">
          El monto dejará de contar en el saldo de <strong class="text-ink">{{ cuentas }}</strong> y en tus reportes.
          El movimiento queda en tu historial como <strong class="text-peligro-fg">Anulado</strong> y ya no se podrá editar.
        </p>
      </div>
      <div class="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
        <app-chip-icono [icono]="icono" [color]="color" />
        <div class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-medium">{{ m.descripcion || titulo }}</span>
          <span class="truncate text-xs text-subtle">{{ titulo }} · {{ cuentas }} · {{ m.fecha | fechaRelativa }}</span>
        </div>
        <app-monto [tipo]="m.tipo" [monto]="m.monto" />
      </div>
      @if (error()) {
        <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" mat-dialog-close>Cancelar</button>
      <button matButton="filled" type="button" class="boton-peligro" [disabled]="anulando()" (click)="anular()">
        <mat-icon>block</mat-icon>Sí, anular
      </button>
    </mat-dialog-actions>
  `,
})
export class AnularDialog {
  protected readonly m = inject<Movimiento>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AnularDialog, boolean>>(MatDialogRef);
  private readonly servicio = inject(MovimientosService);
  private readonly catalogo = inject(CatalogoService);
  private readonly notificar = inject(NotificacionService);

  protected readonly anulando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly categoria = this.catalogo.categoria(this.m.categoria_id);
  protected readonly titulo = this.m.tipo === 'transferencia' ? 'Transferencia' : this.catalogo.nombreCategoria(this.m.categoria_id);
  protected readonly icono = this.m.tipo === 'transferencia' ? 'swap_horiz' : (this.categoria?.icono ?? 'category');
  protected readonly color = this.m.tipo === 'transferencia' ? '#64748B' : (this.categoria?.color ?? null);
  protected readonly cuentas = [this.m.cuenta_id, this.m.cuenta_destino_id]
    .filter(Boolean)
    .map((id) => this.catalogo.cuenta(id)?.nombre ?? 'la cuenta')
    .join(' y ');

  protected async anular(): Promise<void> {
    this.anulando.set(true);
    this.error.set(null);
    try {
      await this.servicio.cambiarEstado(this.m.id, 'anulado');
      await this.catalogo.recargarCuentas();
      this.notificar.exito('Movimiento anulado.');
      this.ref.close(true);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.anulando.set(false);
    }
  }
}
