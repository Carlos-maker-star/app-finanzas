import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { CatalogoService } from '../../core/api/catalogo.service';
import { CuentasService } from '../../core/api/cuentas.service';
import { TIPOS_CUENTA } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { Cuenta } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { ChipIcono } from '../../shared/chip-icono';
import { SolesPipe } from '../../shared/soles.pipe';
import { CuentaDialog } from './cuenta-dialog';

@Component({
  selector: 'app-cuentas-list',
  imports: [MatButton, MatIcon, MatProgressBar, RouterLink, ChipIcono, SolesPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">Cuentas</h1>
          <p class="m-0 text-sm text-muted">Dónde está tu dinero y cuánto tienes en cada lugar.</p>
        </div>
        <button matButton="filled" type="button" (click)="nueva()"><mat-icon>add</mat-icon>Nueva cuenta</button>
      </div>

      @if (!catalogo.cargado()) {
        <mat-progress-bar mode="indeterminate" />
      } @else {
        <!-- Resumen -->
        <section class="flex flex-wrap items-center gap-y-4 rounded-xl border border-line bg-surface p-5">
          <div class="flex min-w-56 flex-col gap-0.5 pr-6">
            <span class="text-xs font-medium text-subtle">Patrimonio neto</span>
            <span class="text-[28px] font-semibold tracking-tight tabular-nums" [class.text-egreso]="catalogo.saldoTotal() < 0">
              {{ catalogo.saldoTotal() | soles }}
            </span>
          </div>
          <div class="flex flex-1 flex-col gap-0.5 border-l border-line px-6">
            <span class="text-xs font-medium text-subtle">Disponible</span>
            <span class="font-mono text-lg font-semibold">{{ disponible() | soles }}</span>
            <span class="text-xs text-subtle">Todo menos las tarjetas de crédito</span>
          </div>
          <div class="flex flex-1 flex-col gap-0.5 border-l border-line px-6">
            <span class="text-xs font-medium text-subtle">Deudas de tarjeta</span>
            <span class="font-mono text-lg font-semibold" [class.text-egreso]="deudas() < 0">{{ deudas() | soles }}</span>
            <span class="text-xs text-subtle">{{ tarjetas() }} {{ tarjetas() === 1 ? 'tarjeta' : 'tarjetas' }} de crédito</span>
          </div>
          <div class="flex flex-1 flex-col gap-0.5 border-l border-line px-6">
            <span class="text-xs font-medium text-subtle">Cuentas</span>
            <span class="font-mono text-lg font-semibold">{{ catalogo.cuentasActivas().length }} activas</span>
            <span class="text-xs text-subtle">{{ catalogo.cuentasArchivadas().length }} archivadas</span>
          </div>
        </section>

        <!-- Tarjetas -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          @for (c of catalogo.cuentasActivas(); track c.id) {
            <a
              [routerLink]="['/cuentas', c.id]"
              class="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 text-ink no-underline transition-colors hover:border-primary/40 hover:bg-surface-2"
            >
              <div class="flex items-center gap-3">
                <app-chip-icono [icono]="c.icono" [color]="c.color" tamanio="lg" />
                <div class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-base font-semibold">{{ c.nombre }}</span>
                  <span class="text-xs text-subtle">{{ tipos[c.tipo].etiqueta }}</span>
                </div>
                <mat-icon class="text-subtle" aria-hidden="true">chevron_right</mat-icon>
              </div>
              <div class="flex flex-col gap-0.5">
                <span class="text-xs font-medium text-subtle">{{ c.tipo === 'tarjeta_credito' ? 'Deuda actual' : 'Saldo' }}</span>
                <span class="text-[26px] font-semibold tracking-tight tabular-nums" [class.text-egreso]="c.saldo_actual < 0">{{ c.saldo_actual | soles }}</span>
              </div>
              <div class="flex justify-between border-t border-line pt-3.5 text-xs text-subtle">
                <span>{{ c.cantidad_movimientos }} {{ c.cantidad_movimientos === 1 ? 'movimiento' : 'movimientos' }}</span>
                <span>Saldo inicial {{ c.saldo_inicial | soles }}</span>
              </div>
            </a>
          }
          <button
            type="button"
            (click)="nueva()"
            class="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-line bg-transparent p-5 font-sans text-muted hover:border-primary/50 hover:bg-surface"
          >
            <span class="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary"><mat-icon aria-hidden="true">add</mat-icon></span>
            <strong class="text-[15px] text-ink">Agregar cuenta</strong>
            <span class="max-w-60 text-center text-[13px]">Efectivo, banco, tarjeta de crédito, ahorro o billetera digital</span>
          </button>
        </div>

        <!-- Archivadas -->
        @if (catalogo.cuentasArchivadas().length) {
          <section class="overflow-hidden rounded-xl border border-line bg-surface">
            <div class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-3">
              <h2 class="m-0 flex items-center gap-2 text-base font-semibold">
                Archivadas
                <span class="rounded-full bg-neutro-bg px-2 py-0.5 text-xs font-semibold text-neutro-fg">{{ catalogo.cuentasArchivadas().length }}</span>
              </h2>
              <span class="text-[13px] text-subtle">No aparecen al registrar movimientos, pero conservan su historial</span>
            </div>
            @for (c of catalogo.cuentasArchivadas(); track c.id) {
              <div class="flex min-h-16 flex-wrap items-center gap-3 border-b border-line px-6 py-2 last:border-b-0">
                <app-chip-icono [icono]="c.icono" color="#64748B" />
                <a [routerLink]="['/cuentas', c.id]" class="flex min-w-0 flex-1 flex-col text-ink no-underline hover:underline">
                  <span class="truncate font-medium text-muted">{{ c.nombre }}</span>
                  <span class="text-xs text-subtle">{{ tipos[c.tipo].etiqueta }} · {{ c.cantidad_movimientos }} movimientos</span>
                </a>
                <span class="mr-3 font-mono font-semibold text-subtle">{{ c.saldo_actual | soles }}</span>
                <button matButton type="button" (click)="restaurar(c)"><mat-icon>unarchive</mat-icon>Restaurar</button>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
})
export class CuentasList {
  protected readonly catalogo = inject(CatalogoService);
  private readonly servicio = inject(CuentasService);
  private readonly dialog = inject(MatDialog);
  private readonly notificar = inject(NotificacionService);
  protected readonly tipos = TIPOS_CUENTA;

  protected readonly disponible = computed(() =>
    this.catalogo.cuentas().filter((c) => c.tipo !== 'tarjeta_credito').reduce((s, c) => s + c.saldo_actual, 0),
  );
  protected readonly deudas = computed(() =>
    this.catalogo.cuentas().filter((c) => c.tipo === 'tarjeta_credito').reduce((s, c) => s + c.saldo_actual, 0),
  );
  protected readonly tarjetas = computed(() => this.catalogo.cuentasActivas().filter((c) => c.tipo === 'tarjeta_credito').length);

  protected nueva(): void {
    this.dialog.open(CuentaDialog, { data: {} });
  }

  protected async restaurar(cuenta: Cuenta): Promise<void> {
    try {
      await this.servicio.archivar(cuenta.id, false);
      this.notificar.exito(`"${cuenta.nombre}" vuelve a estar activa.`);
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    }
  }
}
