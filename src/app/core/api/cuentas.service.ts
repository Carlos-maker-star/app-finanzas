import { inject, Injectable } from '@angular/core';
import { CatalogoService } from './catalogo.service';
import { datos } from '../errores';
import { CuentaForm, Movimiento, PuntoSaldo } from '../models';
import { SUPABASE } from '../supabase';

@Injectable({ providedIn: 'root' })
export class CuentasService {
  private readonly supabase = inject(SUPABASE);
  private readonly catalogo = inject(CatalogoService);

  async crear(cuenta: CuentaForm): Promise<void> {
    await datos(this.supabase.from('cuentas').insert(cuenta));
    await this.catalogo.recargarCuentas();
  }

  async actualizar(id: string, cuenta: CuentaForm): Promise<void> {
    await datos(this.supabase.from('cuentas').update(cuenta).eq('id', id));
    await this.catalogo.recargarCuentas();
  }

  async archivar(id: string, archivada: boolean): Promise<void> {
    await datos(this.supabase.from('cuentas').update({ archivada }).eq('id', id));
    await this.catalogo.recargarCuentas();
  }

  /** Solo funciona si la cuenta no tiene movimientos (la base de datos lo impide). */
  async eliminar(id: string): Promise<void> {
    await datos(this.supabase.from('cuentas').delete().eq('id', id));
    await this.catalogo.recargarCuentas();
  }

  /** Saldo al cierre de cada mes (función `evolucion_saldo_cuenta`). */
  async evolucion(id: string, meses = 6): Promise<PuntoSaldo[]> {
    const filas = await datos<PuntoSaldo[]>(this.supabase.rpc('evolucion_saldo_cuenta', { p_cuenta_id: id, p_meses: meses }));
    return filas.map((p) => ({ mes: p.mes, saldo: Number(p.saldo) }));
  }

  /** Movimientos (no anulados) que tocan la cuenta, del más reciente al más antiguo. */
  async movimientos(id: string, limite: number): Promise<Movimiento[]> {
    const filas = await datos<Movimiento[]>(
      this.supabase
        .from('movimientos')
        .select('id, tipo, estado, monto, fecha, cuenta_id, cuenta_destino_id, categoria_id, descripcion, nota, anulado_en, creado_en')
        .or(`cuenta_id.eq.${id},cuenta_destino_id.eq.${id}`)
        .neq('estado', 'anulado')
        .order('fecha', { ascending: false })
        .order('creado_en', { ascending: false })
        .limit(limite),
    );
    return filas.map((m) => ({ ...m, monto: Number(m.monto) }));
  }

  /** Entradas y salidas confirmadas de la cuenta entre dos fechas. */
  async flujo(id: string, desde: string, hasta: string): Promise<{ entradas: number; salidas: number; programado: number }> {
    const filas = await datos<Pick<Movimiento, 'tipo' | 'estado' | 'monto' | 'cuenta_destino_id'>[]>(
      this.supabase
        .from('movimientos')
        .select('tipo, estado, monto, cuenta_destino_id')
        .or(`cuenta_id.eq.${id},cuenta_destino_id.eq.${id}`)
        .in('estado', ['confirmado', 'programado'])
        .gte('fecha', desde)
        .lte('fecha', hasta),
    );
    let entradas = 0;
    let salidas = 0;
    let programado = 0;
    for (const m of filas) {
      const monto = Number(m.monto);
      const entra = m.cuenta_destino_id === id || m.tipo === 'ingreso';
      if (m.estado === 'programado') {
        programado += entra ? monto : -monto;
      } else if (entra) {
        entradas += monto;
      } else {
        salidas += monto;
      }
    }
    return { entradas, salidas, programado };
  }
}
