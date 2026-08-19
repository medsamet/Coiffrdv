-- =============================================================================
-- Coiff'RDV — 0003 : logique métier
--
-- Tout ce qui décide (créneau libre ? demande acceptable ? annulation dans les
-- délais ?) vit ici, dans la base. L'application mobile et l'application web
-- appellent les mêmes fonctions : une seule vérité, impossible à contourner
-- depuis un client modifié.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_salon_owner(p_salon_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.salons s where s.id = p_salon_id and s.owner_id = auth.uid());
$$;

-- Combine une date locale et une heure locale en instant absolu, dans le fuseau
-- du salon. Écrit une fois, utilisé partout : c'est là que se cachent d'habitude
-- les bugs de changement d'heure.
create or replace function public.local_ts(p_day date, p_time time, p_tz text)
returns timestamptz
language sql immutable as $$
  select ((p_day + p_time) at time zone p_tz);
$$;

-- -----------------------------------------------------------------------------
-- available_slots : LA fonction que consulte le client.
--
-- Part des horaires d'ouverture du jour, retire les pauses récurrentes, les
-- blocages posés par le coiffeur, les rendez-vous déjà confirmés, et le délai
-- minimum avant réservation. Le pas de la grille et la longueur du créneau
-- viennent tous deux des réglages du coiffeur.
-- -----------------------------------------------------------------------------
create or replace function public.available_slots(p_service_id uuid, p_day date)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_service   public.services%rowtype;
  v_salon     public.salons%rowtype;
  v_hours     public.opening_hours%rowtype;
  v_occupancy interval;
  v_step      interval;
  v_open_at   timestamptz;
  v_close_at  timestamptz;
  v_earliest  timestamptz;
  v_horizon   timestamptz;
  v_cursor    timestamptz;
  v_range     tstzrange;
begin
  select * into v_service from public.services where id = p_service_id and active;
  if not found then return; end if;

  select * into v_salon from public.salons where id = v_service.salon_id;
  if not found then return; end if;

  select * into v_hours
    from public.opening_hours
   where salon_id = v_salon.id
     and weekday  = extract(dow from p_day)::int
     and is_open;
  if not found then return; end if;   -- salon fermé ce jour-là

  v_occupancy := make_interval(mins => v_service.duration_minutes + v_service.cleanup_minutes);
  v_step      := make_interval(mins => v_salon.slot_step_minutes);
  v_open_at   := public.local_ts(p_day, v_hours.opens_at,  v_salon.timezone);
  v_close_at  := public.local_ts(p_day, v_hours.closes_at, v_salon.timezone);
  v_earliest  := now() + make_interval(mins => v_salon.min_lead_minutes);
  v_horizon   := now() + make_interval(days => v_salon.booking_horizon_days);

  v_cursor := v_open_at;
  while v_cursor + v_occupancy <= v_close_at loop
    v_range := tstzrange(v_cursor, v_cursor + v_occupancy, '[)');

    if v_cursor >= v_earliest
       and v_cursor <= v_horizon
       and not exists (
             select 1 from public.recurring_breaks b
              where b.salon_id = v_salon.id
                and (b.weekday is null or b.weekday = extract(dow from p_day)::int)
                and v_range && tstzrange(
                      public.local_ts(p_day, b.starts_at, v_salon.timezone),
                      public.local_ts(p_day, b.ends_at,   v_salon.timezone), '[)'))
       and not exists (
             select 1 from public.time_blocks t
              where t.salon_id = v_salon.id and t.during && v_range)
       and not exists (
             select 1 from public.appointments a
              where a.salon_id = v_salon.id
                and a.status = 'confirmed'
                and a.during && v_range)
    then
      slot_start := v_cursor;
      slot_end   := v_cursor + make_interval(mins => v_service.duration_minutes);
      return next;
    end if;

    v_cursor := v_cursor + v_step;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- request_appointment : le client envoie une DEMANDE (jamais une réservation
-- ferme). Revalide le créneau côté serveur — ne jamais croire le client.
-- -----------------------------------------------------------------------------
create or replace function public.request_appointment(
  p_service_id uuid,
  p_start      timestamptz,
  p_note       text default ''
) returns public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_service public.services%rowtype;
  v_salon   public.salons%rowtype;
  v_client  public.profiles%rowtype;
  v_day     date;
  v_row     public.appointments%rowtype;
  v_auto    boolean := false;
