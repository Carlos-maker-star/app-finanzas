import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Perfil } from '../core/models';
import { Shell } from './shell';

/** AuthService falso: solo los signals que usa el layout. */
function authFalso(perfil: Partial<Perfil>) {
  const p = signal<Perfil>({ id: 'u1', nombre: 'Carlos Rivadeneyra', email: 'c@test.com', rol: 'usuario', activo: true, creado_en: '', ...perfil });
  return {
    perfil: p,
    email: signal('c@test.com'),
    autenticado: signal(true),
    esAdmin: signal(p().rol === 'admin' && p().activo),
    desactivado: signal(!p().activo),
    logout: vi.fn(),
  };
}

async function montar(perfil: Partial<Perfil>) {
  TestBed.configureTestingModule({
    imports: [Shell],
    providers: [provideRouter([]), { provide: AuthService, useValue: authFalso(perfil) }],
  });
  const fixture = TestBed.createComponent(Shell);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** Texto de cada enlace del menú, sin el nombre del ícono (Material Symbols usa ligaduras). */
const enlaces = (el: HTMLElement) =>
  [...el.querySelectorAll('aside nav a')].map((a) =>
    [...a.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim(),
  );

describe('Shell', () => {
  it('un usuario ve sus secciones pero no la administración', async () => {
    const el = await montar({ rol: 'usuario' });
    expect(enlaces(el)).toEqual(['Dashboard', 'Movimientos', 'Cuentas', 'Categorías', 'Perfil']);
    expect(el.textContent).not.toContain('Administración');
  });

  it('un admin ve además la sección de usuarios', async () => {
    const el = await montar({ rol: 'admin' });
    expect(enlaces(el)).toContain('Usuarios');
    expect(el.textContent).toContain('Administrador');
  });

  it('un usuario desactivado ve el aviso en lugar del contenido', async () => {
    const el = await montar({ activo: false });
    expect(el.textContent).toContain('Tu cuenta está desactivada');
    expect(el.querySelector('router-outlet')).toBeNull();
  });
});
