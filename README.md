# MisFinanzas

Control de finanzas personales: cuentas (efectivo, bancos, tarjetas, Yape/Plin), ingresos, egresos y
transferencias, con dashboard mensual. Varios usuarios, cada uno con sus datos totalmente privados.

## Requisitos

- Node 22.22+ o 24.15+
- Un proyecto de Supabase con los scripts de `supabase/` ejecutados (01 → 02 → 03)

## Puesta en marcha

1. Crea un archivo `.env` en la raíz:

   ```
   SUPABASE_URL=https://TU-PROYECTO.supabase.co
   SUPABASE_KEY=sb_publishable_...
   ```

   Usa la clave **publishable** (o *anon*). Nunca la *secret* / *service_role*: el proyecto no arranca con ella.

2. Instala y levanta:

   ```bash
   npm install
   npm start
   ```

3. Abre http://localhost:4200 y regístrate.

4. Para ser administrador, en el SQL Editor de Supabase:

   ```sql
   update public.perfiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';
   ```

## Configuración en Supabase

Authentication → URL Configuration:

- **Site URL**: la URL donde está publicada la app (en desarrollo `http://localhost:4200`).
- **Redirect URLs**: `http://localhost:4200/**` y `https://tu-dominio/**`.

## Despliegue

Build: `npm run build` → carpeta `dist/misfinanzas/browser`.

En Vercel, Netlify o Cloudflare Pages define las variables de entorno `SUPABASE_URL` y `SUPABASE_KEY`;
el build genera la configuración con ellas. Ya se incluyen las reglas para que las rutas funcionen al
recargar la página (`vercel.json` y `public/_redirects`).

## Tests

```bash
npm test -- --watch=false
```
