-- Final position snippets for analytics (see logDebate.js)
alter table public.debates
  add column if not exists final_position_a text,
  add column if not exists final_position_b text,
  add column if not exists final_position_c text;
