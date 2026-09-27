import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatOptgroup, MatOption, MatSelect } from '@angular/material/select';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogoService } from '../../core/api/catalogo.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { aCsv, descargar } from '../../core/csv';
import { accionesMovimiento, ESTADOS, LISTA_ESTADOS, LISTA_TIPOS_MOVIMIENTO, TIPOS_MOVIMIENTO } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/errores';
import { finDeMes, hoyISO, inicioDeMes, nombreMes, sumarMeses } from '../../core/formato';
import { EstadoMovimiento, FiltroMovimientos, Movimiento, Pagina, TipoMovimiento, TotalesMovimientos } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { BuscadorSelect } from '../../shared/buscador-select';
import { filtrar, filtrarGrupos } from '../../shared/buscar';
import { ChipIcono } from '../../shared/chip-icono';
import { EstadoBadge } from '../../shared/estado-badge';
import { EstadoVacio } from '../../shared/estado-vacio';
import { FechaRelativaPipe } from '../../shared/fecha-relativa.pipe';
import { Monto } from '../../shared/monto';
import { SolesPipe } from '../../shared/soles.pipe';
import { AccionesMovimiento } from './acciones-movimiento';

/** `YYYY-MM` de un mes, o `todo` para todo el historial. */
type Periodo = string;

interface Filtros {
  periodo: Periodo;
  tipo: TipoMovimiento | null;
  cuentaId: string | null;
  categoriaId: string | null;
  estado: EstadoMovimiento | null;
  busqueda: string;
}

const FILTROS_INICIALES = (): Filtros => ({
  periodo: hoyISO().slice(0, 7),
  tipo: null,
  cuentaId: null,
  categoriaId: null,
  estado: null,
  busqueda: '',
});

