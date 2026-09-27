-- =============================================================================
-- MisFinanzas · 01 · Tablas y reglas de integridad
-- -----------------------------------------------------------------------------
-- Ejecutar PRIMERO en Supabase → SQL Editor → New query → pegar → Run.
-- Crea: perfiles, cuentas, categorias y movimientos, con sus validaciones.
-- Todo va dentro de una transacción: si algo falla, no se crea nada a medias.
-- =============================================================================

begin;

-- Esquema interno para funciones auxiliares (no se expone en la API de Supabase).
create schema if not exists privado;

-- -----------------------------------------------------------------------------
-- perfiles: un registro por usuario de Supabase Auth (se crea solo al registrarse).
-- -----------------------------------------------------------------------------
create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre          text not null check (char_length(trim(nombre)) between 1 and 80),
  email           text not null,
  rol             text not null default 'usuario' check (rol in ('usuario', 'admin')),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

comment on table public.perfiles is 'Datos públicos de cada usuario. El rol admin solo gestiona usuarios, nunca ve finanzas.';

-- -----------------------------------------------------------------------------
-- cuentas: dónde está el dinero (efectivo, banco, tarjeta, ahorro, Yape/Plin...).
-- -----------------------------------------------------------------------------
create table public.cuentas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre          text not null check (char_length(trim(nombre)) between 1 and 60),
  tipo            text not null check (tipo in ('efectivo', 'banco', 'tarjeta_credito', 'ahorro', 'billetera_digital')),
  -- En tarjetas de crédito, la deuda inicial se registra en negativo.
  saldo_inicial   numeric(14, 2) not null default 0,
  color           text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icono           text,
  -- Las cuentas no se borran si tienen movimientos: se archivan.
  archivada       boolean not null default false,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  -- Permite que movimientos exija que la cuenta sea del mismo usuario.
  constraint cuentas_id_usuario_uq unique (id, usuario_id)
);

create unique index cuentas_nombre_uq on public.cuentas (usuario_id, lower(nombre));

-- -----------------------------------------------------------------------------
-- categorias: en qué se gana o se gasta. Admite un nivel de subcategorías.
-- -----------------------------------------------------------------------------
create table public.categorias (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre          text not null check (char_length(trim(nombre)) between 1 and 50),
  tipo            text not null check (tipo in ('ingreso', 'egreso')),
  padre_id        uuid,
  icono           text,
  color           text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Las categorías usadas no se borran: se desactivan.
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint categorias_id_usuario_tipo_uq unique (id, usuario_id, tipo),
  -- La subcategoría debe ser del mismo usuario y del mismo tipo que su padre.
  constraint categorias_padre_fk foreign key (padre_id, usuario_id, tipo)
    references public.categorias (id, usuario_id, tipo),
  constraint categorias_padre_distinto_ck check (padre_id is null or padre_id <> id)
);

create unique index categorias_nombre_uq on public.categorias
  (usuario_id, tipo, coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
create index categorias_padre_idx on public.categorias (padre_id) where padre_id is not null;

-- -----------------------------------------------------------------------------
-- movimientos: ingresos, egresos y transferencias entre cuentas propias.
-- Una transferencia es UN solo registro (origen → destino): nunca queda a medias.
-- -----------------------------------------------------------------------------
create table public.movimientos (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo               text not null check (tipo in ('ingreso', 'egreso', 'transferencia')),
  estado             text not null default 'confirmado' check (estado in ('programado', 'confirmado', 'anulado')),
  monto              numeric(14, 2) not null check (monto > 0),
  fecha              date not null default ((now() at time zone 'America/Lima')::date),
  cuenta_id          uuid not null,
  cuenta_destino_id  uuid,
  categoria_id       uuid,
  descripcion        text check (descripcion is null or char_length(descripcion) <= 200),
  nota               text check (nota is null or char_length(nota) <= 1000),
  anulado_en         timestamptz,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),

  -- Las cuentas y la categoría deben ser del mismo usuario; la categoría, del mismo tipo.
  constraint movimientos_cuenta_fk foreign key (cuenta_id, usuario_id)
    references public.cuentas (id, usuario_id),
  constraint movimientos_cuenta_destino_fk foreign key (cuenta_destino_id, usuario_id)
    references public.cuentas (id, usuario_id),
  constraint movimientos_categoria_fk foreign key (categoria_id, usuario_id, tipo)
    references public.categorias (id, usuario_id, tipo),

  -- Transferencia: lleva cuenta destino (distinta) y no lleva categoría.
  -- Ingreso/egreso: lleva categoría y no lleva cuenta destino.
  constraint movimientos_forma_ck check (
    (tipo = 'transferencia' and cuenta_destino_id is not null
      and cuenta_destino_id <> cuenta_id and categoria_id is null)
    or
    (tipo in ('ingreso', 'egreso') and cuenta_destino_id is null and categoria_id is not null)
  )
);

