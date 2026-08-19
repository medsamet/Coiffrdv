-- =============================================================================
-- Coiff'RDV — 0002 : tables
--
-- Montants : stockés en MILLIMES (1 dinar tunisien = 1000 millimes), en entier.
-- Aucun flottant ne touche à de l'argent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles : miroir applicatif de auth.users
-- L'identifiant de connexion est l'email OU le téléphone (Supabase Auth gère les
-- deux ; au moins l'un des deux est toujours renseigné, cf. la contrainte).
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            public.app_role not null default 'client',
  full_name       text not null default '',
  email           text,
  phone           text,
  -- canal par défaut pour les notifications, déduit de l'identifiant d'inscription
  notify_channel  public.notify_channel not null default 'email',
  created_at      timestamptz not null default now(),
  constraint profiles_identity_present check (email is not null or phone is not null),
  constraint profiles_channel_reachable check (
    (notify_channel = 'email' and email is not null) or
    (notify_channel = 'sms'   and phone is not null)
  )
);

create unique index if not exists profiles_email_key on public.profiles (lower(email)) where email is not null;
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;

-- -----------------------------------------------------------------------------
-- salons
-- -----------------------------------------------------------------------------
create table if not exists public.salons (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null unique references public.profiles(id) on delete cascade,
  name                     text not null,
  address                  text not null default '',
  phone                    text,
  timezone                 text not null default 'Africa/Tunis',
  currency                 text not null default 'TND',
  -- règles de réservation (écran « Disponibilités » du back-office)
  booking_horizon_days     int  not null default 60  check (booking_horizon_days between 1 and 365),
  min_lead_minutes         int  not null default 120 check (min_lead_minutes >= 0),
  cancel_deadline_minutes  int  not null default 120 check (cancel_deadline_minutes >= 0),
  slot_step_minutes        int  not null default 15  check (slot_step_minutes between 5 and 60),
  auto_confirm_regulars    boolean not null default false,
  created_at               timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- services : les 4 prestations. Durée ET tarif fixés par le coiffeur.
-- -----------------------------------------------------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons(id) on delete cascade,
  kind             public.service_kind not null,
  name             text not null,
  description      text not null default '',
  duration_minutes int  not null check (duration_minutes between 5 and 480),
  -- marge de remise en état après la prestation : occupe l'agenda mais n'est pas facturée
  cleanup_minutes  int  not null default 0 check (cleanup_minutes between 0 and 120),
  price_millimes   int  not null check (price_millimes >= 0),
  active           boolean not null default true,
  position         int not null default 0,
  unique (salon_id, kind)
);

-- -----------------------------------------------------------------------------
-- opening_hours : horaires hebdomadaires. weekday 0 = dimanche … 6 = samedi
-- (même convention que extract(dow) en PostgreSQL).
-- -----------------------------------------------------------------------------
create table if not exists public.opening_hours (
  id        uuid primary key default gen_random_uuid(),
  salon_id  uuid not null references public.salons(id) on delete cascade,
  weekday   int  not null check (weekday between 0 and 6),
  is_open   boolean not null default true,
  opens_at  time not null default '09:00',
  closes_at time not null default '19:00',
  unique (salon_id, weekday),
  constraint opening_hours_ordered check (closes_at > opens_at)
);

-- -----------------------------------------------------------------------------
-- recurring_breaks : pauses répétées (déjeuner…). weekday null = tous les jours ouverts.
-- -----------------------------------------------------------------------------
create table if not exists public.recurring_breaks (
  id        uuid primary key default gen_random_uuid(),
  salon_id  uuid not null references public.salons(id) on delete cascade,
  weekday   int check (weekday between 0 and 6),
  label     text not null default 'Pause',
  starts_at time not null,
  ends_at   time not null,
  constraint recurring_breaks_ordered check (ends_at > starts_at)
);

-- -----------------------------------------------------------------------------
-- time_blocks : blocages ponctuels posés par le coiffeur (congés, formation,
-- « je ferme cet après-midi »). Peuvent se chevaucher entre eux, sans importance.
-- -----------------------------------------------------------------------------
create table if not exists public.time_blocks (
  id         uuid primary key default gen_random_uuid(),
  salon_id   uuid not null references public.salons(id) on delete cascade,
  during     tstzrange not null,
  reason     public.block_reason not null default 'other',
  label      text not null default '',
  created_at timestamptz not null default now(),
  constraint time_blocks_bounded check (
    not isempty(during) and lower_inf(during) is false and upper_inf(during) is false
  )
);
create index if not exists time_blocks_salon_during_idx
  on public.time_blocks using gist (salon_id, during);

