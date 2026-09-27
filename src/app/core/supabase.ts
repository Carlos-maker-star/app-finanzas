import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Cliente único de Supabase. Es un token (no una clase) para poder reemplazarlo en los tests.
 * La sesión se guarda en localStorage y se renueva sola; el RLS de la base de datos decide
 * qué filas ve cada usuario.
 */
export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () =>
    createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        storageKey: 'misfinanzas.auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
});
