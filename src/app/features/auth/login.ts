import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/errores';
import { AuthLayout } from './auth-layout';
import { VerClave } from '../../shared/ver-clave';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatFormField, MatLabel, MatError, MatInput, MatButton, MatProgressBar, AuthLayout, MatIconButton, MatSuffix, MatIcon, VerClave],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      <form [formGroup]="form" (ngSubmit)="ingresar()" class="flex flex-col gap-6" novalidate>
        <div class="flex flex-col gap-2">
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">Inicia sesión</h1>
          <p class="m-0 text-[15px] text-muted">Ingresa para ver tus finanzas.</p>
        </div>

        @if (sesion() === 'expirada') {
          <p class="m-0 rounded-lg bg-curso-bg px-3 py-2 text-sm text-curso-fg" role="status">
            Tu sesión terminó. Vuelve a iniciar sesión.
          </p>
        }
        @if (confirmado()) {
          <p class="m-0 rounded-lg bg-exito-bg px-3 py-2 text-sm text-exito-fg" role="status">
            ¡Correo confirmado! Ya puedes iniciar sesión.
          </p>
        }
        @if (error()) {
          <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
        }

        <div class="flex flex-col gap-4">
          <mat-form-field>
            <mat-label>Correo electrónico</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" placeholder="tu@correo.com" />
            @if (form.controls.email.hasError('required')) {
              <mat-error>Escribe tu correo</mat-error>
            } @else if (form.controls.email.hasError('email')) {
              <mat-error>Ese correo no es válido</mat-error>
            }
          </mat-form-field>
          <div class="flex flex-col gap-1">
            <mat-form-field>
              <mat-label>Contraseña</mat-label>
              <input matInput appVerClave #verPassword="verClave" formControlName="password" autocomplete="current-password" />
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
              @if (form.controls.password.hasError('required')) {
                <mat-error>Escribe tu contraseña</mat-error>
              }
            </mat-form-field>
            <a routerLink="/recuperar" class="self-end text-[13px] font-medium text-primary no-underline hover:underline">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <button matButton="filled" type="submit" class="h-11!" [disabled]="cargando()">Ingresar</button>
          @if (cargando()) {
            <mat-progress-bar mode="indeterminate" />
          }
        </div>

        <p class="m-0 text-center text-sm text-muted">
          ¿No tienes cuenta?
          <a routerLink="/registro" class="font-semibold text-primary no-underline hover:underline">Regístrate gratis</a>
        </p>
      </form>
    </app-auth-layout>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `?sesion=expirada` cuando la sesión caducó. */
  readonly sesion = input<string>();
  /** `?confirmado=1` al volver del correo de confirmación. */
  readonly confirmado = input<string>();

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async ingresar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.login(email, password);
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      this.error.set(mensajeDeError(e));
      this.cargando.set(false);
    }
  }
}
