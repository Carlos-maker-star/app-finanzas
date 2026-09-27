import { inject, Injectable } from '@angular/core';
import { datos } from '../errores';
import { ResumenDashboard } from '../models';
import { SUPABASE } from '../supabase';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly supabase = inject(SUPABASE);

  /** KPIs y gráficos de un mes (`YYYY-MM-01`), calculados en la base de datos. */
  async resumen(mes: string): Promise<ResumenDashboard> {
    const r = await datos<ResumenDashboard>(this.supabase.rpc('resumen_dashboard', { p_mes: mes }));
    return {
      ...r,
      saldo_total: Number(r.saldo_total),
      ingresos_mes: Number(r.ingresos_mes),
      egresos_mes: Number(r.egresos_mes),
      ahorro_mes: Number(r.ahorro_mes),
      tasa_ahorro: r.tasa_ahorro === null ? null : Number(r.tasa_ahorro),
      ingresos_mes_anterior: Number(r.ingresos_mes_anterior),
      egresos_mes_anterior: Number(r.egresos_mes_anterior),
      serie_6_meses: r.serie_6_meses.map((p) => ({ mes: p.mes, ingresos: Number(p.ingresos), egresos: Number(p.egresos) })),
      gastos_por_categoria: r.gastos_por_categoria.map((g) => ({ ...g, total: Number(g.total) })),
    };
  }
}
