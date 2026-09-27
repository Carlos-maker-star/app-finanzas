import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ROLES } from '../core/etiquetas';
import { MARCA } from '../core/marca';
import { TemaService } from '../core/tema.service';
import { Avatar } from '../shared/avatar';
import { NAVEGACION, RUTA_BUSQUEDA } from './navegacion';

/** Layout de las páginas privadas: menú lateral + barra superior + contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIcon, MatIconButton, MatButton, MatTooltip, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly tema = inject(TemaService);
  private readonly router = inject(Router);

  protected readonly marca = MARCA;
  protected readonly roles = ROLES;
  protected readonly menuAbierto = signal(false);

  /** Secciones visibles: Administración solo para admins. */
  protected readonly navegacion = computed(() => NAVEGACION.filter((s) => !s.soloAdmin || this.auth.esAdmin()));

  protected readonly nombre = computed(() => this.auth.perfil()?.nombre ?? this.auth.email());

  /** Título de la barra superior: `data: { titulo }` de la ruta activa. */
  protected readonly titulo = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      startWith(null),
      map(() => tituloDeRuta(this.router.routerState.snapshot.root)),
    ),
    { initialValue: '' },
  );

  protected buscar(texto: string): void {
    this.menuAbierto.set(false);
    this.router.navigate([RUTA_BUSQUEDA], { queryParams: { q: texto.trim() || null } });
  }
}

function tituloDeRuta(ruta: ActivatedRouteSnapshot): string {
  let actual = ruta;
  while (actual.firstChild) {
    actual = actual.firstChild;
  }
  return (actual.data['titulo'] as string | undefined) ?? '';
}
