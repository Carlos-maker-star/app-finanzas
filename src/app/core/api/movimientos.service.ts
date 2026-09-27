import { inject, Injectable } from '@angular/core';
import { CatalogoService } from './catalogo.service';
import { datos, ErrorApp, mensajeDeError } from '../errores';
import { EstadoMovimiento, FiltroMovimientos, Movimiento, MovimientoForm, Pagina, TotalesMovimientos } from '../models';
import { SUPABASE } from '../supabase';

const COLUMNAS = 'id, tipo, estado, monto, fecha, cuenta_id, cuenta_destino_id, categoria_id, descripcion, nota, anulado_en, creado_en';

/** Quita los caracteres que tienen significado en los filtros de PostgREST. */
function limpiarBusqueda(texto: string | null | undefined): string {
  return (texto ?? '').replace(/[,()"\\%*]/g, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private readonly supabase = inject(SUPABASE);
  private readonly catalogo = inject(CatalogoService);

  async listar(filtro: FiltroMovimientos, pagina: number, tamanio: number): Promise<Pagina<Movimiento>> {
    const desde = pagina * tamanio;
    const { data, error, count } = await this.consulta(filtro, 'exact').range(desde, desde + tamanio - 1);
    if (error) {
      throw new ErrorApp(mensajeDeError(error), error.code);
    }
    return { contenido: (data as Movimiento[]).map(normalizar), total: count ?? 0 };
  }

  /** Todos los movimientos del filtro (para exportar). */
  async todos(filtro: FiltroMovimientos, limite = 10_000): Promise<Movimiento[]> {
    const filas = await datos<Movimiento[]>(this.consulta(filtro).limit(limite));
    return filas.map(normalizar);
  }

  /** Totales con los mismos filtros que la tabla (función `totales_movimientos`). */
  async totales(filtro: FiltroMovimientos): Promise<TotalesMovimientos> {
    const filas = await datos<TotalesMovimientos[]>(
      this.supabase.rpc('totales_movimientos', {
        p_desde: filtro.desde || null,
        p_hasta: filtro.hasta || null,
        p_tipo: filtro.tipo || null,
        p_estado: filtro.estado || null,
        p_cuenta: filtro.cuentaId || null,
        p_categoria: filtro.categoriaId || null,
        p_busqueda: limpiarBusqueda(filtro.busqueda) || null,
      }),
    );
    const t = filas[0] ?? { cantidad: 0, ingresos: 0, egresos: 0 };
    return { cantidad: Number(t.cantidad), ingresos: Number(t.ingresos), egresos: Number(t.egresos) };
  }

  async recientes(cantidad: number): Promise<Movimiento[]> {
    const filas = await datos<Movimiento[]>(
      this.supabase
        .from('movimientos')
        .select(COLUMNAS)
        .neq('estado', 'anulado')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false })
        .limit(cantidad),
    );
    return filas.map(normalizar);
  }

  async crear(movimiento: MovimientoForm): Promise<void> {
    await datos(this.supabase.from('movimientos').insert(movimiento));
  }

  async actualizar(id: string, movimiento: MovimientoForm): Promise<void> {
    await datos(this.supabase.from('movimientos').update(movimiento).eq('id', id));
  }

  async cambiarEstado(id: string, estado: EstadoMovimiento): Promise<void> {
    await datos(this.supabase.from('movimientos').update({ estado }).eq('id', id));
  }

  private consulta(filtro: FiltroMovimientos, conteo?: 'exact') {
    let q = this.supabase
      .from('movimientos')
      .select(COLUMNAS, conteo ? { count: conteo } : undefined)
      .order('fecha', { ascending: false })
      .order('creado_en', { ascending: false });
    if (filtro.desde) q = q.gte('fecha', filtro.desde);
    if (filtro.hasta) q = q.lte('fecha', filtro.hasta);
    if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
    if (filtro.estado) q = q.eq('estado', filtro.estado);
    if (filtro.cuentaId) q = q.or(`cuenta_id.eq.${filtro.cuentaId},cuenta_destino_id.eq.${filtro.cuentaId}`);
    if (filtro.categoriaId) q = q.in('categoria_id', this.catalogo.idsConSubcategorias(filtro.categoriaId));
    const texto = limpiarBusqueda(filtro.busqueda);
    if (texto) q = q.or(`descripcion.ilike.%${texto}%,nota.ilike.%${texto}%`);
    return q;
  }
}

/** PostgREST puede devolver `numeric` como texto según la configuración: siempre a número. */
function normalizar(m: Movimiento): Movimiento {
  return { ...m, monto: Number(m.monto) };
}
