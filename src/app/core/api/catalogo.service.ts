import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { datos } from '../errores';
import { Categoria, Cuenta, TipoCategoria } from '../models';
import { SUPABASE } from '../supabase';

/** Categoría principal con sus subcategorías, para selects y la pantalla de categorías. */
export interface GrupoCategoria {
  categoria: Categoria;
  subcategorias: Categoria[];
}

/**
 * Cuentas (con saldo) y categorías del usuario. Son pocas, así que se cargan completas una vez
 * y se comparten entre pantallas; se recargan después de cada cambio que las afecte.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly supabase = inject(SUPABASE);
  private readonly auth = inject(AuthService);

  readonly cuentas = signal<Cuenta[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly cargado = signal(false);

  readonly cuentasActivas = computed(() => this.cuentas().filter((c) => !c.archivada));
  readonly cuentasArchivadas = computed(() => this.cuentas().filter((c) => c.archivada));
  readonly saldoTotal = computed(() => this.cuentas().reduce((suma, c) => suma + c.saldo_actual, 0));

  private readonly porId = computed(() => new Map(this.categorias().map((c) => [c.id, c])));
  private readonly cuentasPorId = computed(() => new Map(this.cuentas().map((c) => [c.id, c])));

  /** Quién es el usuario y si puede ver datos; solo al cambiar esto se recarga el catálogo. */
  private readonly clave = computed(() => {
    const id = this.auth.usuarioId();
    return id && !this.auth.desactivado() ? id : null;
  });

  constructor() {
    // Al cambiar de usuario, nada del anterior debe quedar en memoria
    effect(() => {
      const id = this.clave();
      untracked(() => {
        this.cuentas.set([]);
        this.categorias.set([]);
        this.cargado.set(false);
        if (id) {
          this.cargar().catch(() => this.cargado.set(true));
        }
      });
    });
  }

  async cargar(): Promise<void> {
    await Promise.all([this.recargarCuentas(), this.recargarCategorias()]);
    this.cargado.set(true);
  }

  async recargarCuentas(): Promise<void> {
    const filas = await datos<Cuenta[]>(
      this.supabase
        .from('v_saldos_cuentas')
        .select('id, nombre, tipo, color, icono, archivada, saldo_inicial, saldo_actual, cantidad_movimientos')
        .order('archivada')
        .order('nombre'),
    );
    this.cuentas.set(filas.map((c) => ({ ...c, saldo_inicial: Number(c.saldo_inicial), saldo_actual: Number(c.saldo_actual) })));
  }

  async recargarCategorias(): Promise<void> {
    this.categorias.set(
      await datos<Categoria[]>(
        this.supabase.from('categorias').select('id, nombre, tipo, padre_id, icono, color, activa').order('nombre'),
      ),
    );
  }

  cuenta(id: string | null | undefined): Cuenta | undefined {
    return id ? this.cuentasPorId().get(id) : undefined;
  }

  categoria(id: string | null | undefined): Categoria | undefined {
    return id ? this.porId().get(id) : undefined;
  }

  /** "Alimentación › Supermercado". */
  nombreCategoria(id: string | null | undefined): string {
    const c = this.categoria(id);
    if (!c) {
      return '';
    }
    const padre = this.categoria(c.padre_id);
    return padre ? `${padre.nombre} › ${c.nombre}` : c.nombre;
  }

  /** El id y los de sus subcategorías (filtrar por "Alimentación" incluye "Supermercado"). */
  idsConSubcategorias(id: string): string[] {
    return [id, ...this.categorias().filter((c) => c.padre_id === id).map((c) => c.id)];
  }

  /** Categorías de un tipo agrupadas en árbol; `soloActivas` para los formularios. */
  grupos(tipo: TipoCategoria, soloActivas = false): GrupoCategoria[] {
    const visibles = this.categorias().filter((c) => c.tipo === tipo && (!soloActivas || c.activa));
    return visibles
      .filter((c) => c.padre_id === null)
      .map((categoria) => ({
        categoria,
        subcategorias: visibles.filter((c) => c.padre_id === categoria.id),
      }));
  }
}
