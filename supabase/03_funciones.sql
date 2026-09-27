-- =============================================================================
-- MisFinanzas · 03 · Saldos, resúmenes, registro de usuarios y administración
-- -----------------------------------------------------------------------------
-- Ejecutar TERCERO, después de 02_seguridad.sql.
-- Se puede volver a ejecutar sin problemas.
--
-- Contenido:
--   · v_saldos_cuentas           saldo actual de cada cuenta
--   · resumen_dashboard()        KPIs y gráficos del dashboard
--   · totales_movimientos()      totales de la lista filtrada de movimientos
--   · evolucion_saldo_cuenta()   saldo a fin de cada mes (detalle de cuenta)
--   · al registrarse: perfil + categorías por defecto
--   · admin_*()                  gestión de usuarios (sin acceso a finanzas)
--
-- Regla del saldo: saldo_inicial + ingresos − egresos − transferencias que salen
-- + transferencias que entran. Solo cuentan los movimientos CONFIRMADOS.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Saldo de cada cuenta. security_invoker: respeta el RLS de quien consulta.
-- -----------------------------------------------------------------------------
create or replace view public.v_saldos_cuentas
with (security_invoker = true)
as
select
  c.id,
  c.usuario_id,
  c.nombre,
  c.tipo,
  c.color,
  c.icono,
  c.archivada,
  c.saldo_inicial,
  c.saldo_inicial + coalesce(sum(
    case
      when m.cuenta_destino_id = c.id then m.monto   -- transferencia que entra
      when m.tipo = 'ingreso'         then m.monto
      else -m.monto                                  -- egreso o transferencia que sale
    end
  ), 0) as saldo_actual,
  count(m.id) as cantidad_movimientos
from public.cuentas c
left join public.movimientos m
  on m.estado = 'confirmado'
 and (m.cuenta_id = c.id or m.cuenta_destino_id = c.id)
group by c.id;

revoke all on table public.v_saldos_cuentas from anon, authenticated;
grant select on table public.v_saldos_cuentas to authenticated;

