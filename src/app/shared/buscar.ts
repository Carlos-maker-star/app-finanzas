/** Minúsculas y sin tildes: "Educación" y "educacion" coinciden. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** ¿El texto contiene lo buscado? (sin distinguir mayúsculas ni tildes). */
export function coincide(texto: string, busqueda: string): boolean {
  const b = normalizar(busqueda);
  return !b || normalizar(texto).includes(b);
}

/** Filtra una lista por el texto que devuelve `etiqueta`. */
export function filtrar<T>(lista: T[], busqueda: string, etiqueta: (item: T) => string): T[] {
  return normalizar(busqueda) ? lista.filter((item) => coincide(etiqueta(item), busqueda)) : lista;
}

/**
 * Filtra categorías agrupadas: si coincide la principal se muestran todas sus subcategorías;
 * si no, solo las subcategorías que coinciden (con su principal como encabezado).
 */
export function filtrarGrupos<G extends { categoria: { nombre: string }; subcategorias: { nombre: string }[] }>(
  grupos: G[],
  busqueda: string,
): G[] {
  if (!normalizar(busqueda)) {
    return grupos;
  }
  return grupos
    .map((g) =>
      coincide(g.categoria.nombre, busqueda) ? g : { ...g, subcategorias: g.subcategorias.filter((s) => coincide(s.nombre, busqueda)) },
    )
    .filter((g) => coincide(g.categoria.nombre, busqueda) || g.subcategorias.length > 0);
}
