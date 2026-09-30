-- =====================================================================
-- Activity Payment Tracker — Supabase schema
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run on an empty project. Creates tables, rules, views,
-- roles (admin / viewer), row-level security and seeds Block A & B.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Building structure (pre-loaded)
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  id    bigint generated always as identity primary key,
  name  text not null unique                      -- 'A', 'B'
);

create table if not exists public.floors (
  id        bigint generated always as identity primary key,
  block_id  bigint not null references public.blocks(id) on delete cascade,
  number    int    not null check (number between 1 and 50),
  unique (block_id, number)
);

create table if not exists public.apartments (
  id        bigint generated always as identity primary key,
  floor_id  bigint not null references public.floors(id) on delete cascade,
  label     text   not null,                      -- 'R', 'M', 'L', 'PH1', 'PH2'
  unit_type text   not null check (unit_type in ('3BR', '1BR', 'Penthouse')),
  unique (floor_id, label)
);

-- ---------------------------------------------------------------------
-- 2. Activities (typed by admin, used as a dropdown)
-- ---------------------------------------------------------------------
create table if not exists public.activities (
  id          bigint generated always as identity primary key,
  name        text not null check (length(trim(name)) > 0),
  scope       text not null check (scope in ('apartment', 'floor')),
  created_at  timestamptz not null default now()
);
-- no two activities with the same name (case/space-insensitive)
create unique index if not exists activities_name_uq
  on public.activities (lower(trim(name)));

-- ---------------------------------------------------------------------
-- 3. Work orders: one activity at one location
-- ---------------------------------------------------------------------
create table if not exists public.work_orders (
  id               bigint generated always as identity primary key,
  activity_id      bigint not null references public.activities(id) on delete restrict,
  floor_id         bigint not null references public.floors(id)     on delete restrict,
  apartment_id     bigint          references public.apartments(id) on delete restrict,
  contract_amount  numeric(14,2) not null check (contract_amount > 0),
  notes            text,
  created_at       timestamptz not null default now()
);
-- DUPLICATE GUARD: same activity can't be contracted twice at the same place
create unique index if not exists work_orders_unique_location
  on public.work_orders (activity_id, floor_id, apartment_id) nulls not distinct;

-- Scope rules: per-apartment activity needs an apartment on that floor;
-- per-floor activity must not have an apartment.
create or replace function public.check_work_order_scope()
returns trigger language plpgsql as $$
declare
  v_scope text;
  v_apt_floor bigint;
begin
  select scope into v_scope from public.activities where id = new.activity_id;

  if v_scope = 'apartment' then
    if new.apartment_id is null then
      raise exception 'This activity is per apartment — choose an apartment.';
    end if;
    select floor_id into v_apt_floor from public.apartments where id = new.apartment_id;
    if v_apt_floor is distinct from new.floor_id then
      raise exception 'The apartment does not belong to the selected floor.';
    end if;
  elsif v_scope = 'floor' and new.apartment_id is not null then
    raise exception 'This activity is per floor — do not choose an apartment.';
  end if;
  return new;
end $$;

drop trigger if exists trg_work_order_scope on public.work_orders;
create trigger trg_work_order_scope
  before insert or update on public.work_orders
  for each row execute function public.check_work_order_scope();

-- ---------------------------------------------------------------------
-- 4. Payments: each row = "paid up to X %" for one work order.
--    The amount is NOT typed; it is calculated in v_payments as
--    contract × (this % − previous %). So paying the same % twice is
--    impossible and totals can never exceed 100 % of the contract.
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id               bigint generated always as identity primary key,
  work_order_id    bigint not null references public.work_orders(id) on delete cascade,
  paid_on          date   not null default current_date,
  percent_to_date  numeric(5,2) not null check (percent_to_date > 0 and percent_to_date <= 100),
  notes            text,
  created_by       uuid default auth.uid(),
  created_at       timestamptz not null default now(),
  -- DUPLICATE GUARD: a % level can only be paid once per work order
  unique (work_order_id, percent_to_date)
);

-- New payments must go beyond what is already paid.
-- (Admins may still edit or delete existing rows; amounts recalculate.)
create or replace function public.check_payment_progress()
returns trigger language plpgsql as $$
declare
  v_max numeric;
begin
  -- lock the work order so two people can't pay at the same moment
  perform 1 from public.work_orders where id = new.work_order_id for update;

  select coalesce(max(percent_to_date), 0) into v_max
  from public.payments where work_order_id = new.work_order_id;

  if new.percent_to_date <= v_max then
    raise exception 'Already paid up to % %% for this work order. Enter a higher percentage.', v_max;
  end if;
  return new;
end $$;

drop trigger if exists trg_payment_progress on public.payments;
create trigger trg_payment_progress
  before insert on public.payments
  for each row execute function public.check_payment_progress();

-- ---------------------------------------------------------------------
-- 5. Users & roles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

