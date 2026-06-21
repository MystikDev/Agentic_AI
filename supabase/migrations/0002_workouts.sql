-- FitCoach Phase 2: workout logging.
-- A workout is a session (date + optional notes) containing one or more sets.
-- Run after 0001_init.sql.

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  performed_at timestamptz not null default now(),
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists workouts_user_idx on public.workouts(user_id, performed_at desc);

create table if not exists public.workout_sets (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  exercise   text not null,
  weight     numeric,            -- null for bodyweight movements
  reps       integer not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists workout_sets_workout_idx on public.workout_sets(workout_id, position);

alter table public.workouts     enable row level security;
alter table public.workout_sets enable row level security;

drop policy if exists "own workouts" on public.workouts;
create policy "own workouts" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own workout sets" on public.workout_sets;
create policy "own workout sets" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
