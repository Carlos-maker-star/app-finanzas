import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { VerClave } from './ver-clave';

@Component({
  imports: [VerClave],
  template: `
    <input appVerClave #clave="verClave" />
    <button type="button" (click)="clave.alternar()">ojo</button>
  `,
})
class Prueba {}

describe('VerClave', () => {
  it('oculta la contraseña por defecto y la muestra al pulsar el ojo', async () => {
    const fixture = TestBed.createComponent(Prueba);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(input.type).toBe('password');
    boton.click();
    await fixture.whenStable();
    expect(input.type).toBe('text');
    boton.click();
    await fixture.whenStable();
    expect(input.type).toBe('password');
  });
});
