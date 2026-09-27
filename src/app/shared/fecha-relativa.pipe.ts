import { Pipe, PipeTransform } from '@angular/core';
import { fechaRelativa } from '../core/formato';

/** `YYYY-MM-DD` → "Hoy", "Ayer", "Mañana" o "24 set.". */
@Pipe({ name: 'fechaRelativa' })
export class FechaRelativaPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    return valor ? fechaRelativa(valor) : '';
  }
}