@Component({
  selector: 'app-movimientos-list',
  imports: [
    ReactiveFormsModule, MatButton, MatIconButton, MatFormField, MatLabel, MatPrefix, MatInput, MatIcon, MatMenu,
    MatMenuItem, MatMenuTrigger, MatPaginator, MatProgressBar, MatSelect, MatOption, MatOptgroup, BuscadorSelect, ChipIcono, EstadoBadge,
    EstadoVacio, FechaRelativaPipe, Monto, SolesPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './movimientos-list.html',
})
export class MovimientosList {
  private readonly servicio = inject(MovimientosService);
  private readonly acciones = inject(AccionesMovimiento);
  private readonly notificar = inject(NotificacionService);
  private readonly router = inject(Router);
  protected readonly catalogo = inject(CatalogoService);

  /** `?q=` del buscador de la barra superior y `?cuenta=` desde el detalle de una cuenta. */
  readonly q = input<string>();
  readonly cuenta = input<string>();

  protected readonly estados = LISTA_ESTADOS;
  protected readonly etiquetasEstado = ESTADOS;
  protected readonly tipos = LISTA_TIPOS_MOVIMIENTO;
  protected readonly etiquetasTipo = TIPOS_MOVIMIENTO;
  protected readonly accionesDe = accionesMovimiento;

  /** Los últimos 24 meses para el selector de periodo. */
  protected readonly periodos = Array.from({ length: 24 }, (_, i) => {
    const mes = sumarMeses(inicioDeMes(hoyISO()), -i);
    return { valor: mes.slice(0, 7), etiqueta: nombreMes(mes) };
  });

  protected readonly busqueda = new FormControl('', { nonNullable: true });
  protected readonly filtros = signal<Filtros>(FILTROS_INICIALES());
  protected readonly pagina = signal(0);
  protected readonly tamanio = signal(20);
  protected readonly resultado = signal<Pagina<Movimiento> | null>(null);
  protected readonly totales = signal<TotalesMovimientos | null>(null);
  protected readonly cargando = signal(false);
  protected readonly exportando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly recarga = signal(0);

  protected readonly filtroActivo = computed(() => {
    const f = this.filtros();
    return !!(f.tipo || f.cuentaId || f.categoriaId || f.estado || f.busqueda);
  });

  protected readonly consulta = computed<FiltroMovimientos>(() => {
    const f = this.filtros();
    const mes = f.periodo === 'todo' ? null : `${f.periodo}-01`;
    return {
      desde: mes,
      hasta: mes ? finDeMes(mes) : null,
      tipo: f.tipo,
      cuentaId: f.cuentaId,
      categoriaId: f.categoriaId,
      estado: f.estado,
      busqueda: f.busqueda,
    };
  });

  // Texto de los buscadores de cada filtro
  protected readonly busquedaPeriodo = signal('');
  protected readonly busquedaTipo = signal('');
  protected readonly busquedaCuenta = signal('');
  protected readonly busquedaCategoria = signal('');
  protected readonly busquedaEstado = signal('');

  protected readonly periodosFiltrados = computed(() => filtrar(this.periodos, this.busquedaPeriodo(), (p) => p.etiqueta));
  protected readonly tiposFiltrados = computed(() => filtrar(this.tipos, this.busquedaTipo(), (t) => TIPOS_MOVIMIENTO[t].etiqueta));
  protected readonly cuentasFiltradas = computed(() => filtrar(this.catalogo.cuentas(), this.busquedaCuenta(), (c) => c.nombre));
  protected readonly estadosFiltrados = computed(() => filtrar(this.estados, this.busquedaEstado(), (e) => ESTADOS[e].etiqueta));
  protected readonly gruposEgresoFiltrados = computed(() => filtrarGrupos(this.catalogo.grupos('egreso'), this.busquedaCategoria()));
  protected readonly gruposIngresoFiltrados = computed(() => filtrarGrupos(this.catalogo.grupos('ingreso'), this.busquedaCategoria()));

  constructor() {
    // Parámetros de la URL → filtros
    effect(() => {
      const q = this.q() ?? '';
      const cuenta = this.cuenta() ?? null;
      untracked(() => {
        this.busqueda.setValue(q, { emitEvent: false });
        // Buscar un texto suele referirse a cualquier fecha: se amplía a todo el historial
        this.filtros.update((f) => ({ ...f, busqueda: q, cuentaId: cuenta ?? f.cuentaId, periodo: q ? 'todo' : f.periodo }));
        this.pagina.set(0);
      });
    });
    this.busqueda.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((busqueda) => this.cambiarFiltro({ busqueda }));

    // Cargar al cambiar filtros o página; se descarta la respuesta de una consulta ya superada
    let peticion = 0;
    effect(() => {
      const filtro = this.consulta();
      const pagina = this.pagina();
      const tamanio = this.tamanio();
      this.recarga();
      if (!this.catalogo.cargado()) {
        return; // el filtro por categoría necesita el catálogo
      }
      const esta = ++peticion;
      untracked(() => {
        this.cargando.set(true);
        this.error.set(null);
      });
      Promise.all([this.servicio.listar(filtro, pagina, tamanio), this.servicio.totales(filtro)])
        .then(([resultado, totales]) => {
          if (esta === peticion) {
            this.resultado.set(resultado);
            this.totales.set(totales);
          }
        })
        .catch((e) => esta === peticion && this.error.set(mensajeDeError(e)))
        .finally(() => esta === peticion && this.cargando.set(false));
    });
  }

  protected cambiarFiltro(cambio: Partial<Filtros>): void {
    this.filtros.update((f) => ({ ...f, ...cambio }));
    this.pagina.set(0);
  }

  protected limpiarFiltros(): void {
    this.busqueda.setValue('', { emitEvent: false });
    this.filtros.update((f) => ({ ...FILTROS_INICIALES(), periodo: f.periodo }));
    this.pagina.set(0);
    this.router.navigate([], { queryParams: {} });
  }

  protected cambiarPagina(e: PageEvent): void {
    this.pagina.set(e.pageIndex);
    this.tamanio.set(e.pageSize);
  }

  protected recargar(): void {
    this.recarga.update((n) => n + 1);
  }

  protected titulo(m: Movimiento): string {
    return m.descripcion || (m.tipo === 'transferencia' ? 'Transferencia' : this.catalogo.nombreCategoria(m.categoria_id));
  }

  protected async nuevo(): Promise<void> {
    if (await this.acciones.nuevo({ cuentaId: this.filtros().cuentaId ?? undefined })) this.recargar();
  }

  protected async editar(m: Movimiento): Promise<void> {
    if (await this.acciones.editar(m)) this.recargar();
  }

  protected async confirmar(m: Movimiento): Promise<void> {
    if (await this.acciones.confirmar(m)) this.recargar();
  }

  protected async anular(m: Movimiento): Promise<void> {
    if (await this.acciones.anular(m)) this.recargar();
  }

  protected async exportar(): Promise<void> {
    this.exportando.set(true);
    try {
      const movimientos = await this.servicio.todos(this.consulta());
      const csv = aCsv(
        ['Fecha', 'Tipo', 'Estado', 'Descripción', 'Categoría', 'Cuenta', 'Cuenta destino', 'Monto (S/)', 'Nota'],
        movimientos.map((m) => [
          m.fecha,
          TIPOS_MOVIMIENTO[m.tipo].etiqueta,
          ESTADOS[m.estado].etiqueta,
          m.descripcion,
          this.catalogo.nombreCategoria(m.categoria_id),
          this.catalogo.cuenta(m.cuenta_id)?.nombre,
          this.catalogo.cuenta(m.cuenta_destino_id)?.nombre,
          m.tipo === 'egreso' ? -m.monto : m.monto,
          m.nota,
        ]),
      );
      const periodo = this.filtros().periodo;
      descargar(csv, `movimientos-${periodo === 'todo' ? 'historial' : periodo}.csv`);
      this.notificar.exito(`Exportamos ${movimientos.length} movimientos.`);
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
    } finally {
      this.exportando.set(false);
    }
  }
}
