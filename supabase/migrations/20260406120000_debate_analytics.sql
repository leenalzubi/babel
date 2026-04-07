-- Analytics columns for analyseDebate() / Findings "Agent Dynamics"
alter table public.debates
  add column if not exists response_length_a integer,
  add column if not exists response_length_b integer,
  add column if not exists response_length_c integer,
  add column if not exists conflict_score_ab double precision,
  add column if not exists conflict_score_ac double precision,
  add column if not exists conflict_score_bc double precision,
  add column if not exists named_references_a boolean,
  add column if not exists named_references_b boolean,
  add column if not exists named_references_c boolean,
  add column if not exists challenged_most text,
  add column if not exists synthesis_overlap_a double precision,
  add column if not exists synthesis_overlap_b double precision,
  add column if not exists synthesis_overlap_c double precision,
  add column if not exists dominant_agent text;
