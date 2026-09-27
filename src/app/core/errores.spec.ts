import { datos, ErrorApp, mensajeDeError } from './errores';

describe('mensajeDeError', () => {
  it('traduce los errores de inicio de sesión', () => {
    expect(mensajeDeError({ name: 'AuthApiError', code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(
      'Correo o contraseña incorrectos.',
    );
    expect(mensajeDeError({ name: 'AuthApiError', message: 'Email not confirmed' })).toContain('confirmas tu correo');
  });

  it('pasa tal cual los mensajes de los triggers (ya están en español)', () => {
    expect(mensajeDeError({ code: 'P0001', message: 'Este movimiento está anulado y ya no se puede modificar.' })).toBe(
      'Este movimiento está anulado y ya no se puede modificar.',
    );
  });

  it('explica las restricciones de la base de datos', () => {
    expect(mensajeDeError({ code: '23505', message: 'duplicate key value violates unique constraint "cuentas_nombre_uq"' })).toBe(
      'Ya tienes una cuenta con ese nombre.',
    );
    expect(
      mensajeDeError({
        code: '23503',
        message: 'update or delete on table "cuentas" violates foreign key constraint "movimientos_cuenta_fk" on table "movimientos"',
      }),
    ).toContain('archívala');
    expect(
      mensajeDeError({ code: '23503', message: 'insert or update on table "movimientos" violates foreign key constraint "movimientos_categoria_fk"' }),
    ).toBe('La categoría no corresponde al tipo de movimiento.');
    expect(mensajeDeError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(
      'No tienes permiso para realizar esta acción.',
    );
  });

  it('reconoce la falta de conexión', () => {
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toContain('No se pudo conectar');
  });

  it('datos() devuelve data o lanza un ErrorApp traducido', async () => {
    await expect(datos(Promise.resolve({ data: [1, 2], error: null }))).resolves.toEqual([1, 2]);
    await expect(datos(Promise.resolve({ data: null, error: { code: '23514', message: 'movimientos_monto_check' } }))).rejects.toEqual(
      new ErrorApp('El monto debe ser mayor que cero.', '23514'),
    );
  });
});
