import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AdminService } from '../../core/api/admin.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROLES } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { ResumenUsuarios, UsuarioAdmin } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { Avatar } from '../../shared/avatar';
import { ConfirmarDatos, ConfirmarDialog } from '../../shared/confirmar-dialog';
import { EstadoVacio } from '../../shared/estado-vacio';
import { TiempoRelativoPipe } from '../../shared/tiempo-relativo.pipe';

/** Gestión de usuarios. El admin no ve las finanzas de nadie: solo datos de la cuenta. */
@Component({
  selector: 'app-usuarios',
  imports: [DatePipe, MatIcon, MatProgressBar, MatSlideToggle, Avatar, EstadoVacio, TiempoRelativoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-1.5">
        <h1 class="m-0 text-[28px] font-semibold tracking-tight">Usuarios</h1>
        <p class="m-0 text-sm text-muted">Quién usa MisFinanzas. Por privacidad, aquí no se ven cuentas ni montos de nadie.</p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (k of kpis(); track k.titulo) {
          <div class="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5">
            <div class="flex items-center justify-between">
              <span class="text-[13px] font-medium text-muted">{{ k.titulo }}</span>
              <span class="flex size-8 items-center justify-center rounded-lg" [class]="k.tono"><mat-icon class="icono-sm" aria-hidden="true">{{ k.icono }}</mat-icon></span>
            </div>
            <span class="text-[28px] font-semibold tracking-tight tabular-nums">{{ k.valor }}</span>
            <span class="text-[13px] text-subtle">{{ k.detalle }}</span>
          </div>
        } @empty {
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-[126px] animate-pulse rounded-xl border border-line bg-surface"></div>
          }
        }
      </div>

      <section class="overflow-hidden rounded-xl border border-line bg-surface">
        <div class="h-1">
          @if (cargando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </div>
        @if (error()) {
          <app-estado-vacio icono="cloud_off" titulo="No pudimos cargar los usuarios" [texto]="error()!" />
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr class="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                  <th scope="col" class="h-11 px-6 font-semibold">Usuario</th>
                  <th scope="col" class="w-36 px-4 font-semibold">Rol</th>
                  <th scope="col" class="w-36 px-4 font-semibold">Registro</th>
                  <th scope="col" class="w-40 px-4 font-semibold">Último acceso</th>
                  <th scope="col" class="w-36 px-4 font-semibold">Activo</th>
                </tr>
              </thead>
              <tbody>
                @for (u of usuarios(); track u.id) {
                  <tr class="h-16 border-b border-line last:border-b-0" [class.opacity-60]="!u.activo">
                    <td class="px-6">
                      <div class="flex items-center gap-3">
                        <app-avatar [nombre]="u.nombre" tamanio="md" />
                        <div class="flex min-w-0 flex-col">
                          <span class="truncate text-sm font-medium">{{ u.nombre }}{{ u.id === miId() ? ' (tú)' : '' }}</span>
                          <span class="truncate text-xs text-subtle">{{ u.email }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4">
                      <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="u.rol === 'admin' ? 'bg-primary-soft text-nav-active-ink' : 'bg-neutro-bg text-neutro-fg'">
                        {{ roles[u.rol] }}
                      </span>
                    </td>
                    <td class="px-4 text-sm text-muted">{{ u.creado_en | date: 'd MMM y' }}</td>
                    <td class="px-4 text-sm text-muted">{{ u.ultimo_acceso ? (u.ultimo_acceso | tiempoRelativo) : 'Nunca' }}</td>
                    <td class="px-4">
                      <mat-slide-toggle
                        [checked]="u.activo"
                        [disabled]="u.id === miId()"
                        (change)="cambiarEstado(u, $event)"
                        [attr.aria-label]="(u.activo ? 'Desactivar a ' : 'Activar a ') + u.nombre"
                      >
                        <span class="text-sm">{{ u.activo ? 'Sí' : 'No' }}</span>
                      </mat-slide-toggle>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class Usuarios implements OnInit {
  private readonly servicio = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly notificar = inject(NotificacionService);
  protected readonly roles = ROLES;
  protected readonly miId = this.auth.usuarioId;

  protected readonly usuarios = signal<UsuarioAdmin[]>([]);
  protected readonly resumen = signal<ResumenUsuarios | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly kpis = computed(() => {
    const r = this.resumen();
    return r
      ? [
          { titulo: 'Usuarios', valor: r.total, detalle: 'Registrados en total', icono: 'group', tono: 'bg-primary-soft text-primary' },
          { titulo: 'Activos', valor: r.activos, detalle: `${r.inactivos} desactivados`, icono: 'verified_user', tono: 'bg-exito-bg text-exito-fg' },
          { titulo: 'Nuevos del mes', valor: r.nuevos_mes, detalle: 'Se registraron este mes', icono: 'person_add', tono: 'bg-nuevo-bg text-nuevo-fg' },
          { titulo: 'Con actividad', valor: r.con_actividad_30_dias, detalle: 'Registraron movimientos en 30 días', icono: 'bolt', tono: 'bg-curso-bg text-curso-fg' },
        ]
      : [];
  });

  ngOnInit(): void {
    this.cargar();
  }

  private async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const [resumen, usuarios] = await Promise.all([this.servicio.resumen(), this.servicio.usuarios()]);
      this.resumen.set(resumen);
      this.usuarios.set(usuarios);
      this.error.set(null);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected async cambiarEstado(u: UsuarioAdmin, evento: MatSlideToggleChange): Promise<void> {
    const activo = evento.checked;
    if (!activo) {
      const datos: ConfirmarDatos = {
        titulo: `¿Desactivar a ${u.nombre}?`,
        mensaje: 'No podrá ver ni registrar sus finanzas hasta que lo reactives. Sus datos no se borran.',
        confirmar: 'Desactivar',
        peligro: true,
      };
      const ok = await firstValueFrom(this.dialog.open(ConfirmarDialog, { data: datos, width: '440px' }).afterClosed());
      if (!ok) {
        evento.source.checked = true;
        return;
      }
    }
    try {
      await this.servicio.cambiarEstado(u.id, activo);
      this.notificar.exito(activo ? `${u.nombre} vuelve a tener acceso.` : `${u.nombre} fue desactivado.`);
      await this.cargar();
    } catch (e) {
      evento.source.checked = !activo;
      this.notificar.error(mensajeDeError(e));
    }
  }
}
