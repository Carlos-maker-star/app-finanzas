import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { AuthService } from '../../core/auth/auth.service';
import { ROLES } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { NotificacionService } from '../../core/notificacion.service';
import { TemaService } from '../../core/tema.service';
import { Avatar } from '../../shared/avatar';
import { clavesIguales } from '../auth/restablecer';
import { VerClave } from '../../shared/ver-clave';

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, MatButton, MatFormField, MatLabel, MatError, MatHint, MatInput, MatIcon, MatSlideToggle, Avatar, MatIconButton, MatSuffix, VerClave],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <div class="flex flex-col gap-1.5">
        <h1 class="m-0 text-[28px] font-semibold tracking-tight">Perfil</h1>
        <p class="m-0 text-sm text-muted">Tus datos de acceso y preferencias.</p>
      </div>

      <section class="overflow-hidden rounded-xl border border-line bg-surface">
        <div class="flex items-center gap-4 border-b border-line px-6 py-5">
          <app-avatar [nombre]="auth.perfil()?.nombre ?? auth.email()" tamanio="md" />
          <div class="flex min-w-0 flex-col">
            <span class="truncate font-semibold">{{ auth.perfil()?.nombre }}</span>
            <span class="truncate text-sm text-subtle">{{ auth.email() }} · {{ roles[auth.perfil()?.rol ?? 'usuario'] }}</span>
          </div>
        </div>
        <form [formGroup]="datos" (ngSubmit)="guardarNombre()" class="flex flex-col gap-4 px-6 py-5" novalidate>
          <h2 class="m-0 text-base font-semibold">Tus datos</h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <mat-form-field>
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="nombre" maxlength="80" autocomplete="name" />
              @if (datos.controls.nombre.hasError('required')) {
                <mat-error>Escribe tu nombre</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>Correo electrónico</mat-label>
              <input matInput [value]="auth.email()" disabled />
              <mat-hint>Es tu usuario para iniciar sesión.</mat-hint>
            </mat-form-field>
          </div>
          <button matButton="filled" type="submit" class="self-end" [disabled]="guardandoNombre() || datos.pristine">Guardar cambios</button>
        </form>
      </section>

      <section class="rounded-xl border border-line bg-surface">
        <form [formGroup]="clave" (ngSubmit)="cambiarClave()" class="flex flex-col gap-4 px-6 py-5" novalidate>
          <div class="flex flex-col gap-1">
            <h2 class="m-0 text-base font-semibold">Cambiar contraseña</h2>
            <p class="m-0 text-sm text-muted">Usa al menos 8 caracteres.</p>
          </div>
          @if (errorClave()) {
            <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ errorClave() }}</p>
          }
          <div class="grid gap-4 sm:grid-cols-2">
            <mat-form-field>
              <mat-label>Nueva contraseña</mat-label>
              <input matInput appVerClave #verPassword="verClave" formControlName="password" autocomplete="new-password" />
              <button
                matIconButton
                matSuffix
                type="button"
                (click)="verPassword.alternar()"
                [attr.aria-label]="verPassword.visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="verPassword.visible()"
              >
                <mat-icon>{{ verPassword.visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (clave.controls.password.hasError('minlength')) {
                <mat-error>Usa al menos 8 caracteres</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>Repite la contraseña</mat-label>
              <input matInput appVerClave #verRepetir="verClave" formControlName="repetir" autocomplete="new-password" />
              <button
                matIconButton
                matSuffix
                type="button"
                (click)="verRepetir.alternar()"
                [attr.aria-label]="verRepetir.visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                [attr.aria-pressed]="verRepetir.visible()"
              >
                <mat-icon>{{ verRepetir.visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
          </div>
          @if (clave.hasError('distintas') && clave.controls.repetir.touched) {
            <p class="m-0 text-sm text-critico" role="alert">Las contraseñas no coinciden.</p>
          }
          <button matButton="outlined" type="submit" class="self-end" [disabled]="guardandoClave()">
            <mat-icon>lock_reset</mat-icon>Cambiar contraseña
          </button>
        </form>
      </section>

      <section class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-6 py-5">
        <div class="flex flex-col gap-1">
          <h2 class="m-0 text-base font-semibold">Apariencia</h2>
          <p class="m-0 text-sm text-muted">El modo oscuro se recuerda en este navegador.</p>
        </div>
        <mat-slide-toggle [checked]="tema.oscuro()" (change)="tema.oscuro.set($event.checked)">Modo oscuro</mat-slide-toggle>
      </section>
    </div>
  `,
})
export class PerfilPage {
  protected readonly auth = inject(AuthService);
  protected readonly tema = inject(TemaService);
  private readonly notificar = inject(NotificacionService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly roles = ROLES;

  protected readonly guardandoNombre = signal(false);
  protected readonly guardandoClave = signal(false);
  protected readonly errorClave = signal<string | null>(null);

  protected readonly datos = this.fb.group({ nombre: ['', [Validators.required, Validators.maxLength(80)]] });
  protected readonly clave = this.fb.group(
    { password: ['', [Validators.required, Validators.minLength(8)]], repetir: ['', Validators.required] },
    { validators: clavesIguales },
  );

  constructor() {
    // El perfil puede llegar después de crear el componente
    effect(() => {
      const nombre = this.auth.perfil()?.nombre;
      if (nombre && this.datos.pristine) {
        this.datos.reset({ nombre });
      }
    });
  }

  protected async guardarNombre(): Promise<void> {
    if (this.datos.invalid) {
      this.datos.markAllAsTouched();
      return;
    }
    this.guardandoNombre.set(true);
    try {
      await this.auth.actualizarNombre(this.datos.controls.nombre.value);
      this.datos.markAsPristine();
      this.notificar.exito('Nombre actualizado.');
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    } finally {
      this.guardandoNombre.set(false);
    }
  }

  protected async cambiarClave(): Promise<void> {
    if (this.clave.invalid) {
      this.clave.markAllAsTouched();
      return;
    }
    this.guardandoClave.set(true);
    this.errorClave.set(null);
    try {
      await this.auth.cambiarClave(this.clave.controls.password.value);
      this.clave.reset();
      this.notificar.exito('Contraseña actualizada.');
    } catch (e) {
      this.errorClave.set(mensajeDeError(e));
    } finally {
      this.guardandoClave.set(false);
    }
  }
}
