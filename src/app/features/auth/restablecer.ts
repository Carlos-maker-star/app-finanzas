import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/errores';
import { NotificacionService } from '../../core/notificacion.service';
import { AuthLayout } from './auth-layout';
import { VerClave } from '../../shared/ver-clave';

export function clavesIguales(grupo: AbstractControl): ValidationErrors | null {
  const { password, repetir } = grupo.value as { password: string; repetir: string };
  return password && repetir && password !== repetir ? { distintas: true } : null;
}

/** Destino del enlace "olvidé mi contraseña": Supabase abre una sesión temporal para cambiarla. */
@Component({
  selector: 'app-restablecer',
  imports: [ReactiveFormsModule, RouterLink, MatFormField, MatLabel, MatError, MatHint, MatInput, MatButton, MatProgressBar, AuthLayout, MatIconButton, MatSuffix, MatIcon, VerClave],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @if (verificando()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (!auth.autenticado()) {
        <div class="flex flex-col items-start gap-4" role="alert">
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">El enlace ya no es válido</h1>
          <p class="m-0 text-[15px] text-muted">Puede que haya vencido o que ya lo hayas usado. Pide uno nuevo.</p>
          <a matButton="filled" routerLink="/recuperar">Pedir otro enlace</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="guardar()" class="flex flex-col gap-6" novalidate>
          <div class="flex flex-col gap-2">
            <h1 class="m-0 text-[28px] font-semibold tracking-tight">Crea una nueva contraseña</h1>
            <p class="m-0 text-[15px] text-muted">Para {{ auth.email() }}</p>
          </div>
          @if (error()) {
            <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
          }
          <div class="flex flex-col gap-4">
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
              <mat-hint>Mínimo 8 caracteres</mat-hint>
              @if (form.controls.password.hasError('minlength')) {
                <mat-error>Usa al menos 8 caracteres</mat-error>
              } @else if (form.controls.password.hasError('required')) {
                <mat-error>Escribe la nueva contraseña</mat-error>
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
            @if (form.hasError('distintas') && form.controls.repetir.touched) {
              <p class="m-0 text-sm text-critico" role="alert">Las contraseñas no coinciden.</p>
            }
          </div>
          <div class="flex flex-col gap-2">
            <button matButton="filled" type="submit" class="h-11!" [disabled]="cargando()">Guardar contraseña</button>
            @if (cargando()) {
              <mat-progress-bar mode="indeterminate" />
            }
          </div>
        </form>
      }
    </app-auth-layout>
  `,
})
export class Restablecer implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificar = inject(NotificacionService);

  protected readonly verificando = signal(true);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      repetir: ['', Validators.required],
    },
    { validators: clavesIguales },
  );

  async ngOnInit(): Promise<void> {
    // supabase-js lee el token del enlace al arrancar; se espera a que termine
    await this.auth.listo;
    this.verificando.set(false);
  }

  protected async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.cambiarClave(this.form.controls.password.value);
      this.notificar.exito('Contraseña actualizada.');
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
