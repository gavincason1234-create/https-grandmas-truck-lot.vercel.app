-- Owner can tidy a finished stay off the Tonight list without losing the money it earned.
alter table public.bookings add column if not exists hidden boolean not null default false;

-- The website reads settings through the server (service role); nobody needs to read the
-- owner's overhead numbers straight from the database, so drop the anonymous read.
drop policy if exists "settings: public read" on public.lot_settings;
