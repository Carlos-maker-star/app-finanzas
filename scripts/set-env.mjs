// Genera src/environments/environment.ts con la conexión a Supabase.
//
// Lee SUPABASE_URL y SUPABASE_KEY de las variables de entorno (Vercel, Netlify, Cloudflare…)
// o, en local, del archivo .env de la raíz. Las variables del sistema tienen prioridad.
// Se ejecuta solo antes de `npm start`, `npm run build` y `npm test`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'src', 'environments', 'environment.ts');

function leerDotEnv() {
  const ruta = join(raiz, '.env');
  if (!existsSync(ruta)) {
    return {};
  }
  const valores = {};
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const coincide = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (coincide) {
      valores[coincide[1]] = coincide[2].replace(/^["']|["']$/g, '');
    }
  }
  return valores;
}

/** La app solo puede llevar la clave pública: la secreta salta todas las reglas RLS. */
function esClaveSecreta(clave) {
  if (clave.startsWith('sb_secret_')) {
    return true;
  }
  const partes = clave.split('.');
  if (partes.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8'));
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

const dotEnv = leerDotEnv();
const url = process.env.SUPABASE_URL || dotEnv.SUPABASE_URL;
const clave = process.env.SUPABASE_KEY || dotEnv.SUPABASE_KEY;

if (!url || !clave) {
  if (existsSync(destino)) {
    console.warn('[set-env] Faltan SUPABASE_URL / SUPABASE_KEY: se mantiene el environment.ts existente.');
    process.exit(0);
  }
  console.error('[set-env] Faltan SUPABASE_URL y SUPABASE_KEY. Defínelas en .env (local) o en el panel de tu hosting.');
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.error(`[set-env] SUPABASE_URL no parece una URL de Supabase: ${url}`);
  process.exit(1);
}
if (esClaveSecreta(clave)) {
  console.error('[set-env] SUPABASE_KEY es una clave SECRETA (service_role). Usa la publishable/anon key.');
  process.exit(1);
}

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  `// Archivo generado por scripts/set-env.mjs: no lo edites ni lo subas a git.
export const environment = {
  supabaseUrl: ${JSON.stringify(url.replace(/\/$/, ''))},
  /** Clave pública (publishable/anon): la seguridad la dan las políticas RLS de la base de datos. */
  supabaseKey: ${JSON.stringify(clave)},
};
`,
);
console.log(`[set-env] environment.ts listo (${url}).`);
