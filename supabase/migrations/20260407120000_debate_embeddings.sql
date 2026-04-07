-- Requires pgvector. Run in Supabase SQL Editor if extension is not already enabled:
-- create extension if not exists vector;

alter table public.debates
  add column if not exists embedding_a vector(1536),
  add column if not exists embedding_b vector(1536),
  add column if not exists embedding_c vector(1536);
