-- Run this once in Supabase (SQL editor)
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text default 'user',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on profiles for select using (auth.uid() = id);

create table if not exists public.commesse (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  cliente text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.commesse enable row level security;
create policy "commesse read" on commesse for select using (auth.role() = 'authenticated');
create policy "commesse insert" on commesse for insert with check (auth.role() = 'authenticated');
create policy "commesse update" on commesse for update using (auth.role() = 'authenticated');
create policy "commesse delete" on commesse for delete using (auth.role() = 'authenticated');

create table if not exists public.posizioni (
  id uuid primary key default gen_random_uuid(),
  commessa_id uuid not null references public.commesse(id) on delete cascade,
  name text not null,
  valore numeric,
  created_at timestamptz default now()
);
alter table public.posizioni enable row level security;
create policy "posizioni all" on posizioni for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table if not exists public.rapportini (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data date not null,
  ore numeric not null,
  descrizione text,
  stato text default 'inviato',
  commessa_id uuid references public.commesse(id) on delete set null,
  posizione_id uuid references public.posizioni(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.rapportini enable row level security;
create policy "report read own or manager" on rapportini for select using (
  auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role='manager')
);
create policy "report insert own" on rapportini for insert with check (user_id = auth.uid());
create policy "report update own or manager" on rapportini for update using (
  auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role='manager')
);
create policy "report delete own or manager" on rapportini for delete using (
  auth.uid() = user_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role='manager')
);

create table if not exists public.app_state (
  key text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table public.app_state enable row level security;
create policy "state rw" on app_state for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists app_state_touch on public.app_state;
create trigger app_state_touch before update on public.app_state for each row execute function public.touch_updated_at();