create index movimientos_usuario_fecha_idx on public.movimientos (usuario_id, fecha desc, creado_en desc);
create index movimientos_cuenta_idx on public.movimientos (cuenta_id);
create index movimientos_cuenta_destino_idx on public.movimientos (cuenta_destino_id) where cuenta_destino_id is not null;
create index movimientos_categoria_idx on public.movimientos (categoria_id) where categoria_id is not null;

-- -----------------------------------------------------------------------------
-- Trigger común: mantiene actualizado_en y protege creado_en.
-- -----------------------------------------------------------------------------
create or replace function privado.tocar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  new.creado_en := old.creado_en;
  return new;
end;
$$;

create trigger perfiles_actualizado_en before update on public.perfiles
  for each row execute function privado.tocar_actualizado_en();
create trigger cuentas_actualizado_en before update on public.cuentas
  for each row execute function privado.tocar_actualizado_en();
create trigger categorias_actualizado_en before update on public.categorias
  for each row execute function privado.tocar_actualizado_en();
create trigger movimientos_actualizado_en before update on public.movimientos
  for each row execute function privado.tocar_actualizado_en();

-- -----------------------------------------------------------------------------
-- Categorías: solo un nivel de subcategorías.
-- -----------------------------------------------------------------------------
create or replace function privado.validar_categoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.padre_id is not null then
    if exists (select 1 from public.categorias where id = new.padre_id and padre_id is not null) then
      raise exception 'Solo se permite un nivel de subcategorías.';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.categorias where padre_id = new.id) then
      raise exception 'Una categoría que tiene subcategorías no puede volverse subcategoría.';
    end if;
  end if;
  return new;
end;
$$;

create trigger categorias_validar before insert or update on public.categorias
  for each row execute function privado.validar_categoria();

-- -----------------------------------------------------------------------------
-- Movimientos: transiciones de estado y cuentas/categorías utilizables.
--   programado → confirmado | anulado
--   confirmado → anulado
--   anulado    → (ya no se modifica)
-- -----------------------------------------------------------------------------
create or replace function privado.validar_movimiento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado = 'anulado' then
      raise exception 'Un movimiento nuevo no puede registrarse como anulado.';
    end if;
    new.anulado_en := null;
  else
    if old.estado = 'anulado' then
      raise exception 'Este movimiento está anulado y ya no se puede modificar.';
    end if;
    if old.estado = 'confirmado' and new.estado = 'programado' then
      raise exception 'Un movimiento confirmado no puede volver a programado.';
    end if;
    new.usuario_id := old.usuario_id;
    new.anulado_en := case when new.estado = 'anulado' then now() else null end;
  end if;

  -- Solo se valida al elegir cuenta/categoría, para poder anular movimientos antiguos.
  if tg_op = 'INSERT'
     or new.cuenta_id is distinct from old.cuenta_id
     or new.cuenta_destino_id is distinct from old.cuenta_destino_id then
    if exists (
      select 1 from public.cuentas
      where id in (new.cuenta_id, new.cuenta_destino_id) and archivada
    ) then
      raise exception 'No se pueden registrar movimientos en una cuenta archivada.';
    end if;
  end if;

  if new.categoria_id is not null
     and (tg_op = 'INSERT' or new.categoria_id is distinct from old.categoria_id) then
    if exists (select 1 from public.categorias where id = new.categoria_id and not activa) then
      raise exception 'La categoría seleccionada está desactivada.';
    end if;
  end if;

  return new;
end;
$$;

create trigger movimientos_validar before insert or update on public.movimientos
  for each row execute function privado.validar_movimiento();

commit;
