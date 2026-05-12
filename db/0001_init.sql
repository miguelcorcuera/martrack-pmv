-- =====================================================================
-- MarTrack PMV - 0001_init.sql
-- Esquema completo: enums, tablas, RLS, triggers, funciones, storage.
-- Ejecutar en SQL Editor de tu Supabase (martrack-dev) UNA SOLA VEZ.
-- Idempotente para los enums/tablas (usa IF NOT EXISTS donde aplica).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ============== ENUMS ==============
do $$ begin create type app_role as enum ('root','gerencia','coordinador','supervisor');
exception when duplicate_object then null; end $$;

do $$ begin create type employee_status as enum ('activo','pendiente','inactivo','bloqueado');
exception when duplicate_object then null; end $$;

do $$ begin create type access_status as enum ('activo','bloqueado','inactivo','sin_acceso');
exception when duplicate_object then null; end $$;

do $$ begin create type operational_role as enum (
  'coordinador','supervisor','conductor','operario','administrativo','responsable_flota');
exception when duplicate_object then null; end $$;

do $$ begin create type vehicle_status as enum ('disponible','asignado','mantenimiento','baja','revision');
exception when duplicate_object then null; end $$;

do $$ begin create type fuel_type as enum ('gasolina','diesel','hibrido','electrico','glp');
exception when duplicate_object then null; end $$;

do $$ begin create type delivery_status as enum (
  'borrador','evidencias_pendientes','pendiente_supervisor',
  'pendiente_firma','firmado','cerrado','cancelado');
exception when duplicate_object then null; end $$;

do $$ begin create type municipality_status as enum ('activo','inactivo');
exception when duplicate_object then null; end $$;

-- ============== TABLAS ==============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);

create table if not exists public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  zone text,
  internal_responsible text,
  status municipality_status default 'activo',
  observations text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  first_name text not null,
  last_name text not null,
  full_name text generated always as (first_name || ' ' || last_name) stored,
  dni_nie_fake text,
  email text unique,
  phone text,
  birth_year int,
  hire_date date,
  department text,
  position text,
  role_operational operational_role,
  municipality_id uuid references public.municipalities(id) on delete set null,
  status employee_status default 'activo',
  driving_license_type text,
  driving_license_expiry date,
  can_drive boolean default false,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  access_status access_status default 'sin_acceso',
  observations text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists employees_municipality_idx on public.employees(municipality_id);
create index if not exists employees_role_op_idx on public.employees(role_operational);
create index if not exists employees_status_idx on public.employees(status);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null unique,
  brand text not null,
  model text not null,
  year int,
  registration_date date,
  color text,
  engine text,
  fuel fuel_type default 'diesel',
  mileage int default 0,
  municipality_id uuid references public.municipalities(id) on delete set null,
  status vehicle_status default 'disponible',
  current_responsible_employee_id uuid references public.employees(id) on delete set null,
  observations text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists vehicles_municipality_idx on public.vehicles(municipality_id);
create index if not exists vehicles_status_idx on public.vehicles(status);