-- -----------------------------------------------------------------------------
-- Resumen del dashboard para un mes (por defecto, el mes actual en hora de Lima).
-- Uso desde Angular: supabase.rpc('resumen_dashboard', { p_mes: '2026-09-01' })
-- -----------------------------------------------------------------------------
create or replace function public.resumen_dashboard(p_mes date default null)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_inicio     date := date_trunc('month', coalesce(p_mes, (now() at time zone 'America/Lima')::date))::date;
  v_fin        date := (v_inicio + interval '1 month')::date;
  v_anterior   date := (v_inicio - interval '1 month')::date;
  v_saldo      numeric;
  v_ing        numeric;
  v_egr        numeric;
  v_ing_ant    numeric;
  v_egr_ant    numeric;
  v_serie      jsonb;
  v_categorias jsonb;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  select coalesce(sum(s.saldo_actual), 0)
    into v_saldo
    from public.v_saldos_cuentas s
   where s.usuario_id = v_uid;

  select
    coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and m.fecha >= v_inicio), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'egreso'  and m.fecha >= v_inicio), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and m.fecha <  v_inicio), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'egreso'  and m.fecha <  v_inicio), 0)
    into v_ing, v_egr, v_ing_ant, v_egr_ant
    from public.movimientos m
   where m.usuario_id = v_uid
     and m.estado = 'confirmado'
     and m.fecha >= v_anterior
     and m.fecha <  v_fin;

  -- Ingresos vs egresos de los últimos 6 meses (incluye meses en cero).
  select coalesce(jsonb_agg(jsonb_build_object(
           'mes',      to_char(s.mes, 'YYYY-MM'),
           'ingresos', coalesce(t.ingresos, 0),
           'egresos',  coalesce(t.egresos, 0)
         ) order by s.mes), '[]'::jsonb)
    into v_serie
    from (
      select g::date as mes
      from generate_series(v_inicio - interval '5 months', v_inicio::timestamp, interval '1 month') g
    ) s
    left join (
      select date_trunc('month', m.fecha)::date as mes,
             sum(m.monto) filter (where m.tipo = 'ingreso') as ingresos,
             sum(m.monto) filter (where m.tipo = 'egreso')  as egresos
        from public.movimientos m
       where m.usuario_id = v_uid
         and m.estado = 'confirmado'
         and m.fecha >= (v_inicio - interval '5 months')::date
         and m.fecha <  v_fin
       group by 1
    ) t on t.mes = s.mes;

  -- Gastos del mes agrupados por categoría principal (las subcategorías suman a su padre).
  select coalesce(jsonb_agg(jsonb_build_object(
           'categoria_id', c.id,
           'nombre',       c.nombre,
           'icono',        c.icono,
           'color',        c.color,
           'total',        t.total
         ) order by t.total desc), '[]'::jsonb)
    into v_categorias
    from (
      select coalesce(cat.padre_id, cat.id) as categoria_id, sum(m.monto) as total
        from public.movimientos m
        join public.categorias cat on cat.id = m.categoria_id
       where m.usuario_id = v_uid
         and m.estado = 'confirmado'
         and m.tipo = 'egreso'
         and m.fecha >= v_inicio
         and m.fecha <  v_fin
       group by 1
    ) t
    join public.categorias c on c.id = t.categoria_id;

  return jsonb_build_object(
    'mes',                   to_char(v_inicio, 'YYYY-MM'),
    'saldo_total',           v_saldo,
    'ingresos_mes',          v_ing,
    'egresos_mes',           v_egr,
    'ahorro_mes',            v_ing - v_egr,
    'tasa_ahorro',           case when v_ing > 0 then round((v_ing - v_egr) * 100 / v_ing, 1) end,
    'ingresos_mes_anterior', v_ing_ant,
    'egresos_mes_anterior',  v_egr_ant,
    'serie_6_meses',         v_serie,
    'gastos_por_categoria',  v_categorias
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Totales de la lista de movimientos con los mismos filtros de la pantalla.
-- Los anulados cuentan en "cantidad" pero no suman montos.
-- Filtrar por una categoría principal incluye sus subcategorías.
-- -----------------------------------------------------------------------------
create or replace function public.totales_movimientos(
  p_desde     date default null,
  p_hasta     date default null,
  p_tipo      text default null,
  p_estado    text default null,
  p_cuenta    uuid default null,
  p_categoria uuid default null,
  p_busqueda  text default null
)
returns table (cantidad bigint, ingresos numeric, egresos numeric)
language sql
stable
set search_path = ''
as $$
  select
    count(*),
    coalesce(sum(m.monto) filter (where m.tipo = 'ingreso' and m.estado <> 'anulado'), 0),
    coalesce(sum(m.monto) filter (where m.tipo = 'egreso'  and m.estado <> 'anulado'), 0)
  from public.movimientos m
  left join public.categorias c on c.id = m.categoria_id
  where m.usuario_id = auth.uid()
    and (p_desde     is null or m.fecha >= p_desde)
    and (p_hasta     is null or m.fecha <= p_hasta)
    and (p_tipo      is null or m.tipo = p_tipo)
    and (p_estado    is null or m.estado = p_estado)
    and (p_cuenta    is null or p_cuenta in (m.cuenta_id, m.cuenta_destino_id))
    and (p_categoria is null or p_categoria in (m.categoria_id, c.padre_id))
    and (nullif(trim(p_busqueda), '') is null
         or m.descripcion ilike '%' || trim(p_busqueda) || '%'
         or m.nota        ilike '%' || trim(p_busqueda) || '%');
$$;

-- -----------------------------------------------------------------------------
-- Saldo de una cuenta al cierre de cada mes (gráfico del detalle de cuenta).
-- -----------------------------------------------------------------------------
create or replace function public.evolucion_saldo_cuenta(p_cuenta_id uuid, p_meses int default 6)
returns table (mes date, saldo numeric)
language sql
stable
set search_path = ''
as $$
  with hoy as (
    select date_trunc('month', (now() at time zone 'America/Lima')::date::timestamp) as inicio_mes
  )
  select
    g::date,
    c.saldo_inicial + coalesce((
      select sum(
        case
          when m.cuenta_destino_id = c.id then m.monto
          when m.tipo = 'ingreso'         then m.monto
          else -m.monto
        end)
      from public.movimientos m
      where m.estado = 'confirmado'
        and (m.cuenta_id = c.id or m.cuenta_destino_id = c.id)
        and m.fecha < (g + interval '1 month')::date
    ), 0)
  from public.cuentas c
  cross join hoy
  cross join generate_series(
    hoy.inicio_mes - make_interval(months => least(greatest(p_meses, 1), 24) - 1),
    hoy.inicio_mes,
    interval '1 month'
  ) g
  where c.id = p_cuenta_id
  order by 1;
$$;

-- -----------------------------------------------------------------------------
-- Registro de usuarios: perfil + categorías por defecto.
-- -----------------------------------------------------------------------------
create or replace function privado.crear_categorias_por_defecto(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_padre uuid;
begin
  -- Ingresos
  insert into public.categorias (usuario_id, nombre, tipo, icono, color) values
    (p_usuario, 'Sueldo',                  'ingreso', 'payments',        '#16A34A'),
    (p_usuario, 'Trabajos extra',          'ingreso', 'work',            '#0D9488'),
    (p_usuario, 'Ventas',                  'ingreso', 'storefront',      '#2563EB'),
    (p_usuario, 'Intereses y rendimientos','ingreso', 'savings',         '#7C3AED'),
    (p_usuario, 'Regalos recibidos',       'ingreso', 'redeem',          '#DB2777'),
    (p_usuario, 'Otros ingresos',          'ingreso', 'add_circle',      '#64748B');

  -- Egresos sin subcategorías
  insert into public.categorias (usuario_id, nombre, tipo, icono, color) values
    (p_usuario, 'Vivienda',                'egreso', 'home',             '#7C3AED'),
    (p_usuario, 'Salud',                   'egreso', 'medical_services', '#DC2626'),
    (p_usuario, 'Educación',               'egreso', 'school',           '#2563EB'),
    (p_usuario, 'Entretenimiento',         'egreso', 'movie',            '#DB2777'),
    (p_usuario, 'Ropa y cuidado personal', 'egreso', 'checkroom',        '#9333EA'),
    (p_usuario, 'Hogar',                   'egreso', 'chair',            '#65A30D'),
    (p_usuario, 'Mascotas',                'egreso', 'pets',             '#A16207'),
    (p_usuario, 'Comisiones bancarias',    'egreso', 'account_balance',  '#475569'),
    (p_usuario, 'Regalos y donaciones',    'egreso', 'card_giftcard',    '#E11D48'),
    (p_usuario, 'Otros gastos',            'egreso', 'more_horiz',       '#64748B');

  -- Egresos con subcategorías
  insert into public.categorias (usuario_id, nombre, tipo, icono, color)
    values (p_usuario, 'Alimentación', 'egreso', 'restaurant', '#EA580C')
    returning id into v_padre;
  insert into public.categorias (usuario_id, nombre, tipo, padre_id, icono, color) values
    (p_usuario, 'Supermercado', 'egreso', v_padre, 'shopping_cart',   '#EA580C'),
    (p_usuario, 'Restaurantes', 'egreso', v_padre, 'restaurant_menu', '#EA580C'),
    (p_usuario, 'Delivery',     'egreso', v_padre, 'delivery_dining', '#EA580C');

  insert into public.categorias (usuario_id, nombre, tipo, icono, color)
    values (p_usuario, 'Transporte', 'egreso', 'directions_car', '#0891B2')
    returning id into v_padre;
  insert into public.categorias (usuario_id, nombre, tipo, padre_id, icono, color) values
    (p_usuario, 'Taxi y apps',        'egreso', v_padre, 'local_taxi',        '#0891B2'),
    (p_usuario, 'Transporte público', 'egreso', v_padre, 'directions_bus',    '#0891B2'),
    (p_usuario, 'Combustible',        'egreso', v_padre, 'local_gas_station', '#0891B2');

  insert into public.categorias (usuario_id, nombre, tipo, icono, color)
    values (p_usuario, 'Servicios', 'egreso', 'bolt', '#CA8A04')
    returning id into v_padre;
  insert into public.categorias (usuario_id, nombre, tipo, padre_id, icono, color) values
    (p_usuario, 'Luz',      'egreso', v_padre, 'lightbulb',  '#CA8A04'),
    (p_usuario, 'Agua',     'egreso', v_padre, 'water_drop', '#CA8A04'),
    (p_usuario, 'Internet', 'egreso', v_padre, 'wifi',       '#CA8A04'),
    (p_usuario, 'Celular',  'egreso', v_padre, 'smartphone', '#CA8A04');
end;
$$;

create or replace function privado.crear_perfil(p_id uuid, p_email text, p_meta jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- El nombre viene del formulario de registro (options.data.nombre en supabase.auth.signUp);
  -- si no llega, se usa la parte del correo antes de la @.
  insert into public.perfiles (id, nombre, email)
  values (
    p_id,
    left(coalesce(
      nullif(trim(p_meta ->> 'nombre'), ''),
      nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
      'Usuario'
    ), 80),
    coalesce(p_email, '')
  );

  perform privado.crear_categorias_por_defecto(p_id);
end;
$$;

create or replace function privado.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.crear_perfil(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.manejar_nuevo_usuario();

-- Usuarios que ya existían antes de este script (por ejemplo, creados desde el panel).
do $$
declare
  r record;
begin
  for r in
    select u.id, u.email, u.raw_user_meta_data
      from auth.users u
     where not exists (select 1 from public.perfiles p where p.id = u.id)
  loop
    perform privado.crear_perfil(r.id, r.email, r.raw_user_meta_data);
  end loop;
end;
$$;

-- Estas funciones solo las usa el trigger: nadie más puede ejecutarlas.
revoke execute on function
  privado.crear_categorias_por_defecto(uuid),
  privado.crear_perfil(uuid, text, jsonb),
  privado.manejar_nuevo_usuario()
from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Administración de usuarios (solo rol admin). No exponen montos de nadie.
-- -----------------------------------------------------------------------------
create or replace function public.admin_resumen_usuarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_inicio_mes timestamptz := date_trunc('month', now() at time zone 'America/Lima') at time zone 'America/Lima';
begin
  if not privado.es_admin() then
    raise exception 'Acceso solo para administradores.' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'total',          count(*),
      'activos',        count(*) filter (where p.activo),
      'inactivos',      count(*) filter (where not p.activo),
      'nuevos_mes',     count(*) filter (where p.creado_en >= v_inicio_mes),
      'con_actividad_30_dias', (
        select count(distinct m.usuario_id)
          from public.movimientos m
         where m.creado_en >= now() - interval '30 days'
      )
    )
    from public.perfiles p
  );
end;
$$;

create or replace function public.admin_listar_usuarios()
returns table (
  id            uuid,
  nombre        text,
  email         text,
  rol           text,
  activo        boolean,
  creado_en     timestamptz,
  ultimo_acceso timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not privado.es_admin() then
    raise exception 'Acceso solo para administradores.' using errcode = '42501';
  end if;

  return query
    select p.id, p.nombre, p.email, p.rol, p.activo, p.creado_en, u.last_sign_in_at
      from public.perfiles p
      join auth.users u on u.id = p.id
     order by p.creado_en desc;
end;
$$;

create or replace function public.admin_cambiar_estado_usuario(p_usuario uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not privado.es_admin() then
    raise exception 'Acceso solo para administradores.' using errcode = '42501';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes desactivar tu propia cuenta.';
  end if;

  update public.perfiles set activo = p_activo where id = p_usuario;
  if not found then
    raise exception 'Usuario no encontrado.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de las funciones públicas (RPC): solo usuarios con sesión.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.resumen_dashboard(date),
  public.totales_movimientos(date, date, text, text, uuid, uuid, text),
  public.evolucion_saldo_cuenta(uuid, int),
  public.admin_resumen_usuarios(),
  public.admin_listar_usuarios(),
  public.admin_cambiar_estado_usuario(uuid, boolean)
from public, anon;

grant execute on function
  public.resumen_dashboard(date),
  public.totales_movimientos(date, date, text, text, uuid, uuid, text),
  public.evolucion_saldo_cuenta(uuid, int),
  public.admin_resumen_usuarios(),
  public.admin_listar_usuarios(),
  public.admin_cambiar_estado_usuario(uuid, boolean)
to authenticated;

commit;

-- =============================================================================
-- PRIMER ADMINISTRADOR (hacerlo una sola vez, después de registrarte en la app
-- o de crear tu usuario en Authentication → Users → Add user):
--
--   update public.perfiles set rol = 'admin' where email = 'tu-correo@ejemplo.com';
--
-- =============================================================================
