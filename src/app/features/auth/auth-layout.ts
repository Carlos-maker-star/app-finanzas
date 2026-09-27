import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MARCA } from '../../core/marca';
import { TemaService } from '../../core/tema.service';

/** Marco de login y registro: panel de marca a la izquierda (≥ lg) y el formulario a la derecha. */
@Component({
  selector: 'app-auth-layout',
  imports: [MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh bg-app text-ink">
      <section class="hidden w-[600px] shrink-0 flex-col justify-between bg-brand-panel px-16 py-14 text-white lg:flex">
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-[10px] bg-white text-brand-panel">
            <mat-icon aria-hidden="true">{{ marca.icono }}</mat-icon>
          </span>
          <span class="text-lg font-bold">{{ marca.nombre }}</span>
        </div>
        <div class="flex flex-col gap-10">
          <h2 class="m-0 max-w-md text-[44px] font-semibold leading-[1.12] tracking-tight">{{ marca.frase }}</h2>
          <ol class="m-0 flex list-none flex-col gap-6 p-0">
            @for (paso of marca.pasos; track paso.titulo) {
              <li class="flex items-start gap-4">
                <span class="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/12">
                  <mat-icon aria-hidden="true">{{ paso.icono }}</mat-icon>
                </span>
                <span class="flex flex-col gap-0.5">
                  <strong class="text-base font-semibold">{{ $index + 1 }}. {{ paso.titulo }}</strong>
                  <span class="text-white/80">{{ paso.texto }}</span>
                </span>
              </li>
            }
          </ol>
        </div>
        <span class="flex items-center gap-2 text-[13px] text-white/80">
          <mat-icon class="icono-xs" aria-hidden="true">lock</mat-icon>{{ marca.privacidad }}
        </span>
      </section>

      <section class="relative flex flex-1 items-center justify-center px-4 py-12">
        <button
          matIconButton
          type="button"
          class="absolute! top-6 right-6"
          (click)="tema.alternar()"
          [attr.aria-label]="tema.oscuro() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        >
          <mat-icon>{{ tema.oscuro() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
        <div class="w-full max-w-[400px]">
          <ng-content />
        </div>
      </section>
    </div>
  `,
})
export class AuthLayout {
  protected readonly tema = inject(TemaService);
  protected readonly marca = MARCA;
}
