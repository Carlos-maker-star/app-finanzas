import { inject, Injectable } from '@angular/core';
import { datos } from '../errores';
import { ResumenUsuarios, UsuarioAdmin } from '../models';
import { SUPABASE } from '../supabase';

/** Gestión de usuarios. Las funciones verifican en la base de datos que quien llama sea admin. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject(SUPABASE);

  async resumen(): Promise<ResumenUsuarios> {
    return datos<ResumenUsuarios>(this.supabase.rpc('admin_resumen_usuarios'));
  }

  async usuarios(): Promise<UsuarioAdmin[]> {
    return datos<UsuarioAdmin[]>(this.supabase.rpc('admin_listar_usuarios'));
  }

  async cambiarEstado(usuarioId: string, activo: boolean): Promise<void> {
    await datos(this.supabase.rpc('admin_cambiar_estado_usuario', { p_usuario: usuarioId, p_activo: activo }));
  }
}
