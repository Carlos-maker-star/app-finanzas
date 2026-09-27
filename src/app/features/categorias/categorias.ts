import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatProgressBar } from '@angular/material/progress-bar';
import { CatalogoService } from '../../core/api/catalogo.service';
import { CategoriasService } from '../../core/api/categorias.service';
import { mensajeDeError } from '../../core/errores';
import { Categoria, TipoCategoria } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { ChipIcono } from '../../shared/chip-icono';
import { ConfirmarDatos, ConfirmarDialog } from '../../shared/confirmar-dialog';
import { EstadoVacio } from '../../shared/estado-vacio';
import { CategoriaDialog, CategoriaDialogDatos } from './categoria-dialog';

@Component({
  selector: 'app-categorias',
  imports: [
    NgTemplateOutlet, MatButton, MatIconButton, MatButtonToggleGroup, MatButtonToggle, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatProgressBar,
    ChipIcono, EstadoVacio,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-col gap-1.5">
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">Categorías</h1>
          <p class="m-0 text-sm text-muted">Organizan en qué ganas y en qué gastas. Admiten un nivel de subcategorías.</p>
        </div>
        <button matButton="filled" type="button" (click)="abrir({ tipo: tipo() })"><mat-icon>add</mat-icon>Nueva categoría</button>
      </div>

      <mat-button-toggle-group [value]="tipo()" (change)="tipo.set($event.value)" aria-label="Tipo de categorías" class="self-start" hideSingleSelectionIndicator>
        <mat-button-toggle value="egreso"><span class="inline-flex items-center gap-1.5 px-2"><mat-icon class="icono-sm" aria-hidden="true">north_east</mat-icon>Egresos</span></mat-button-toggle>
        <mat-button-toggle value="ingreso"><span class="inline-flex items-center gap-1.5 px-2"><mat-icon class="icono-sm" aria-hidden="true">south_west</mat-icon>Ingresos</span></mat-button-toggle>
      </mat-button-toggle-group>

      <section class="overflow-hidden rounded-xl border border-line bg-surface">
        @if (!catalogo.cargado()) {
          <mat-progress-bar mode="indeterminate" />
        }
        @for (g of grupos(); track g.categoria.id) {
          <div class="border-b border-line last:border-b-0">
            <ng-container *ngTemplateOutlet="fila; context: { $implicit: g.categoria, sub: false }" />
            @for (s of g.subcategorias; track s.id) {
              <ng-container *ngTemplateOutlet="fila; context: { $implicit: s, sub: true }" />
            }
          </div>
        } @empty {
          @if (catalogo.cargado()) {
            <app-estado-vacio icono="sell" [titulo]="'No tienes categorías de ' + (tipo() === 'egreso' ? 'egresos' : 'ingresos')">
              <button matButton="outlined" type="button" (click)="abrir({ tipo: tipo() })"><mat-icon>add</mat-icon>Crear categoría</button>
            </app-estado-vacio>
          }
        }
      </section>
    </div>

    <ng-template #fila let-c let-sub="sub">
      <div class="flex min-h-14 items-center gap-3 py-2 pr-4" [class]="sub ? 'pl-16' : 'pl-6'" [class.opacity-60]="!c.activa">
        <app-chip-icono [icono]="c.icono" [color]="c.color" [tamanio]="sub ? 'sm' : 'md'" />
        <span class="flex-1 truncate text-sm" [class.font-semibold]="!sub">{{ c.nombre }}</span>
        @if (!c.activa) {
          <span class="rounded-full bg-neutro-bg px-2.5 py-0.5 text-xs font-semibold text-neutro-fg">Desactivada</span>
        }
        <button matIconButton type="button" [matMenuTriggerFor]="menu" [attr.aria-label]="'Acciones de ' + c.nombre"><mat-icon>more_vert</mat-icon></button>
        <mat-menu #menu="matMenu" xPosition="before">
          <button mat-menu-item type="button" (click)="abrir({ categoria: c })"><mat-icon>edit</mat-icon>Editar</button>
          @if (!sub && c.activa) {
            <button mat-menu-item type="button" (click)="abrir({ tipo: c.tipo, padreId: c.id })"><mat-icon>subdirectory_arrow_right</mat-icon>Agregar subcategoría</button>
          }
          @if (c.activa) {
            <button mat-menu-item type="button" (click)="activar(c, false)"><mat-icon>visibility_off</mat-icon>Desactivar</button>
          } @else {
            <button mat-menu-item type="button" (click)="activar(c, true)"><mat-icon>visibility</mat-icon>Reactivar</button>
          }
          <button mat-menu-item type="button" (click)="eliminar(c)" class="text-critico!"><mat-icon class="text-critico!">delete</mat-icon>Eliminar</button>
        </mat-menu>
      </div>
    </ng-template>
  `,
})
export class Categorias {
  protected readonly catalogo = inject(CatalogoService);
  private readonly servicio = inject(CategoriasService);
  private readonly dialog = inject(MatDialog);
  private readonly notificar = inject(NotificacionService);

  protected readonly tipo = signal<TipoCategoria>('egreso');
  protected readonly grupos = computed(() => this.catalogo.grupos(this.tipo()));

  protected abrir(datos: CategoriaDialogDatos): void {
    this.dialog.open(CategoriaDialog, { data: datos });
  }

  protected async activar(c: Categoria, activa: boolean): Promise<void> {
    try {
      await this.servicio.activar(c.id, activa);
      this.notificar.exito(activa ? `"${c.nombre}" vuelve a estar disponible.` : `"${c.nombre}" ya no aparecerá al registrar movimientos.`);
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    }
  }

  protected async eliminar(c: Categoria): Promise<void> {
    const datos: ConfirmarDatos = {
      titulo: `¿Eliminar "${c.nombre}"?`,
      mensaje: 'Solo es posible si no tiene movimientos ni subcategorías. Si ya la usaste, desactívala para conservar tu historial.',
      confirmar: 'Eliminar',
      peligro: true,
    };
    const ok = await firstValueFrom(this.dialog.open(ConfirmarDialog, { data: datos, width: '440px' }).afterClosed());
    if (!ok) {
      return;
    }
    try {
      await this.servicio.eliminar(c.id);
      this.notificar.exito('Categoría eliminada.');
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    }
  }
}
