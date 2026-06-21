-- FitCoach initial schema: profiles, conversations, messages.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) for your project.
--
-- The FitCoach backend talks to these tables with the service-role key, which
-- BYPASSES row-level security, and scopes every query by user_id itself. RLS is
-- still enabled below as defense-in-depth so that the public anon key (shipped in
-- the app) can never read or write another user's rows directly.

create extension if not exists "pgcrypto";

-- One profile per auth user.
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  name             text,
  experience_level text check (experience_level in ('beginner','intermediate','advanced')),
  goals            text[] not null default '{}',
  constraints      text[] not null default '{}',
  updated_at       timestamptz not null default now()
);

create table if not exists public.conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  intensity  int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);

-- Row-level security: each user can only touch their own rows.
alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