-- -----------------------------------------------------------------------------
-- appointments
--
-- `during` couvre la durée facturée + la marge de nettoyage : c'est l'occupation
-- réelle de l'agenda. L'heure de fin montrée au client est starts_at + duration.
-- -----------------------------------------------------------------------------
create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons(id) on delete cascade,
  client_id        uuid not null references public.profiles(id) on delete cascade,
  service_id       uuid not null references public.services(id) on delete restrict,

  starts_at        timestamptz not null,
  -- instantanés pris au moment de la demande : si le coiffeur change son tarif
  -- demain, le rendez-vous déjà pris garde le prix annoncé au client.
  duration_minutes int not null check (duration_minutes > 0),
  cleanup_minutes  int not null default 0 check (cleanup_minutes >= 0),
  price_millimes   int not null check (price_millimes >= 0),
  service_kind     public.service_kind not null,

  -- Occupation réelle de l'agenda. Toujours recalculée par le trigger ci-dessous :
  -- impossible de la désynchroniser de starts_at / duration / cleanup, même par
  -- une écriture directe en base.
  -- (Une colonne générée serait plus élégante, mais « timestamptz + interval »
  --  n'est pas immutable en PostgreSQL — le fuseau peut changer le résultat.)
  during           tstzrange not null default tstzrange(now(), now(), '[)'),

  status           public.appointment_status not null default 'pending',
  client_note      text not null default '',
  decision_reason  text not null default '',   -- motif de refus, transmis au client
  cancel_reason    text not null default '',

  requested_at     timestamptz not null default now(),
  decided_at       timestamptz,
  cancelled_at     timestamptz
);

create or replace function public.appointments_set_during()
returns trigger language plpgsql as $$
begin
  new.during := tstzrange(
    new.starts_at,
    new.starts_at + make_interval(mins => new.duration_minutes + new.cleanup_minutes),
    '[)');
  return new;
end $$;

drop trigger if exists appointments_during on public.appointments;
create trigger appointments_during
  before insert or update of starts_at, duration_minutes, cleanup_minutes
  on public.appointments
  for each row execute function public.appointments_set_during();

-- ⭐ LA règle qui rend la double réservation impossible.
-- Deux rendez-vous CONFIRMÉS du même salon ne peuvent pas se chevaucher, même si
-- deux clients cliquent à la même milliseconde : c'est le moteur qui refuse.
-- Les demandes « pending » peuvent, elles, se chevaucher — c'est justement le
-- conflit que le coiffeur arbitre depuis son écran de validation.
alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments add constraint appointments_no_overlap
  exclude using gist (salon_id with =, during with &&)
  where (status = 'confirmed');

create index if not exists appointments_client_idx on public.appointments (client_id, starts_at desc);
create index if not exists appointments_salon_idx  on public.appointments (salon_id, starts_at);
create index if not exists appointments_pending_idx on public.appointments (salon_id, requested_at)
  where status = 'pending';

-- -----------------------------------------------------------------------------
-- notifications_outbox : on n'envoie jamais un email/SMS depuis une transaction
-- métier. On dépose une ligne ici ; un worker (Edge Function planifiée) la relève,
-- l'envoie et l'horodate. Rejouable, traçable, testable.
-- -----------------------------------------------------------------------------
create table if not exists public.notifications_outbox (
  id             bigint generated always as identity primary key,
  appointment_id uuid references public.appointments(id) on delete cascade,
  recipient_id   uuid not null references public.profiles(id) on delete cascade,
  channel        public.notify_channel not null,
  kind           public.notify_kind not null,
  destination    text not null,           -- email ou numéro, figé à l'insertion
  payload        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  send_after     timestamptz not null default now(),
  sent_at        timestamptz,
  attempts       int not null default 0,
  last_error     text
);
create index if not exists notifications_pending_idx
  on public.notifications_outbox (send_after)
  where sent_at is null;
