// Convierte los errores de Supabase (PostgREST y Auth) en mensajes claros en español.
// Las reglas de negocio viven en la base de datos (supabase/*.sql); aquí solo se traducen.

interface ErrorSupabase {
  code?: string;
  message?: string;
  details?: string | null;
  status?: number;
  name?: string;
}

/** Error ya traducido, listo para mostrar al usuario. */
export class ErrorApp extends Error {
  constructor(
    message: string,
    readonly codigo?: string,
  ) {
    super(message);
    this.name = 'ErrorApp';
  }
}

/** Restricciones de la base de datos → mensaje para el usuario. */
const RESTRICCIONES: [RegExp, string][] = [
  [/cuentas_nombre_uq/, 'Ya tienes una cuenta con ese nombre.'],
  [/categorias_nombre_uq/, 'Ya existe una categoría con ese nombre en ese mismo nivel.'],
  [/movimientos_forma_ck/, 'Una transferencia necesita dos cuentas distintas y ninguna categoría; un ingreso o egreso necesita una categoría.'],
  [/movimientos_monto_check/, 'El monto debe ser mayor que cero.'],
  [/categorias_padre_distinto_ck/, 'Una categoría no puede estar dentro de sí misma.'],
];

const AUTH: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Todavía no confirmas tu correo. Revisa tu bandeja de entrada (y la de spam).',
  user_already_exists: 'Ya existe una cuenta con ese correo.',
  email_exists: 'Ya existe una cuenta con ese correo.',
  weak_password: 'La contraseña es muy débil: usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser distinta de la actual.',
  over_email_send_rate_limit: 'Enviamos demasiados correos seguidos. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  email_address_invalid: 'Ese correo no es válido.',
  signup_disabled: 'El registro de nuevas cuentas está desactivado.',
  user_banned: 'Tu cuenta está desactivada.',
};

export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApp) {
    return error.message;
  }
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  }
  const e = (error ?? {}) as ErrorSupabase;
  const texto = `${e.message ?? ''} ${e.details ?? ''}`;

  // Errores de autenticación (AuthApiError trae `code` desde supabase-js 2.4x)
  if (e.name?.startsWith('Auth') || (e.code && AUTH[e.code])) {
    if (e.code && AUTH[e.code]) {
      return AUTH[e.code];
    }
    if (/invalid login credentials/i.test(texto)) return AUTH['invalid_credentials'];
    if (/email not confirmed/i.test(texto)) return AUTH['email_not_confirmed'];
    if (/already registered/i.test(texto)) return AUTH['user_already_exists'];
    if (/password should be at least/i.test(texto)) return AUTH['weak_password'];
  }

  switch (e.code) {
    case 'P0001':
      // Mensajes propios de los triggers (ya vienen en español)
      return e.message ?? 'La operación no está permitida.';
    case '23505':
      return RESTRICCIONES.find(([patron]) => patron.test(texto))?.[1] ?? 'Ese registro ya existe.';
    case '23514':
      return RESTRICCIONES.find(([patron]) => patron.test(texto))?.[1] ?? 'Algún dato no es válido.';
    case '23503':
      if (/delete on table "cuentas"/.test(texto)) {
        return 'Esta cuenta tiene movimientos: archívala en lugar de eliminarla para no perder tu historial.';
      }
      if (/delete on table "categorias"/.test(texto)) {
        return 'Esta categoría tiene movimientos o subcategorías: desactívala en lugar de eliminarla.';
      }
      if (/categoria_fk|categorias_padre_fk/.test(texto)) {
        return 'La categoría no corresponde al tipo de movimiento.';
      }
      if (/cuenta_fk|cuenta_destino_fk/.test(texto)) {
        return 'La cuenta seleccionada no es válida.';
      }
      return 'Hay datos relacionados que impiden esta operación.';
    case '42501':
      return 'No tienes permiso para realizar esta acción.';
    case 'PGRST116':
      return 'No encontramos ese registro.';
    case 'PGRST301':
    case 'PGRST303':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  }
  if (e.status === 0 || /failed to fetch|network/i.test(texto)) {
    return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.';
  }
  return 'Ocurrió un error inesperado. Inténtalo otra vez.';
}

/**
 * Espera una consulta de Supabase y devuelve `data`, o lanza un ErrorApp ya traducido.
 * Uso: `const cuentas = await datos(supabase.from('cuentas').select())`.
 */
export async function datos<T>(consulta: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await consulta;
  if (error) {
    throw new ErrorApp(mensajeDeError(error), (error as ErrorSupabase).code);
  }
  return data as T;
}
