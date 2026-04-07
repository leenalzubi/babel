alter table debates
  add column if not exists is_partial boolean default false,
  add column if not exists timeout_count int default 0,
  add column if not exists last_completed_stage text;
