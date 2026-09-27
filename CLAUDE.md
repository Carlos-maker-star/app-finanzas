# MisFinanzas

Control de finanzas personales multiusuario: cada usuario ve solo sus cuentas, movimientos y
categorías. Moneda única: soles (S/). Interfaz en español (Perú).

## Stack

- Angular 22.2 (standalone, zoneless, signals) + Angular Material 22.2 + Tailwind 4.3
- Supabase: Auth + PostgreSQL + RLS, consumido directo con `@supabase/supabase-js` (no hay backend propio)
- Tests: Vitest (`@angular/build:unit-test`, jsdom)
- Tipografía IBM Plex Sans / Plex Mono · íconos Material Symbols Rounded · paleta Azul

## Comandos

```bash
npm start            # genera environment.ts desde .env y levanta http://localhost:4200
npm run build        # build de producción en dist/misfinanzas/browser
npm test -- --watch=false
npm run config       # solo regenera src/environments/environment.ts
```

## Supabase

- Esquema en `supabase/01_tablas.sql`, `02_seguridad.sql`, `03_funciones.sql` (ejecutar en ese orden en el SQL Editor).
  Cambios futuros: un script nuevo numerado (`04_...sql`); no editar los ya ejecutados.
- **Las reglas de negocio viven en la base de datos**: RLS (`usuario_id = auth.uid()`), FKs compuestas que impiden
  usar cuentas/categorías de otro usuario o de otro tipo, trigger `validar_movimiento` (transiciones de estado,
  cuentas archivadas, categorías inactivas). La UI solo las refleja (`accionesMovimiento` en `core/etiquetas.ts`)
  y traduce los errores en `core/errores.ts`.
- Saldos y resúmenes se calculan en SQL: vista `v_saldos_cuentas`, funciones `resumen_dashboard`,
  `totales_movimientos`, `evolucion_saldo_cuenta`, `admin_*`.
- Conexión: `.env` (no se sube a git) con `SUPABASE_URL` y `SUPABASE_KEY` (**publishable/anon**). `scripts/set-env.mjs`
  genera `src/environments/environment.ts` y se niega a usar una clave secreta (`sb_secret_…` / `service_role`).
  En el hosting, definir esas dos variables de entorno.
- Primer admin: `update public.perfiles set rol = 'admin' where email = '…';` en el SQL Editor.

## Estructura

```
src/app/
├── core/
│   ├── supabase.ts          token SUPABASE (cliente; se reemplaza en tests)
│   ├── models.ts            tipos = columnas de las tablas/vistas/funciones (snake_case)
│   ├── etiquetas.ts         textos, íconos y clases de estados/tipos; colores de datos (claro/oscuro)
│   ├── formato.ts           soles, fechas (hora de Lima), meses, lectura de montos
│   ├── errores.ts           errores de Supabase → mensajes en español; helper datos()
│   ├── csv.ts               exportación a CSV
│   ├── auth/                AuthService (sesión + perfil en signals), guards
│   └── api/                 CatalogoService (cuentas+categorías en memoria) y un servicio por recurso
├── layout/                  shell (menú lateral + barra superior), navegacion.ts
├── shared/                  estado-badge, chip-icono, monto, soles/fecha pipes, estado-vacio, confirmar-dialog
└── features/
    ├── auth/                login, registro, recuperar, restablecer
    ├── dashboard/
    ├── movimientos/         listado, diálogo crear/editar, anular, acciones compartidas, lógica pura del formulario
    ├── cuentas/             listado, detalle (saldo corrido + gráfico), diálogo
    ├── categorias/          pantalla + diálogo
    ├── perfil/
    └── admin/               usuarios (sin acceso a finanzas ajenas)
```

## Convenciones

- Archivos estilo Angular 20+: `cuenta-detail.ts` + `.html`, clase `CuentaDetail` (sin sufijo `Component`).
  Plantillas cortas inline.
- `ChangeDetectionStrategy.OnPush`, estado con `signal`/`computed`, `inject()`. App zoneless.
- Servicios devuelven `Promise` (supabase-js); los componentes usan `async/await` y descartan respuestas
  de consultas superadas (contador de petición).
- Después de crear/editar/anular movimientos o cuentas: `catalogo.recargarCuentas()` (los saldos cambian).
- Montos: `numeric(14,2)` en la BD, siempre `Number(...)` al leer; mostrar con el pipe `soles` o `<app-monto>`
  (signo + color, nunca solo color). La moneda usa espacio no separable entre `S/` y el número.
- Fechas de movimiento: `YYYY-MM-DD` sin hora; "hoy" es la fecha de Lima (`hoyISO()`).
- Colores: solo utilidades de `src/tailwind.css` (`bg-surface`, `text-ingreso`…). El color de una cuenta o
  categoría es un dato: se pinta con `colorVisible()` para el modo oscuro.
- Tailwind 4 usa `!` como sufijo para `!important` (`bg-nav-active!`).
- Material: `matButton="filled"` (principal), `"outlined"` (secundario), `matButton` (texto); `boton-peligro`.
- No usar PrimeNG (requiere licencia desde la v21).

## Cambiar la paleta

Bloque "Primario" de `:root` y `.dark` en `src/tailwind.css` y los mismos hex en `mat.theme-overrides` de
`src/material.scss`.