-- every new auth user gets a profile (viewer by default)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- 6. Read views (used by the app)
-- ---------------------------------------------------------------------
create or replace view public.v_payments
with (security_invoker = true) as
select
  p.*,
  coalesce(lag(p.percent_to_date) over w, 0)                        as previous_percent,
  p.percent_to_date - coalesce(lag(p.percent_to_date) over w, 0)    as percent_paid,
  round(wo.contract_amount
        * (p.percent_to_date - coalesce(lag(p.percent_to_date) over w, 0)) / 100, 2) as amount
from public.payments p
join public.work_orders wo on wo.id = p.work_order_id
window w as (partition by p.work_order_id order by p.percent_to_date);

create or replace view public.v_work_orders
with (security_invoker = true) as
select
  wo.id,
  wo.activity_id,
  a.name                                   as activity_name,
  a.scope,
  wo.floor_id,
  f.number                                 as floor_number,
  b.id                                     as block_id,
  b.name                                   as block_name,
  wo.apartment_id,
  ap.label                                 as apartment_label,
  ap.unit_type,
  b.name || '-F' || f.number || coalesce('-' || ap.label, '')        as location,
  wo.contract_amount,
  wo.notes,
  wo.created_at,
  coalesce(pay.paid_percent, 0)                                       as paid_percent,
  round(wo.contract_amount * coalesce(pay.paid_percent, 0) / 100, 2) as paid_amount,
  round(wo.contract_amount * (100 - coalesce(pay.paid_percent, 0)) / 100, 2) as balance,
  pay.payment_count,
  pay.last_paid_on,
  case
    when coalesce(pay.paid_percent, 0) >= 100 then 'completed'
    when coalesce(pay.paid_percent, 0) > 0    then 'in_progress'
    else 'not_started'
  end                                                                 as status
from public.work_orders wo
join public.activities a  on a.id  = wo.activity_id
join public.floors f      on f.id  = wo.floor_id
join public.blocks b      on b.id  = f.block_id
left join public.apartments ap on ap.id = wo.apartment_id
left join lateral (
  select max(percent_to_date) as paid_percent,
         count(*)             as payment_count,
         max(paid_on)         as last_paid_on
  from public.payments p where p.work_order_id = wo.id
) pay on true;

create or replace view public.v_floor_progress
with (security_invoker = true) as
select
  f.id                                  as floor_id,
  b.id                                  as block_id,
  b.name                                as block_name,
  f.number                              as floor_number,
  count(v.id)                           as total_work_orders,
  count(v.id) filter (where v.status = 'completed')  as completed,
  count(v.id) filter (where v.status <> 'completed') as remaining,
  coalesce(sum(v.contract_amount), 0)   as contract_total,
  coalesce(sum(v.paid_amount), 0)       as paid_total,
  coalesce(sum(v.balance), 0)           as balance_total,
  case when coalesce(sum(v.contract_amount), 0) = 0 then 0
       else round(sum(v.paid_amount) / sum(v.contract_amount) * 100, 1)
  end                                   as progress_percent
from public.floors f
join public.blocks b on b.id = f.block_id
left join public.v_work_orders v on v.floor_id = f.id
group by f.id, b.id, b.name, f.number;

-- ---------------------------------------------------------------------
-- 7. Row-level security: everyone logged in can READ,
--    only admins can CREATE / UPDATE / DELETE.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['blocks','floors','apartments','activities','work_orders','payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read_%1$s" on public.%1$I', t);
    execute format('drop policy if exists "admin_write_%1$s" on public.%1$I', t);
    execute format('create policy "read_%1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "admin_write_%1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "read_own_or_admin" on public.profiles;
drop policy if exists "admin_update_profiles" on public.profiles;
create policy "read_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin_update_profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.v_payments, public.v_work_orders, public.v_floor_progress to authenticated;

-- ---------------------------------------------------------------------
-- 8. Seed: Block A & B, floors 1–9, apartments
--    Floors 1–8: R (3BR), M (1BR), L (3BR). Floor 9: PH1, PH2.
-- ---------------------------------------------------------------------
insert into public.blocks (name) values ('A'), ('B') on conflict (name) do nothing;

insert into public.floors (block_id, number)
select b.id, n from public.blocks b cross join generate_series(1, 9) n
on conflict (block_id, number) do nothing;

insert into public.apartments (floor_id, label, unit_type)
select f.id, u.label, u.unit_type
from public.floors f
cross join (values ('R','3BR'), ('M','1BR'), ('L','3BR')) as u(label, unit_type)
where f.number between 1 and 8
on conflict (floor_id, label) do nothing;

insert into public.apartments (floor_id, label, unit_type)
select f.id, u.label, 'Penthouse'
from public.floors f
cross join (values ('PH1'), ('PH2')) as u(label)
where f.number = 9
on conflict (floor_id, label) do nothing;