create table if not exists public.vehicle_deliveries (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  municipality_id uuid references public.municipalities(id) on delete set null,
  coordinator_user_id uuid references auth.users(id) on delete set null,
  supervisor_employee_id uuid references public.employees(id) on delete set null,
  recipient_employee_id uuid references public.employees(id) on delete set null,
  delivery_date date not null default current_date,
  observations text,
  status delivery_status default 'borrador',
  signed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists deliveries_vehicle_idx on public.vehicle_deliveries(vehicle_id);
create index if not exists deliveries_supervisor_idx on public.vehicle_deliveries(supervisor_employee_id);
create index if not exists deliveries_status_idx on public.vehicle_deliveries(status);

create table if not exists public.vehicle_evidence (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  delivery_id uuid references public.vehicle_deliveries(id) on delete set null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  uploaded_by_employee_id uuid references public.employees(id) on delete set null,
  file_name text not null,
  file_type text,
  file_size int,
  storage_bucket text not null,
  storage_path text not null,
  description text,
  status text default 'active',
  is_deleted boolean default false,
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists evidence_vehicle_idx on public.vehicle_evidence(vehicle_id) where is_deleted = false;
create index if not exists evidence_delivery_idx on public.vehicle_evidence(delivery_id) where is_deleted = false;

create table if not exists public.delivery_signatures (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.vehicle_deliveries(id) on delete cascade,
  signer_employee_id uuid references public.employees(id) on delete set null,
  signer_user_id uuid references auth.users(id) on delete set null,
  signature_storage_path text not null,
  accepted_terms boolean not null default false,
  signed_at timestamptz default now(),
  ip text,
  user_agent text
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_employee_id uuid references public.employees(id) on delete set null,
  actor_role app_role,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  description text,
  created_at timestamptz default now()
);
create index if not exists audit_entity_idx on public.audit_log(entity_type, entity_id);
create index if not exists audit_created_idx on public.audit_log(created_at desc);

-- ============== FUNCIONES ==============
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_user_role()
returns app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid()
  order by case role
    when 'root' then 1 when 'gerencia' then 2
    when 'coordinador' then 3 when 'supervisor' then 4
  end limit 1
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text;
begin
  for t in select unnest(array['profiles','municipalities','employees','vehicles','vehicle_deliveries','vehicle_evidence']) loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============== RLS ==============
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.municipalities enable row level security;
alter table public.employees enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_deliveries enable row level security;
alter table public.vehicle_evidence enable row level security;
alter table public.delivery_signatures enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select to authenticated using (
  id = auth.uid() or public.has_role(auth.uid(),'root')
  or public.has_role(auth.uid(),'gerencia') or public.has_role(auth.uid(),'coordinador')
);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated using (
  id = auth.uid() or public.has_role(auth.uid(),'root')
);

drop policy if exists "user_roles_read" on public.user_roles;
create policy "user_roles_read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'root'));
drop policy if exists "user_roles_root_all" on public.user_roles;
create policy "user_roles_root_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'root')) with check (public.has_role(auth.uid(),'root'));

drop policy if exists "muni_read" on public.municipalities;
create policy "muni_read" on public.municipalities for select to authenticated using (true);
drop policy if exists "muni_write" on public.municipalities;
create policy "muni_write" on public.municipalities for all to authenticated
  using (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
  with check (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'));

drop policy if exists "emp_read" on public.employees;
create policy "emp_read" on public.employees for select to authenticated using (true);
drop policy if exists "emp_write" on public.employees;
create policy "emp_write" on public.employees for all to authenticated
  using (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
  with check (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'));

drop policy if exists "veh_read" on public.vehicles;
create policy "veh_read" on public.vehicles for select to authenticated using (true);
drop policy if exists "veh_write" on public.vehicles;
create policy "veh_write" on public.vehicles for all to authenticated
  using (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
  with check (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'));

drop policy if exists "deliv_read" on public.vehicle_deliveries;
create policy "deliv_read" on public.vehicle_deliveries for select to authenticated using (
  public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'gerencia')
  or public.has_role(auth.uid(),'coordinador')
  or exists (select 1 from public.employees e where e.id = vehicle_deliveries.supervisor_employee_id and e.auth_user_id = auth.uid())
);
drop policy if exists "deliv_write_admin" on public.vehicle_deliveries;
create policy "deliv_write_admin" on public.vehicle_deliveries for all to authenticated
  using (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
  with check (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'));
drop policy if exists "deliv_supervisor_update" on public.vehicle_deliveries;
create policy "deliv_supervisor_update" on public.vehicle_deliveries for update to authenticated
  using (exists (select 1 from public.employees e
                 where e.id = vehicle_deliveries.supervisor_employee_id and e.auth_user_id = auth.uid()));

drop policy if exists "ev_read" on public.vehicle_evidence;
create policy "ev_read" on public.vehicle_evidence for select to authenticated using (
  is_deleted = false or public.has_role(auth.uid(),'root')
);
drop policy if exists "ev_insert" on public.vehicle_evidence;
create policy "ev_insert" on public.vehicle_evidence for insert to authenticated with check (
  public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador')
  or exists (select 1 from public.employees e where e.auth_user_id = auth.uid() and e.role_operational = 'supervisor')
);
drop policy if exists "ev_update" on public.vehicle_evidence;
create policy "ev_update" on public.vehicle_evidence for update to authenticated
  using (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
  with check (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'));

drop policy if exists "sig_read" on public.delivery_signatures;
create policy "sig_read" on public.delivery_signatures for select to authenticated using (
  public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'gerencia')
  or public.has_role(auth.uid(),'coordinador') or signer_user_id = auth.uid()
);
drop policy if exists "sig_insert" on public.delivery_signatures;
create policy "sig_insert" on public.delivery_signatures for insert to authenticated
  with check (public.has_role(auth.uid(),'root') or signer_user_id = auth.uid());

drop policy if exists "audit_read" on public.audit_log;
create policy "audit_read" on public.audit_log for select to authenticated using (
  public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'gerencia')
);
drop policy if exists "audit_insert" on public.audit_log;
create policy "audit_insert" on public.audit_log for insert to authenticated with check (
  actor_user_id = auth.uid() or public.has_role(auth.uid(),'root')
);

-- ============== STORAGE BUCKETS ==============
insert into storage.buckets (id, name, public) values
  ('vehicle-photos','vehicle-photos', true),
  ('vehicle-documents','vehicle-documents', false),
  ('signatures','signatures', false)
on conflict (id) do nothing;

drop policy if exists "vp_read" on storage.objects;
create policy "vp_read" on storage.objects for select using (bucket_id = 'vehicle-photos');

drop policy if exists "vd_read_auth" on storage.objects;
create policy "vd_read_auth" on storage.objects for select to authenticated
  using (bucket_id in ('vehicle-documents','signatures'));

drop policy if exists "buckets_insert_auth" on storage.objects;
create policy "buckets_insert_auth" on storage.objects for insert to authenticated
  with check (bucket_id in ('vehicle-photos','vehicle-documents','signatures'));

drop policy if exists "buckets_admin_modify" on storage.objects;
create policy "buckets_admin_modify" on storage.objects for update to authenticated using (
  bucket_id in ('vehicle-photos','vehicle-documents','signatures') and
  (public.has_role(auth.uid(),'root') or public.has_role(auth.uid(),'coordinador'))
);
drop policy if exists "buckets_admin_delete" on storage.objects;
create policy "buckets_admin_delete" on storage.objects for delete to authenticated using (
  bucket_id in ('vehicle-photos','vehicle-documents','signatures') and
  public.has_role(auth.uid(),'root')
);

-- ============== SEED DEMO ==============
insert into public.municipalities (name, zone, internal_responsible, status)
select * from (values
  ('Palma','Centro','Resp. Palma','activo'::municipality_status),
  ('Calvià','Sur-Oeste','Resp. Calvià','activo'),
  ('Marratxí','Centro','Resp. Marratxí','activo'),
  ('Llucmajor','Sur','Resp. Llucmajor','activo'),
  ('Inca','Norte','Resp. Inca','activo'),
  ('Manacor','Este','Resp. Manacor','activo'),
  ('Sóller','Norte-Oeste','Resp. Sóller','activo'),
  ('Alcúdia','Norte','Resp. Alcúdia','activo'),
  ('Andratx','Oeste','Resp. Andratx','activo'),
  ('Santa Margalida','Norte','Resp. Sta. Margalida','activo')
) as t(name, zone, internal_responsible, status)
where not exists (select 1 from public.municipalities);

do $$
declare
  munis uuid[];
  first_names text[] := array[
    'Juan','María','Pedro','Lucía','Antonio','Carmen','Jorge','Elena','Miguel','Sara',
    'Carlos','Laura','David','Marta','Javier','Ana','Pablo','Patricia','Sergio','Beatriz',
    'Luis','Cristina','Andrés','Nuria','Rafael','Silvia','Ignacio','Eva','Álvaro','Rocío',
    'Daniel','Pilar','Hugo','Sofía','Mario','Irene','Adrián','Carla','Rubén','Alicia'];
  last_names text[] := array[
    'Pérez','García','Martínez','López','Sánchez','Fernández','González','Rodríguez','Gómez','Ruiz',
    'Hernández','Jiménez','Álvarez','Moreno','Muñoz','Romero','Alonso','Gutiérrez','Navarro','Torres',
    'Domínguez','Vázquez','Ramos','Gil','Ramírez','Serrano','Blanco','Suárez','Molina','Morales',
    'Ortega','Delgado','Castro','Ortiz','Rubio','Marín','Sanz','Iglesias','Núñez','Medina'];
  i int; rop operational_role;
begin
  if exists (select 1 from public.employees) then return; end if;
  select array_agg(id order by name) into munis from public.municipalities;
  for i in 1..40 loop
    rop := case
      when i <= 5 then 'coordinador'::operational_role
      when i <= 10 then 'supervisor'::operational_role
      when i <= 25 then 'conductor'::operational_role
      when i <= 33 then 'operario'::operational_role
      when i <= 38 then 'administrativo'::operational_role
      else 'responsable_flota'::operational_role
    end;
    insert into public.employees (
      employee_code, first_name, last_name, dni_nie_fake, email, phone,
      birth_year, hire_date, department, position, role_operational,
      municipality_id, status, can_drive, driving_license_type
    ) values (
      'EMP-' || lpad(i::text, 4, '0'),
      first_names[i], last_names[i],
      lpad(((10000000 + i*137))::text, 8, '0') || chr(65 + (i % 26)),
      lower(first_names[i]) || '.' || lower(last_names[i]) || i::text || '.demo@martrack.local',
      '+34 6' || lpad(((10000000 + i*1234))::text, 8, '0'),
      1962 + ((i * 7) % 40),
      (date '2018-01-01' + (i * 47) * interval '1 day')::date,
      case rop
        when 'coordinador' then 'Coordinación'
        when 'supervisor' then 'Operaciones'
        when 'conductor' then 'Flota'
        when 'operario' then 'Mantenimiento'
        when 'administrativo' then 'Administración'
        else 'Flota'
      end,
      initcap(rop::text),
      rop,
      munis[((i-1) % array_length(munis,1)) + 1],
      'activo'::employee_status,
      rop in ('conductor','supervisor','responsable_flota','coordinador'),
      'B'
    );
  end loop;
end $$;

do $$
declare
  munis uuid[];
  brands text[] := array['Renault','Peugeot','Citroën','Ford','Volkswagen','Seat','Fiat','Iveco','Toyota','Dacia'];
  models text[] := array['Kangoo','Partner','Berlingo','Transit','Caddy','Inca','Doblo','Daily','Hilux','Duster'];
  i int;
begin
  if exists (select 1 from public.vehicles) then return; end if;
  select array_agg(id order by name) into munis from public.municipalities;
  for i in 1..10 loop
    insert into public.vehicles (plate, brand, model, year, registration_date, color, engine, fuel, mileage, municipality_id, status)
    values (
      lpad((1000 + i*123)::text, 4,'0') || ' ' || chr(65+i) || chr(66+i) || chr(67+i),
      brands[i], models[i],
      2018 + (i % 7),
      (date '2018-01-01' + (i * 137) * interval '1 day')::date,
      (array['Blanco','Gris','Azul','Rojo','Negro'])[1 + (i % 5)],
      '1.5',
      (array['diesel','gasolina','hibrido','electrico','glp'])[1 + (i % 5)]::fuel_type,
      10000 + i*4321,
      munis[((i-1) % array_length(munis,1)) + 1],
      (array['disponible','asignado','revision','mantenimiento','disponible'])[1 + (i % 5)]::vehicle_status
    );
  end loop;
end $$;

do $$
declare vh record; sup_emp uuid; rec_emp uuid; st delivery_status; i int := 0;
begin
  if exists (select 1 from public.vehicle_deliveries) then return; end if;
  for vh in select id, municipality_id from public.vehicles limit 5 loop
    i := i + 1;
    select id into sup_emp from public.employees
      where role_operational = 'supervisor' and status = 'activo' order by random() limit 1;
    select id into rec_emp from public.employees
      where role_operational in ('conductor','operario') and status = 'activo' order by random() limit 1;
    st := (array['borrador','pendiente_firma','pendiente_firma','firmado','cerrado'])[i]::delivery_status;
    insert into public.vehicle_deliveries (
      vehicle_id, municipality_id, supervisor_employee_id, recipient_employee_id,
      delivery_date, observations, status, signed_at, closed_at
    ) values (
      vh.id, vh.municipality_id, sup_emp, rec_emp,
      current_date - (i * 3),
      'Entrega demo #' || i, st,
      case when st in ('firmado','cerrado') then now() - (i || ' days')::interval else null end,
      case when st = 'cerrado' then now() - (i || ' days')::interval else null end
    );
  end loop;
end $$;
