import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session } from '@supabase/supabase-js';
import { datos, ErrorApp, mensajeDeError } from '../errores';
import { Perfil } from '../models';
import { SUPABASE } from '../supabase';

/** Resultado del registro: con la confirmación de correo activada no hay sesión todavía. */
export type ResultadoRegistro = 'sesion' | 'confirmar-correo';

/**
 * Sesión (Supabase Auth) + perfil del usuario (tabla `perfiles`).
 * Todo es signal: la UI reacciona sola al iniciar o cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);
  private readonly router = inject(Router);

  private readonly sesion = signal<Session | null>(null);
  readonly perfil = signal<Perfil | null>(null);

  readonly usuarioId = computed(() => this.sesion()?.user.id ?? null);
  readonly email = computed(() => this.sesion()?.user.email ?? '');
  readonly autenticado = computed(() => this.sesion() !== null);
  readonly esAdmin = computed(() => this.perfil()?.rol === 'admin' && this.perfil()?.activo === true);
  /** Un admin puede desactivar la cuenta: el RLS le niega los datos y la UI lo explica. */
  readonly desactivado = computed(() => this.perfil()?.activo === false);
  /** El usuario llegó desde el enlace de "olvidé mi contraseña". */
  readonly recuperandoClave = signal(false);

  /** Se resuelve cuando se sabe si hay sesión guardada (los guards lo esperan). */
  readonly listo: Promise<void>;
  private cerrandoSesion = false;

  constructor() {
    this.listo = this.iniciar();
    this.supabase.auth.onAuthStateChange((evento, sesion) => {
      this.sesion.set(sesion);
      if (evento === 'PASSWORD_RECOVERY') {
        this.recuperandoClave.set(true);
      }
      if (evento === 'SIGNED_OUT') {
        this.perfil.set(null);
        if (!this.cerrandoSesion) {
          // La sesión caducó o se cerró en otra pestaña
          this.router.navigate(['/login'], { queryParams: { sesion: 'expirada' } });
        }
        this.cerrandoSesion = false;
      }
      if (sesion && (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') && this.perfil()?.id !== sesion.user.id) {
        // Fuera del callback: supabase-js no admite otras llamadas dentro de él
        setTimeout(() => this.cargarPerfil());
      }
    });
  }

  private async iniciar(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.sesion.set(data.session);
    if (data.session) {
      await this.cargarPerfil();
    }
  }

  async cargarPerfil(): Promise<void> {
    const id = this.usuarioId();
    if (!id) {
      return;
    }
    const { data } = await this.supabase
      .from('perfiles')
      .select('id, nombre, email, rol, activo, creado_en')
      .eq('id', id)
      .maybeSingle();
    this.perfil.set((data as Perfil | null) ?? null);
  }

  async login(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      throw new ErrorApp(mensajeDeError(error), error.code);
    }
    this.sesion.set(data.session);
    await this.cargarPerfil();
  }

  async registrar(nombre: string, email: string, password: string): Promise<ResultadoRegistro> {
    const { data, error } = await this.supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // El trigger `al_crear_usuario` crea el perfil con este nombre y las categorías por defecto
        data: { nombre: nombre.trim() },
        emailRedirectTo: `${location.origin}/login?confirmado=1`,
      },
    });
    if (error) {
      throw new ErrorApp(mensajeDeError(error), error.code);
    }
    // Con confirmación de correo, Supabase no revela si el correo ya existía: devuelve un usuario sin identidades
    if (data.user && data.user.identities?.length === 0) {
      throw new ErrorApp('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
    }
    if (data.session) {
      this.sesion.set(data.session);
      await this.cargarPerfil();
      return 'sesion';
    }
    return 'confirmar-correo';
  }

  async enviarRecuperacion(email: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/restablecer`,
    });
    if (error) {
      throw new ErrorApp(mensajeDeError(error), error.code);
    }
  }

  async cambiarClave(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) {
      throw new ErrorApp(mensajeDeError(error), error.code);
    }
    this.recuperandoClave.set(false);
  }

  async actualizarNombre(nombre: string): Promise<void> {
    const id = this.usuarioId();
    if (!id) {
      return;
    }
    await datos(this.supabase.from('perfiles').update({ nombre: nombre.trim() }).eq('id', id));
    this.perfil.update((p) => (p ? { ...p, nombre: nombre.trim() } : p));
  }

  async logout(): Promise<void> {
    this.cerrandoSesion = true;
    await this.supabase.auth.signOut();
    this.sesion.set(null);
    this.perfil.set(null);
    await this.router.navigate(['/login']);
  }
}
