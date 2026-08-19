-- =============================================================================
-- Coiff'RDV — 0001 : extensions et types
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "btree_gist"; -- indispensable : permet la contrainte
                                             -- d'exclusion (salon_id =, plage &&)

-- Rôle applicatif. Un compte est soit un client, soit le coiffeur.
do $$ begin
  create type public.app_role as enum ('client', 'barber');
exception when duplicate_object then null; end $$;

-- Les 4 types de prestation demandés. L'enum verrouille le domaine métier ;
-- le libellé, la durée et le prix restent paramétrables par le coiffeur.
do $$ begin
  create type public.service_kind as enum ('beard', 'hair', 'beard_hair', 'kids');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum (
    'pending',              -- demande envoyée, en attente du coiffeur
    'confirmed',            -- validée par le coiffeur
    'rejected',             -- refusée par le coiffeur
    'cancelled_by_client',
    'cancelled_by_barber',
    'completed',
    'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.block_reason as enum ('break', 'holiday', 'training', 'other');
exception when duplicate_object then null; end $$;

-- Canal de notification : découle de l'identifiant utilisé à l'inscription.
do $$ begin
  create type public.notify_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notify_kind as enum (
    'request_received',   -- accusé de réception au client
    'request_approved',
    'request_rejected',
    'cancelled',
    'reminder_24h',
    'new_request_for_barber'
  );
exception when duplicate_object then null; end $$;
