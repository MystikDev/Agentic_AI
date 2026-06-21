-- FitCoach Phase 2: medication & supplement tracking.
-- A medication is a thing the user takes (med or supplement); an intake is a
-- logged dose. Run after 0003_meals.sql.

create table if not exists public.medications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  kind       text not null default 'supplement' check (kind in ('medication','supplement')),
  dosage     text,        -- e.g. "500 mg", "2 capsules"
  schedule   text,        -- free-text for now, e.g. "Daily, morning"
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists medications_user_idx on public.medications(user_id, active);

create table if not exists public.medication_intakes (
  id            uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists medication_intakes_idx
  on public.medication_intakes(user_id, medication_id, taken_at desc);

alter table public.medications        enable row level security;
alter table public.medication_intakes enable row level security;

drop policy if exists "own medications" on public.medications;
create policy "own medications" on public.medications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own medication intakes" on public.medication_intakes;
create policy "own medication intakes" on public.medication_intakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
