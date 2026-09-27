-- Grandma's Truck Lot — real tables replacing the old lot_kv blob store.
-- Safe to run on the existing project: nothing here drops lot_kv.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles (one per signed-in Google account) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  company text not null default '',
  truck text not null default '',
  plate text not null default '',
  role text not null default 'driver' check (role in ('driver','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Create a profile row the moment someone signs in for the first time.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- settings (single-row tables; jsonb so the owner can grow them) ----------
create table if not exists public.lot_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.lot_private_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- nightly bookings ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  company text not null default '',
  truck text not null default '',
  plate text not null default '',
  arrive date not null,
  nights int not null check (nights between 1 and 30),
  extras jsonb not null default '{"showers":0,"loads":0}'::jsonb,
  amount_cents int not null check (amount_cents >= 0),
  paid boolean not null default false,
  status text not null default 'reserved'
    check (status in ('pending_payment','reserved','parked','departed','cancelled')),
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_arrive_idx on public.bookings (arrive);
create index if not exists bookings_user_idx on public.bookings (user_id);
create index if not exists bookings_status_idx on public.bookings (status);
drop trigger if exists bookings_updated_at on public.bookings;
create trigger bookings_updated_at before update on public.bookings for each row execute function public.set_updated_at();

-- ---------- monthly members ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  company text not null default '',
  truck text not null default '',
  plate text not null default '',
  started date not null,
  next_bill date not null,
  amount_cents int not null check (amount_cents >= 0),
  status text not null default 'active'
    check (status in ('pending_payment','active','past_due','cancelled')),
  ended date,
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists members_user_idx on public.members (user_id);
create index if not exists members_status_idx on public.members (status);
drop trigger if exists members_updated_at on public.members;
create trigger members_updated_at before update on public.members for each row execute function public.set_updated_at();

create table if not exists public.member_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  amount_cents int not null check (amount_cents >= 0),
  note text not null default ''
);
create index if not exists member_payments_member_idx on public.member_payments (member_id);

-- ---------- reviews ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  booking_code text,
  name text not null,
  stars int not null check (stars between 1 and 5),
  text text not null,
  date date not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_approved_idx on public.reviews (approved, date desc);

-- ---------- audit log (who did what in the dashboard) ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  target text not null default '',
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

-- ---------- row level security ----------
-- The website's server talks to the database with the service role, which bypasses RLS.
-- These policies are what a signed-in driver (or an anonymous visitor) can do directly.
alter table public.profiles enable row level security;
alter table public.lot_settings enable row level security;
alter table public.lot_private_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.members enable row level security;
alter table public.member_payments enable row level security;
alter table public.reviews enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Drivers may edit their contact details but never their own role. Only the server (service role) sets roles.
create or replace function public.protect_profile_role()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();

drop policy if exists "settings: public read" on public.lot_settings;
create policy "settings: public read" on public.lot_settings for select to anon, authenticated using (true);
-- lot_private_settings: no policies on purpose. Only the server (service role) reads gate codes.

drop policy if exists "bookings: read own" on public.bookings;
create policy "bookings: read own" on public.bookings for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "members: read own" on public.members;
create policy "members: read own" on public.members for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "member_payments: read own" on public.member_payments;
create policy "member_payments: read own" on public.member_payments for select to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())));

drop policy if exists "reviews: public read approved" on public.reviews;
create policy "reviews: public read approved" on public.reviews for select to anon, authenticated using (approved = true);
-- audit_log: no policies. Server only.

-- ---------- seed ----------
-- Public settings: keep whatever address the old app saved, everything else comes from the app defaults.
insert into public.lot_settings (id, data)
select 1, coalesce(
  (select jsonb_build_object('address', (value::jsonb)->>'address') from public.lot_kv where key = 'lot:cfg' and (value::jsonb) ? 'address'),
  '{}'::jsonb)
where not exists (select 1 from public.lot_settings where id = 1);

insert into public.lot_private_settings (id, data)
select 1, '{}'::jsonb
where not exists (select 1 from public.lot_private_settings where id = 1);
