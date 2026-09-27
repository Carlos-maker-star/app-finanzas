import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/errores';
import { AuthLayout } from './auth-layout';
import { VerClave } from '../../shared/ver-clave';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, MatFormField, MatLabel, MatError, MatHint, MatInput, MatButton, MatIcon, MatProgressBar, AuthLayout, MatIconButton, MatSuffix, VerClave],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @if (correoEnviado()) {
        <div class="flex flex-col items-start gap-4" role="status">
          <span class="flex size-12 items-center justify-center rounded-full bg-exito-bg text-exito-fg">
            <mat-icon aria-hidden="true">mark_email_read</mat-icon>
          </span>
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">Revisa tu correo</h1>
          <p class="m-0 text-[15px] leading-relaxed text-muted">
            Te enviamos un enlace a <strong class="text-ink">{{ correoEnviado() }}</strong> para confirmar tu cuenta.
            Ábrelo y luego inicia sesión. Si no lo ves, revisa la carpeta de spam.
          </p>
          <a matButton="outlined" routerLink="/login">Ir a iniciar sesión</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="registrar()" class="flex flex-col gap-6" novalidate>
          <div class="flex flex-col gap-2">
            <h1 class="m-0 text-[28px] font-semibold tracking-tight">Crea tu cuenta</h1>
            <p class="m-0 text-[15px] text-muted">Gratis. Te dejamos categorías listas para empezar.</p>
          </div>

          @if (error()) {
            <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
          }

          <div class="flex flex-col gap-4">
            <mat-form-field>
              <mat-label>Tu nombre</mat-label>
              <input matInput formControlName="nombre" autocomplete="name" maxlength="80" />
              @if (form.controls.nombre.hasError('required')) {
                <mat-error>Escribe tu nombre</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>Correo electrónico</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="email" placeholder="tu@correo.com" />
              @if (form.controls.email.hasError('required')) {
                <mat-error>Escribe tu correo</mat-error>
              } @else if (form.controls.email.hasError('email')) {
                <mat-error>Ese correo no es válido</mat-error>
              }
            </mat-form-field>
            <mat-form-field>
              <mat-label>Contraseña</mat-label>
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
              @if (form.controls.password.hasError('required')) {
                <mat-error>Crea una contraseña</mat-error>
              } @else if (form.controls.password.hasError('minlength')) {
                <mat-error>Usa al menos 8 caracteres</mat-error>
              }
            </mat-form-field>
          </div>

          <div class="flex flex-col gap-2">
            <button matButton="filled" type="submit" class="h-11!" [disabled]="cargando()">Crear cuenta</button>
            @if (cargando()) {
              <mat-progress-bar mode="indeterminate" />
            }
          </div>

          <p class="m-0 text-center text-sm text-muted">
            ¿Ya tienes cuenta?
            <a routerLink="/login" class="font-semibold text-primary no-underline hover:underline">Inicia sesión</a>
          </p>
        </form>
      }
    </app-auth-layout>
  `,
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Correo al que se envió la confirmación (si Supabase la exige). */
  protected readonly correoEnviado = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected async registrar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { nombre, email, password } = this.form.getRawValue();
    this.cargando.set(true);
    this.error.set(null);
    try {
      const resultado = await this.auth.registrar(nombre, email, password);
      if (resultado === 'sesion') {
        await this.router.navigate(['/dashboard']);
      } else {
        this.correoEnviado.set(email.trim());
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
