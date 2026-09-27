import { inject, Injectable } from '@angular/core';
import { CatalogoService } from './catalogo.service';
import { datos } from '../errores';
import { CategoriaForm } from '../models';
import { SUPABASE } from '../supabase';

@Injectable({ providedIn: 'root' })
export class CategoriasService {
  private readonly supabase = inject(SUPABASE);
  private readonly catalogo = inject(CatalogoService);

  async crear(categoria: CategoriaForm): Promise<void> {
    await datos(this.supabase.from('categorias').insert(categoria));
    await this.catalogo.recargarCategorias();
  }

  async actualizar(id: string, categoria: CategoriaForm): Promise<void> {
    await datos(this.supabase.from('categorias').update(categoria).eq('id', id));
    await this.catalogo.recargarCategorias();
  }

  async activar(id: string, activa: boolean): Promise<void> {
    await datos(this.supabase.from('categorias').update({ activa }).eq('id', id));
    await this.catalogo.recargarCategorias();
  }

  /** Solo funciona si no tiene movimientos ni subcategorías (la base de datos lo impide). */
  async eliminar(id: string): Promise<void> {
    await datos(this.supabase.from('categorias').delete().eq('id', id));
    await this.catalogo.recargarCategorias();
  }
}
