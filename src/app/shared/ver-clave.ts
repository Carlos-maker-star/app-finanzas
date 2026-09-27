import { Directive, signal } from '@angular/core';

/**
 * Permite mostrar u ocultar una contraseña. Se usa con un botón de ojo en el mismo campo:
 *
 * ```html
 * <input matInput appVerClave #clave="verClave" formControlName="password" />
 * <button matIconButton matSuffix type="button" (click)="clave.alternar()"
 *         [attr.aria-label]="clave.visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
 *         [attr.aria-pressed]="clave.visible()">
 *   <mat-icon>{{ clave.visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
 * </button>
 * ```
 */
@Directive({
  selector: 'input[appVerClave]',
  exportAs: 'verClave',
  host: { '[type]': "visible() ? 'text' : 'password'" },
})
export class VerClave {
  readonly visible = signal(false);

  alternar(): void {
    this.visible.update((v) => !v);
  }
}
