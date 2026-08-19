-- =============================================================================
-- Coiff'RDV — 0004 : Row Level Security
--
-- Le cloisonnement client / coiffeur est posé DANS la base. Même si quelqu'un
-- récupérait la clé publique de l'application et interrogeait l'API directement,
-- il ne verrait que ses propres rendez-vous.
--
-- Les écritures sur les rendez-vous passent exclusivement par les fonctions
-- request_appointment / decide_appointment / cancel_appointment : aucune
-- politique INSERT ou UPDATE n'est ouverte sur la table, donc aucune écriture
-- directe n'est possible.
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.salons               enable row level security;
alter table public.services             enable row level security;
alter table public.opening_hours        enable row level security;
alter table public.recurring_breaks     enable row level security;
alter table public.time_blocks          enable row level security;
alter table public.appointments         enable row level security;
alter table public.notifications_outbox enable row level security;

-- ---------- profiles ----------
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());

-- Le coiffeur voit la fiche des clients qui ont un rendez-vous chez lui — et
-- uniquement ceux-là.
drop policy if exists profiles_select_by_barber on public.profiles;
create policy profiles_select_by_barber on public.profiles
  for select using (
    exists (
      select 1
        from public.appointments a
        join public.salons s on s.id = a.salon_id
       where a.client_id = profiles.id
         and s.owner_id  = auth.uid()
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------- salons (vitrine publique) ----------
drop policy if exists salons_select_all on public.salons;
create policy salons_select_all on public.salons for select using (true);

drop policy if exists salons_write_owner on public.salons;
create policy salons_write_owner on public.salons
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------- services ----------
drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select using (active or public.is_salon_owner(salon_id));

drop policy if exists services_write_owner on public.services;
create policy services_write_owner on public.services
  for all using (public.is_salon_owner(salon_id))
  with check (public.is_salon_owner(salon_id));

-- ---------- horaires, pauses, blocages ----------
-- Lecture ouverte : le client doit pouvoir afficher les créneaux barrés.
drop policy if exists opening_hours_select on public.opening_hours;
create policy opening_hours_select on public.opening_hours for select using (true);
drop policy if exists opening_hours_write on public.opening_hours;
create policy opening_hours_write on public.opening_hours
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

drop policy if exists recurring_breaks_select on public.recurring_breaks;
create policy recurring_breaks_select on public.recurring_breaks for select using (true);
drop policy if exists recurring_breaks_write on public.recurring_breaks;
create policy recurring_breaks_write on public.recurring_breaks
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

drop policy if exists time_blocks_select on public.time_blocks;
create policy time_blocks_select on public.time_blocks for select using (true);
drop policy if exists time_blocks_write on public.time_blocks;
create policy time_blocks_write on public.time_blocks
  for all using (public.is_salon_owner(salon_id)) with check (public.is_salon_owner(salon_id));

-- ---------- appointments ----------
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments
  for select using (client_id = auth.uid() or public.is_salon_owner(salon_id));
-- Volontairement : aucune policy insert/update/delete. Tout passe par les RPC.

-- ---------- outbox ----------
drop policy if exists outbox_select_own on public.notifications_outbox;
create policy outbox_select_own on public.notifications_outbox
  for select using (recipient_id = auth.uid());

-- ---------- droits d'exécution ----------
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated, anon;
    grant select on public.salons, public.services, public.opening_hours,
                    public.recurring_breaks, public.time_blocks to anon, authenticated;
    grant select on public.profiles, public.appointments, public.notifications_outbox to authenticated;
    grant execute on function public.available_slots(uuid, date)                 to anon, authenticated;
    grant execute on function public.request_appointment(uuid, timestamptz, text) to authenticated;
    grant execute on function public.decide_appointment(uuid, boolean, text)      to authenticated;
    grant execute on function public.cancel_appointment(uuid, text)               to authenticated;
  end if;
end $$;
