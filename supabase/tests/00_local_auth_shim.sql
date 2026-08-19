-- =============================================================================
-- Shim local — UNIQUEMENT pour exécuter les migrations et les tests sur un
-- PostgreSQL nu, sans Supabase.
--
-- En production, Supabase fournit déjà le schéma `auth`, la table `auth.users`,
-- la fonction `auth.uid()` et les rôles `anon` / `authenticated`. Ce fichier
-- n'est JAMAIS appliqué sur un projet Supabase : il ne vit pas dans
-- supabase/migrations/.
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  phone              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Identique au comportement Supabase : lit le « sub » du JWT courant.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$ begin
  create role anon nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated nologin;
exception when duplicate_object then null; end $$;
do $$ begin
  create role api_tester login;
exception when duplicate_object then null; end $$;

grant anon, authenticated to api_tester;
grant usage on schema auth to anon, authenticated;
