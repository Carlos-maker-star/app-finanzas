import { coincide, filtrar, filtrarGrupos } from './buscar';

describe('búsqueda en listas', () => {
  it('no distingue mayúsculas ni tildes', () => {
    expect(coincide('Educación', 'educacion')).toBe(true);
    expect(coincide('Alimentación › Supermercado', 'SUPER')).toBe(true);
    expect(coincide('Yape', 'plin')).toBe(false);
    expect(coincide('Yape', '  ')).toBe(true);
  });

  it('filtra por la etiqueta que se indique', () => {
    const cuentas = [{ nombre: 'BCP Sueldo' }, { nombre: 'Efectivo' }, { nombre: 'Interbank Ahorros' }];
    expect(filtrar(cuentas, 'bank', (c) => c.nombre)).toEqual([{ nombre: 'Interbank Ahorros' }]);
    expect(filtrar(cuentas, '', (c) => c.nombre)).toHaveLength(3);
  });

  it('en categorías agrupadas conserva la principal de una subcategoría que coincide', () => {
    const grupos = [
      { categoria: { nombre: 'Alimentación' }, subcategorias: [{ nombre: 'Supermercado' }, { nombre: 'Delivery' }] },
      { categoria: { nombre: 'Transporte' }, subcategorias: [{ nombre: 'Taxi y apps' }] },
      { categoria: { nombre: 'Salud' }, subcategorias: [] },
    ];
    // Coincide una subcategoría: se ve su principal y solo esa subcategoría
    expect(filtrarGrupos(grupos, 'deliv')).toEqual([{ categoria: { nombre: 'Alimentación' }, subcategorias: [{ nombre: 'Delivery' }] }]);
    // Coincide la principal: se ven todas sus subcategorías
    expect(filtrarGrupos(grupos, 'aliment')[0].subcategorias).toHaveLength(2);
    expect(filtrarGrupos(grupos, 'xyz')).toEqual([]);
  });
});
