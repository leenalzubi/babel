alter table debates
  add column if not exists change_a text,
  add column if not exists change_b text,
  add column if not exists change_c text,
  add column if not exists change_type_a text,
  add column if not exists change_type_b text,
  add column if not exists change_type_c text,
  add column if not exists most_influenced text,
  add column if not exists most_resistant text;
