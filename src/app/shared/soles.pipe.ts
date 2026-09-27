import { Pipe, PipeTransform } from '@angular/core';
import { formatoSoles } from '../core/formato';

/** `{{ 1234.5 | soles }}` → `S/ 1,234.50`; negativos con signo menos: `−S/ 20.00`. */
@Pipe({ name: 'soles' })
export class SolesPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formatoSoles(valor ?? 0);
  }
}
