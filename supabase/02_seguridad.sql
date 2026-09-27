-- =============================================================================
-- MisFinanzas · 02 · Seguridad (RLS y permisos)
-- -----------------------------------------------------------------------------
-- Ejecutar SEGUNDO, después de 01_tablas.sql.
-- Regla central: cada usuario solo ve y modifica SUS filas (usuario_id = auth.uid()).
-- El admin puede leer perfiles (para gestionar usuarios), nunca cuentas ni movimientos.
-- Se puede volver a ejecutar sin problemas.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Funciones auxiliares usadas por las políticas.
-- security definer: leen perfiles sin pasar por RLS (evita recursión).
-- -----------------------------------------------------------------------------
create or replace function privado.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

create or replace function privado.usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
  );
$$;

grant usage on schema privado to authenticated;
revoke execute on function privado.es_admin(), privado.usuario_activo() from public, anon;
grant execute on function privado.es_admin(), privado.usuario_activo() to authenticated;

-- -----------------------------------------------------------------------------
-- Permisos de tabla: se quitan todos y se dan solo los necesarios.
-- Los visitantes sin sesión (anon) no tienen acceso a nada.
-- -----------------------------------------------------------------------------
revoke all on table public.perfiles, public.cuentas, public.categorias, public.movimientos
  from anon, authenticated;

-- perfiles: el usuario solo puede cambiar su nombre (no su rol, email ni estado).
grant select on table public.perfiles to authenticated;
grant update (nombre) on table public.perfiles to authenticated;

grant select, insert, update, delete on table public.cuentas to authenticated;
grant select, insert, update, delete on table public.categorias to authenticated;

-- movimientos: no se borran, se anulan.
grant select, insert, update on table public.movimientos to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.perfiles    enable row level security;
alter table public.cuentas     enable row level security;
alter table public.categorias  enable row level security;
alter table public.movimientos enable row level security;

-- perfiles ---------------------------------------------------------------------
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select privado.es_admin()));

drop policy if exists perfiles_update on public.perfiles;
create policy perfiles_update on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- cuentas ----------------------------------------------------------------------
drop policy if exists cuentas_select on public.cuentas;
create policy cuentas_select on public.cuentas
  for select to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists cuentas_insert on public.cuentas;
create policy cuentas_insert on public.cuentas
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists cuentas_update on public.cuentas;
create policy cuentas_update on public.cuentas
  for update to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists cuentas_delete on public.cuentas;
create policy cuentas_delete on public.cuentas
  for delete to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

-- categorias -------------------------------------------------------------------
drop policy if exists categorias_select on public.categorias;
create policy categorias_select on public.categorias
  for select to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists categorias_insert on public.categorias;
create policy categorias_insert on public.categorias
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists categorias_update on public.categorias;
create policy categorias_update on public.categorias
  for update to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()))
  with check (usuario_id = (select auth.uid()));

drop policy if exists categorias_delete on public.categorias;
create policy categorias_delete on public.categorias
  for delete to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

-- movimientos (sin política de borrado) ----------------------------------------
drop policy if exists movimientos_select on public.movimientos;
create policy movimientos_select on public.movimientos
  for select to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists movimientos_insert on public.movimientos;
create policy movimientos_insert on public.movimientos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select privado.usuario_activo()));

drop policy if exists movimientos_update on public.movimientos;
create policy movimientos_update on public.movimientos
  for update to authenticated
  using (usuario_id = (select auth.uid()) and (select privado.usuario_activo()))
  with check (usuario_id = (select auth.uid()));

commit;