begin
  select * into v_client from public.profiles where id = auth.uid();
  if not found then
    raise exception 'AUTH_REQUIRED' using hint = 'Connectez-vous pour demander un rendez-vous.';
  end if;
  if v_client.role <> 'client' then
    raise exception 'CLIENT_ONLY' using hint = 'Le compte coiffeur ne réserve pas pour lui-même.';
  end if;

  select * into v_service from public.services where id = p_service_id and active;
  if not found then
    raise exception 'SERVICE_UNAVAILABLE' using hint = 'Cette prestation n''est plus proposée.';
  end if;
  select * into v_salon from public.salons where id = v_service.salon_id;

  v_day := (p_start at time zone v_salon.timezone)::date;

  -- Le créneau demandé doit figurer, à la seconde près, dans la liste calculée
  -- par le serveur.
  if not exists (
        select 1 from public.available_slots(p_service_id, v_day) s
         where s.slot_start = p_start) then
    raise exception 'SLOT_UNAVAILABLE'
      using hint = 'Ce créneau vient d''être pris ou n''est plus proposé.';
  end if;

  -- Un client ne peut pas empiler deux demandes en attente sur le même horaire.
  if exists (
        select 1 from public.appointments a
         where a.client_id = v_client.id
           and a.status in ('pending', 'confirmed')
           and a.during && tstzrange(p_start,
                 p_start + make_interval(mins => v_service.duration_minutes
                                              + v_service.cleanup_minutes), '[)')) then
    raise exception 'CLIENT_DOUBLE_BOOKING'
      using hint = 'Vous avez déjà un rendez-vous sur ce créneau.';
  end if;

  -- Validation automatique des habitués, si le coiffeur l'a activée.
  if v_salon.auto_confirm_regulars then
    select count(*) filter (where status = 'completed') >= 3
       and count(*) filter (where status = 'cancelled_by_client'
                              and cancelled_at > starts_at - make_interval(mins => v_salon.cancel_deadline_minutes)) = 0
      into v_auto
      from public.appointments where client_id = v_client.id and salon_id = v_salon.id;
  end if;

  insert into public.appointments (
    salon_id, client_id, service_id, starts_at,
    duration_minutes, cleanup_minutes, price_millimes, service_kind,
    status, client_note, decided_at
  ) values (
    v_salon.id, v_client.id, v_service.id, p_start,
    v_service.duration_minutes, v_service.cleanup_minutes, v_service.price_millimes, v_service.kind,
    case when v_auto then 'confirmed' else 'pending' end::public.appointment_status,
    coalesce(p_note, ''),
    case when v_auto then now() end
  )
  returning * into v_row;

  return v_row;
end $$;

-- -----------------------------------------------------------------------------
-- decide_appointment : le coiffeur valide ou refuse.
-- Valider refuse automatiquement les demandes concurrentes sur le même créneau.
-- -----------------------------------------------------------------------------
create or replace function public.decide_appointment(
  p_appointment_id uuid,
  p_approve        boolean,
  p_reason         text default ''
) returns public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row public.appointments%rowtype;
begin
  select * into v_row from public.appointments where id = p_appointment_id;
  if not found then raise exception 'NOT_FOUND'; end if;

  if not public.is_salon_owner(v_row.salon_id) then
    raise exception 'FORBIDDEN' using hint = 'Seul le coiffeur décide des demandes.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'ALREADY_DECIDED' using hint = 'Cette demande a déjà été traitée.';
  end if;

  if p_approve then
    begin
      update public.appointments
         set status = 'confirmed', decided_at = now(), decision_reason = ''
       where id = p_appointment_id
       returning * into v_row;
    exception when exclusion_violation then
      -- La contrainte d'exclusion a parlé : un autre rendez-vous confirmé occupe
      -- déjà la plage. On remonte un message exploitable plutôt qu'une erreur SQL.
      raise exception 'SLOT_TAKEN'
        using hint = 'Un rendez-vous confirmé occupe déjà ce créneau.';
    end;

    -- Refus automatique des demandes en attente qui chevauchent celle-ci.
    update public.appointments a
       set status = 'rejected',
           decided_at = now(),
           decision_reason = 'Créneau attribué à une autre demande.'
     where a.salon_id = v_row.salon_id
       and a.status = 'pending'
       and a.id <> v_row.id
       and a.during && v_row.during;
  else
    update public.appointments
       set status = 'rejected', decided_at = now(), decision_reason = coalesce(p_reason, '')
     where id = p_appointment_id
     returning * into v_row;
  end if;

  return v_row;
end $$;

-- -----------------------------------------------------------------------------
-- cancel_appointment : le client annule (dans le délai autorisé) ou le coiffeur
-- annule (sans limite de délai, mais le client est prévenu).
-- -----------------------------------------------------------------------------
create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason         text default ''
) returns public.appointments
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row      public.appointments%rowtype;
  v_salon    public.salons%rowtype;
  v_is_owner boolean;
