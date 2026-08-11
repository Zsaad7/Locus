-- Supabase schema for Locus MVP

-- Enums
create type user_role as enum ('responsable','salarie');
create type work_shift as enum ('matin','apres_midi','nuit');

-- Stations
create table stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  allowed_ip text,
  created_at timestamptz default now()
);

-- Profiles (linked to auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade,
  full_name text,
  role user_role default 'salarie',
  shift work_shift,
  points int default 0,
  station_id uuid references stations(id),
  created_at timestamptz default now(),
  primary key (id)
);

-- Attendance
create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  clock_in timestamptz default now(),
  clock_out timestamptz
);

-- Warnings
create table warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  reason text,
  severity text default 'info',
  created_at timestamptz default now()
);

-- Tasks
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scope text default 'common',
  shift work_shift,
  station_id uuid references stations(id),
  created_at timestamptz default now()
);

-- Task completions
create table task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  completed_at timestamptz default now(),
  unique (task_id, user_id)
);

-- Trigger: create profile on auth.users insert
create function public.create_profile_on_signup() returns trigger as $$
begin
  insert into profiles(id, full_name, role, created_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'salarie', now());
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_on_signup();

-- RLS helper
create function public.is_responsable() returns boolean as $$
begin
  return exists(select 1 from profiles p where p.id = auth.uid() and p.role = 'responsable');
end;
$$ language plpgsql security definer;

-- Enable RLS and policies
alter table profiles enable row level security;
create policy "profiles_self" on profiles
  for select, update using (id = auth.uid());

alter table stations enable row level security;
create policy "stations_select_auth" on stations
  for select using (auth.role() is not null);
create policy "stations_update_responsable" on stations
  for update using (public.is_responsable());

alter table attendance enable row level security;
create policy "attendance_self" on attendance
  for select, insert, update using (user_id = (select id from profiles where id = auth.uid()));

alter table warnings enable row level security;
create policy "warnings_self" on warnings
  for select using (user_id = (select id from profiles where id = auth.uid()));
create policy "warnings_insert_responsable" on warnings
  for insert using (public.is_responsable());

alter table tasks enable row level security;
create policy "tasks_select_auth" on tasks
  for select using (auth.role() is not null);
create policy "tasks_manage_responsable" on tasks
  for insert, update, delete using (public.is_responsable());

alter table task_completions enable row level security;
create policy "task_completions_self" on task_completions
  for select, insert, delete using (user_id = (select id from profiles where id = auth.uid()));

-- Seed station and tasks
insert into stations (id, name, allowed_ip) values (gen_random_uuid(), 'Station Test', null);

-- Fetch station id
with s as (select id from stations limit 1)
insert into tasks (title, scope, shift, station_id) values
('Ouvrir caisse', 'common', null, (select id from s)),
('Fermer caisse', 'common', null, (select id from s)),
('Remplir carburant', 'specific', 'matin', (select id from s)),
('Nettoyage pompe', 'specific', 'apres_midi', (select id from s)),
('Vérifier stocks', 'specific', 'nuit', (select id from s));
