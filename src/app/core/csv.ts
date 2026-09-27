// Exportación a CSV (se abre directo en Excel: UTF-8 con BOM, separador coma, punto decimal).

/** Escapa un valor: entre comillas si tiene coma, comillas o saltos de línea. */
export function celdaCsv(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  const texto = typeof valor === 'number' ? valor.toFixed(2) : String(valor);
  // Evita que Excel interprete el contenido como fórmula
  const seguro = /^[=+\-@]/.test(texto) && typeof valor !== 'number' ? `'${texto}` : texto;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function aCsv(encabezados: string[], filas: (string | number | null | undefined)[][]): string {
  return [encabezados, ...filas].map((fila) => fila.map(celdaCsv).join(',')).join('\r\n');
}

/** Descarga un texto como archivo desde el navegador. */
export function descargar(contenido: string, nombre: string, tipo = 'text/csv;charset=utf-8'): void {
  const blob = new Blob(['﻿', contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
