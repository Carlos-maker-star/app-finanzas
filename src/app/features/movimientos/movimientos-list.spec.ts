import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogoService } from '../../core/api/catalogo.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { hoyISO } from '../../core/formato';
import { Cuenta, Movimiento } from '../../core/models';
import { AccionesMovimiento } from './acciones-movimiento';
import { MovimientosList } from './movimientos-list';

const cuenta: Cuenta = {
  id: 'bcp', nombre: 'BCP Sueldo', tipo: 'banco', color: '#1D4ED8', icono: 'account_balance', archivada: false,
  saldo_inicial: 0, saldo_actual: 100, cantidad_movimientos: 3,
};

function mov(id: string, estado: Movimiento['estado'], descripcion: string): Movimiento {
  return {
    id, tipo: 'egreso', estado, monto: 10, fecha: hoyISO(), cuenta_id: 'bcp', cuenta_destino_id: null, categoria_id: 'cat',
    descripcion, nota: null, anulado_en: null, creado_en: '',
  };
}

describe('MovimientosList', () => {
  let listar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listar = vi.fn().mockResolvedValue({
      contenido: [mov('1', 'programado', 'Alquiler'), mov('2', 'confirmado', 'Netflix'), mov('3', 'anulado', 'Uber duplicado')],
      total: 3,
    });
    const cuentas = signal([cuenta]);
    TestBed.configureTestingModule({
      imports: [MovimientosList],
      providers: [
        provideRouter([]),
        {
          provide: CatalogoService,
          useValue: {
            cargado: signal(true),
            cuentas,
            cuentasActivas: computed(() => cuentas()),
            categorias: signal([]),
            grupos: () => [],
            cuenta: (id: string) => (id === 'bcp' ? cuenta : undefined),
            categoria: () => ({ id: 'cat', nombre: 'Entretenimiento', tipo: 'egreso', padre_id: null, icono: 'movie', color: '#DB2777', activa: true }),
            nombreCategoria: () => 'Entretenimiento',
          },
        },
        {
          provide: MovimientosService,
          useValue: { listar, totales: vi.fn().mockResolvedValue({ cantidad: 3, ingresos: 0, egresos: 20 }) },
        },
        { provide: AccionesMovimiento, useValue: {} },
      ],
    });
  });

  async function montar() {
    const fixture = TestBed.createComponent(MovimientosList);
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('pide los movimientos del mes actual por defecto', async () => {
    await montar();
    const [filtro, pagina, tamanio] = listar.mock.calls[0];
    expect(filtro.desde).toBe(`${hoyISO().slice(0, 7)}-01`);
    expect(pagina).toBe(0);
    expect(tamanio).toBe(20);
  });

  it('muestra una fila por movimiento con su estado', async () => {
    const el = await montar();
    const filas = el.querySelectorAll('tbody tr');
    expect(filas.length).toBe(3);
    expect(filas[0].textContent).toContain('Programado');
    expect(filas[2].textContent).toContain('Anulado');
  });

  it('un movimiento anulado no ofrece acciones', async () => {
    const el = await montar();
    const botones = [...el.querySelectorAll('tbody button[aria-label^="Acciones de"]')].map((b) => b.getAttribute('aria-label'));
    expect(botones).toEqual(['Acciones de Alquiler', 'Acciones de Netflix']);
  });

  it('muestra los totales de lo filtrado', async () => {
    const texto = (await montar()).textContent!.replace(/\p{Zs}/gu, ' ');
    expect(texto).toContain('Egresos−S/ 20.00');
    expect(texto).toContain('3 movimientos');
  });
});