begin
  select * into v_row from public.appointments where id = p_appointment_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_salon from public.salons where id = v_row.salon_id;

  v_is_owner := public.is_salon_owner(v_row.salon_id);

  if not v_is_owner and v_row.client_id <> auth.uid() then
    raise exception 'FORBIDDEN';
  end if;
  if v_row.status not in ('pending', 'confirmed') then
    raise exception 'NOT_CANCELLABLE' using hint = 'Ce rendez-vous n''est plus annulable.';
  end if;

  -- Le délai ne s'applique qu'au client, et seulement à un rendez-vous confirmé :
  -- une demande encore en attente peut être retirée à tout moment.
  if not v_is_owner
     and v_row.status = 'confirmed'
     and now() > v_row.starts_at - make_interval(mins => v_salon.cancel_deadline_minutes) then
    raise exception 'CANCEL_DEADLINE_PASSED'
      using hint = format('L''annulation n''est plus possible moins de %s minutes avant le rendez-vous.',
                          v_salon.cancel_deadline_minutes);
  end if;

  update public.appointments
     set status = case when v_is_owner then 'cancelled_by_barber'
                       else 'cancelled_by_client' end::public.appointment_status,
         cancelled_at = now(),
         cancel_reason = coalesce(p_reason, '')
   where id = p_appointment_id
   returning * into v_row;

  return v_row;
end $$;

-- -----------------------------------------------------------------------------
-- Notifications : un changement de statut dépose une ligne dans l'outbox.
-- Le canal suit l'identifiant du compte (email ou SMS).
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_notification(
  p_appointment public.appointments,
  p_recipient   uuid,
  p_kind        public.notify_kind,
  p_send_after  timestamptz default now()
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_p    public.profiles%rowtype;
  v_dest text;
begin
  select * into v_p from public.profiles where id = p_recipient;
  if not found then return; end if;

  v_dest := case when v_p.notify_channel = 'sms' then v_p.phone else v_p.email end;
  if v_dest is null then return; end if;

  insert into public.notifications_outbox
    (appointment_id, recipient_id, channel, kind, destination, send_after, payload)
  values
    (p_appointment.id, p_recipient, v_p.notify_channel, p_kind, v_dest, p_send_after,
     jsonb_build_object(
       'starts_at',        p_appointment.starts_at,
       'duration_minutes', p_appointment.duration_minutes,
       'price_millimes',   p_appointment.price_millimes,
       'service_kind',     p_appointment.service_kind,
       'reason',           coalesce(nullif(p_appointment.decision_reason, ''),
                                    nullif(p_appointment.cancel_reason, ''))
     ));
end $$;

create or replace function public.on_appointment_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.salons where id = new.salon_id;

  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.enqueue_notification(new, new.client_id, 'request_received');
      perform public.enqueue_notification(new, v_owner,       'new_request_for_barber');
    elsif new.status = 'confirmed' then
      perform public.enqueue_notification(new, new.client_id, 'request_approved');
      perform public.enqueue_notification(new, new.client_id, 'reminder_24h',
                                          new.starts_at - interval '24 hours');
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'confirmed' then
        perform public.enqueue_notification(new, new.client_id, 'request_approved');
        perform public.enqueue_notification(new, new.client_id, 'reminder_24h',
                                            new.starts_at - interval '24 hours');
      when 'rejected' then
        perform public.enqueue_notification(new, new.client_id, 'request_rejected');
        delete from public.notifications_outbox
         where appointment_id = new.id and kind = 'reminder_24h' and sent_at is null;
      when 'cancelled_by_client' then
        perform public.enqueue_notification(new, v_owner, 'cancelled');
        delete from public.notifications_outbox
         where appointment_id = new.id and kind = 'reminder_24h' and sent_at is null;
      when 'cancelled_by_barber' then
        perform public.enqueue_notification(new, new.client_id, 'cancelled');
        delete from public.notifications_outbox
         where appointment_id = new.id and kind = 'reminder_24h' and sent_at is null;
      else null;
    end case;
  end if;

  return new;
end $$;

drop trigger if exists appointments_notify on public.appointments;
create trigger appointments_notify
  after insert or update on public.appointments
  for each row execute function public.on_appointment_change();

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (email OU téléphone).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, role, full_name, email, phone, notify_channel)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'client'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.phone,
    case when new.email is not null then 'email' else 'sms' end::public.notify_channel
  )
  on conflict (id) do nothing;
  return new;
end $$;
