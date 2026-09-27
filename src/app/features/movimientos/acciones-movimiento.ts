import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { CatalogoService } from '../../core/api/catalogo.service';
import { MovimientosService } from '../../core/api/movimientos.service';
import { mensajeDeError } from '../../core/errores';
import { Movimiento } from '../../core/models';
import { NotificacionService } from '../../core/notificacion.service';
import { AnularDialog } from './anular-dialog';
import { MovimientoDialog, MovimientoDialogDatos } from './movimiento-dialog';

/**
 * Acciones sobre movimientos que se usan desde varias pantallas (dashboard, listado, cuenta).
 * Cada método devuelve `true` si algo cambió, para que la pantalla recargue.
 */
@Injectable({ providedIn: 'root' })
export class AccionesMovimiento {
  private readonly dialog = inject(MatDialog);
  private readonly servicio = inject(MovimientosService);
  private readonly catalogo = inject(CatalogoService);
  private readonly notificar = inject(NotificacionService);

  async nuevo(datos: MovimientoDialogDatos = {}): Promise<boolean> {
    const ref = this.dialog.open(MovimientoDialog, { data: datos });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  async editar(movimiento: Movimiento): Promise<boolean> {
    const ref = this.dialog.open(MovimientoDialog, { data: { movimiento } });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  async anular(movimiento: Movimiento): Promise<boolean> {
    const ref = this.dialog.open(AnularDialog, { data: movimiento, width: '480px' });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** Programado → Confirmado: desde ese momento cuenta en el saldo. */
  async confirmar(movimiento: Movimiento): Promise<boolean> {
    try {
      await this.servicio.cambiarEstado(movimiento.id, 'confirmado');
      await this.catalogo.recargarCuentas();
      this.notificar.exito('Movimiento confirmado: ya cuenta en tu saldo.');
      return true;
    } catch (e) {
      this.notificar.error(mensajeDeError(e));
      return false;
    }
  }
}
