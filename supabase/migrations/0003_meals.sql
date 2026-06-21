-- FitCoach Phase 2: diet logging.
-- One row per meal entry. Macros are optional — lightweight manual logging, not a
-- food database (we'd integrate an existing nutrition API rather than rebuild one).
-- Run after 0002_workouts.sql.

create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  eaten_at    timestamptz not null default now(),
  description text not null,
  calories    integer,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  created_at  timestamptz not null default now()
);
create index if not exists meals_user_idx on public.meals(user_id, eaten_at desc);

alter table public.meals enable row level security;

drop policy if exists "own meals" on public.meals;
create policy "own meals" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
