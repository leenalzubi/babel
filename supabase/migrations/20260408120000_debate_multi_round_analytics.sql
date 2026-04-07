-- Multi-round debate analytics (rebuttals / concessions / combative-flexible roles)
alter table public.debates
  add column if not exists concession_count integer,
  add column if not exists held_firm_count integer,
  add column if not exists most_combative text,
  add column if not exists most_flexible text;
