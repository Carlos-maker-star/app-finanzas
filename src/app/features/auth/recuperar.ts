import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensajeDeError } from '../../core/errores';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-recuperar',
  imports: [ReactiveFormsModule, RouterLink, MatFormField, MatLabel, MatError, MatInput, MatButton, MatIcon, MatProgressBar, AuthLayout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-layout>
      @if (enviado()) {
        <div class="flex flex-col items-start gap-4" role="status">
          <span class="flex size-12 items-center justify-center rounded-full bg-exito-bg text-exito-fg">
            <mat-icon aria-hidden="true">mark_email_read</mat-icon>
          </span>
          <h1 class="m-0 text-[28px] font-semibold tracking-tight">Revisa tu correo</h1>
          <p class="m-0 text-[15px] leading-relaxed text-muted">
            Si <strong class="text-ink">{{ form.controls.email.value }}</strong> tiene una cuenta, te llegará un enlace
            para crear una nueva contraseña. Revisa también la carpeta de spam.
          </p>
          <a matButton="outlined" routerLink="/login">Volver a iniciar sesión</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="enviar()" class="flex flex-col gap-6" novalidate>
          <div class="flex flex-col gap-2">
            <h1 class="m-0 text-[28px] font-semibold tracking-tight">Recupera tu contraseña</h1>
            <p class="m-0 text-[15px] text-muted">Te enviaremos un enlace para crear una nueva.</p>
          </div>
          @if (error()) {
            <p class="m-0 rounded-lg bg-peligro-bg px-3 py-2 text-sm text-peligro-fg" role="alert">{{ error() }}</p>
          }
          <mat-form-field>
            <mat-label>Correo electrónico</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" placeholder="tu@correo.com" />
            @if (form.controls.email.hasError('required')) {
              <mat-error>Escribe tu correo</mat-error>
            } @else if (form.controls.email.hasError('email')) {
              <mat-error>Ese correo no es válido</mat-error>
            }
          </mat-form-field>
          <div class="flex flex-col gap-2">
            <button matButton="filled" type="submit" class="h-11!" [disabled]="cargando()">Enviar enlace</button>
            @if (cargando()) {
              <mat-progress-bar mode="indeterminate" />
            }
          </div>
          <a routerLink="/login" class="text-center text-sm font-semibold text-primary no-underline hover:underline">Volver a iniciar sesión</a>
        </form>
      }
    </app-auth-layout>
  `,
})
export class Recuperar {
  private readonly auth = inject(AuthService);

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enviado = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async enviar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    try {
      await this.auth.enviarRecuperacion(this.form.controls.email.value);
      this.enviado.set(true);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }
}
