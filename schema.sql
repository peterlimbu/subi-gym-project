-- Run this in Supabase SQL editor once to enable cloud sync
create extension if not exists "uuid-ossp";

create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  title text default 'Subi''s Workout Plan from Peter',
  created_at timestamptz default now()
);

create table if not exists entries (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid references plans(id) on delete cascade,
  week smallint not null,              -- 1..6
  day smallint not null,               -- 1..4
  exercise_index smallint not null,    -- 0..4
  exercise text not null,
  goal text not null,                  -- 3×10 .. 3×15
  actual text default '',
  weight text default '',
  status text check (status in ('Amazing','Good','Bad')) default 'Bad',
  updated_at timestamptz default now(),
  unique(plan_id, week, day, exercise_index)
);

alter table plans enable row level security;
alter table entries enable row level security;

create policy "user plans" on plans
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user entries" on entries
  for all using (
    plan_id in (select id from plans where user_id = auth.uid())
  ) with check (
    plan_id in (select id from plans where user_id = auth.uid())
  );
