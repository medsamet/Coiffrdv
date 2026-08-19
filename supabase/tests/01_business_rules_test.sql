-- =============================================================================
-- Coiff'RDV — tests des règles métier, en SQL pur.
--
-- Chaque bloc pose une situation puis affirme le résultat attendu. Une seule
-- assertion fausse fait échouer tout le script (et donc la CI).
--   psql -f supabase/tests/01_business_rules_test.sql
-- =============================================================================

\set ON_ERROR_STOP on
\timing off

begin;

-- ---------------------------------------------------------------------------
-- Décor : un salon ouvert le jeudi 09:00–19:00, déjeuner 12:00–14:00,
-- grille au quart d'heure, délai minimum 120 min.
-- ---------------------------------------------------------------------------
create temporary table t_ids (k text primary key, v uuid);

do $$
declare
  v_barber  uuid := gen_random_uuid();
  v_karim   uuid := gen_random_uuid();
  v_nadia   uuid := gen_random_uuid();
  v_salon   uuid;
  v_svc     uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_barber, 'coiffeur@coupe-style.tn',
          jsonb_build_object('role', 'barber', 'full_name', 'Coupe & Style'));
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_karim, 'karim.b@exemple.com', jsonb_build_object('full_name', 'Karim Belhadj'));
  -- Nadia s'inscrit par téléphone : pas d'email du tout.
  insert into auth.users (id, phone, raw_user_meta_data)
  values (v_nadia, '+21622456789', jsonb_build_object('full_name', 'Nadia Mansour'));

  insert into public.profiles (id, role, full_name, email, notify_channel)
    values (v_barber, 'barber', 'Coupe & Style', 'coiffeur@coupe-style.tn', 'email');
  insert into public.profiles (id, role, full_name, email, notify_channel)
    values (v_karim, 'client', 'Karim Belhadj', 'karim.b@exemple.com', 'email');
  insert into public.profiles (id, role, full_name, phone, notify_channel)
    values (v_nadia, 'client', 'Nadia Mansour', '+21622456789', 'sms');

  insert into public.salons (owner_id, name, address, timezone, slot_step_minutes,
                             min_lead_minutes, cancel_deadline_minutes)
  values (v_barber, 'Coupe & Style', 'Av. Habib Bourguiba, La Marsa', 'Africa/Tunis', 15, 120, 120)
  returning id into v_salon;

  insert into public.services (salon_id, kind, name, duration_minutes, cleanup_minutes, price_millimes, position)
  values (v_salon, 'beard',      'Barbe',            15, 0,  7000, 1),
         (v_salon, 'hair',       'Cheveux',          30, 5, 15000, 2),
         (v_salon, 'beard_hair', 'Barbe + Cheveux',  45, 5, 20000, 3),
         (v_salon, 'kids',       'Coupe enfant',     20, 0, 10000, 4);

  select id into v_svc from public.services where salon_id = v_salon and kind = 'beard_hair';

  -- Ouvert du mardi au samedi (2..6), fermé dimanche et lundi.
  insert into public.opening_hours (salon_id, weekday, is_open, opens_at, closes_at)
  values (v_salon, 0, false, '09:00', '19:00'),
         (v_salon, 1, false, '09:00', '19:00'),
         (v_salon, 2, true,  '09:00', '19:00'),
         (v_salon, 3, true,  '09:00', '19:00'),
         (v_salon, 4, true,  '09:00', '19:00'),
         (v_salon, 5, true,  '09:00', '20:00'),
         (v_salon, 6, true,  '08:30', '18:00');

  insert into public.recurring_breaks (salon_id, weekday, label, starts_at, ends_at)
  values (v_salon, null, 'Déjeuner', '12:00', '14:00');

  insert into t_ids values ('barber', v_barber), ('karim', v_karim), ('nadia', v_nadia),
                           ('salon', v_salon), ('svc_bh', v_svc);
end $$;

-- Un jeudi confortablement dans le futur (au-delà du délai minimum, en deçà de
-- l'horizon de réservation). Calculé, jamais codé en dur : le test reste vrai
-- quel que soit le jour où on le lance.
create temporary view t_day as
  select (current_date + ((4 - extract(dow from current_date)::int + 7) % 7 + 7))::date as d;

-- ---------------------------------------------------------------------------
-- 1. Génération des créneaux
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc uuid := (select v from t_ids where k = 'svc_bh');
  v_day date := (select d from t_day);
  n int;
begin
  -- « Barbe + Cheveux » = 45 min + 5 min de remise en état = 50 min d'occupation.
  -- De 09:00 à 19:00 au pas de 15 min : 37 départs possibles ; 11 tombent sur le
  -- déjeuner (12:00–14:00). Reste 26.
  select count(*) into n from public.available_slots(v_svc, v_day);
  assert n = 26, format('créneaux attendus 26, obtenus %s', n);

  -- Aucun créneau ne doit chevaucher le déjeuner.
  select count(*) into n
    from public.available_slots(v_svc, v_day) s
   where tstzrange(s.slot_start, s.slot_start + interval '50 minutes', '[)')
      && tstzrange((v_day + time '12:00') at time zone 'Africa/Tunis',
                   (v_day + time '14:00') at time zone 'Africa/Tunis', '[)');
  assert n = 0, format('%s créneaux empiètent sur le déjeuner', n);

  -- Le dernier créneau se termine avant la fermeture.
  select count(*) into n
    from public.available_slots(v_svc, v_day) s
   where s.slot_start + interval '50 minutes'
       > (v_day + time '19:00') at time zone 'Africa/Tunis';
  assert n = 0, format('%s créneaux dépassent l''heure de fermeture', n);

  raise notice 'OK  1. génération des créneaux (26 créneaux, déjeuner et fermeture respectés)';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Jour de fermeture : aucun créneau
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc uuid := (select v from t_ids where k = 'svc_bh');
  v_mon date := (select d + 4 from t_day);  -- le lundi suivant, salon fermé
  n int;
begin
  assert extract(dow from v_mon)::int = 1, 'le jour de contrôle doit être un lundi';
  select count(*) into n from public.available_slots(v_svc, v_mon);
  assert n = 0, format('salon fermé le lundi mais %s créneaux proposés', n);
  raise notice 'OK  2. jour de fermeture : aucun créneau proposé';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Blocage posé par le coiffeur
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_salon uuid := (select v from t_ids where k = 'salon');
  v_day   date := (select d from t_day);
  before_n int; after_n int;
begin
  select count(*) into before_n from public.available_slots(v_svc, v_day);

  insert into public.time_blocks (salon_id, during, reason, label)
  values (v_salon,
          tstzrange((v_day + time '10:00') at time zone 'Africa/Tunis',
                    (v_day + time '11:00') at time zone 'Africa/Tunis', '[)'),
          'other', 'Rendez-vous fournisseur');

  select count(*) into after_n from public.available_slots(v_svc, v_day);
  -- Départs neutralisés : ceux dont la plage de 50 min touche 10:00–11:00,
  -- soit 09:15 → 10:45 = 7 créneaux.
  assert before_n - after_n = 7,
    format('un blocage d''1 h devrait retirer 7 créneaux, il en a retiré %s', before_n - after_n);

  delete from public.time_blocks where salon_id = v_salon;
  raise notice 'OK  3. blocage d''une heure : 7 créneaux retirés, puis restitués';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Demande d'un client, puis validation par le coiffeur
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_day   date := (select d from t_day);
  v_start timestamptz := (v_day + time '11:00') at time zone 'Africa/Tunis';
  v_appt  public.appointments;
  n int;
begin
  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'karim')::text, true);
  v_appt := public.request_appointment(v_svc, v_start, 'Dégradé court sur les côtés');

  assert v_appt.status = 'pending',   'une demande naît « en attente »';
  assert v_appt.price_millimes = 20000, 'le tarif est figé à la demande (20 DT)';
  assert v_appt.duration_minutes = 45,  'la durée est figée à la demande';

  -- Une demande en attente ne bloque PAS le créneau pour les autres :
  -- c'est le coiffeur qui tranche.
  select count(*) into n from public.available_slots(v_svc, v_day) s where s.slot_start = v_start;
  assert n = 1, 'une demande en attente ne doit pas retirer le créneau de la liste';

  -- Le coiffeur valide.
  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'barber')::text, true);
  v_appt := public.decide_appointment(v_appt.id, true);
  assert v_appt.status = 'confirmed', 'après validation, le rendez-vous est confirmé';

  -- Cette fois le créneau disparaît.
  select count(*) into n from public.available_slots(v_svc, v_day) s where s.slot_start = v_start;
  assert n = 0, 'un rendez-vous confirmé doit retirer le créneau de la liste';

  insert into t_ids values ('appt1', v_appt.id);
  raise notice 'OK  4. demande → validation : le créneau ne se libère qu''après décision';
end $$;

-- ---------------------------------------------------------------------------
-- 5. La double réservation est impossible, y compris en concurrence
-- ---------------------------------------------------------------------------
do $$
declare
  v_salon uuid := (select v from t_ids where k = 'salon');
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_day   date := (select d from t_day);
  v_start timestamptz := (v_day + time '11:00') at time zone 'Africa/Tunis';
  caught boolean := false;
begin
  -- Écriture directe en table, en contournant toute la logique applicative :
  -- c'est le moteur lui-même qui doit refuser.
  begin
    insert into public.appointments
      (salon_id, client_id, service_id, starts_at, duration_minutes, cleanup_minutes,
       price_millimes, service_kind, status)
    values (v_salon, (select v from t_ids where k = 'nadia'), v_svc,
            v_start + interval '10 minutes', 45, 5, 20000, 'beard_hair', 'confirmed');
  exception when exclusion_violation then
    caught := true;
  end;
  assert caught, 'la contrainte d''exclusion doit interdire deux confirmés qui se chevauchent';
  raise notice 'OK  5. double réservation refusée par le moteur (contrainte d''exclusion)';
end $$;

-- ---------------------------------------------------------------------------
-- 6. Valider une demande refuse automatiquement les demandes concurrentes
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_day   date := (select d from t_day);
  v_start timestamptz := (v_day + time '15:00') at time zone 'Africa/Tunis';
  a1 public.appointments; a2 public.appointments;
  v_status public.appointment_status;
begin
  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'karim')::text, true);
  a1 := public.request_appointment(v_svc, v_start, '');

  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'nadia')::text, true);
  a2 := public.request_appointment(v_svc, v_start + interval '15 minutes', '');

  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'barber')::text, true);
  perform public.decide_appointment(a1.id, true);

  select status into v_status from public.appointments where id = a2.id;
  assert v_status = 'rejected',
    format('la demande concurrente devrait être refusée, elle est « %s »', v_status);
  raise notice 'OK  6. validation d''une demande → refus automatique des demandes en conflit';
end $$;

-- ---------------------------------------------------------------------------
-- 7. Le serveur ne fait pas confiance au client
-- ---------------------------------------------------------------------------
do $$
declare
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_day   date := (select d from t_day);
  caught text;
begin
  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'nadia')::text, true);

  -- 12:30 tombe en plein déjeuner : le créneau n'existe pas.
  begin
    perform public.request_appointment(v_svc, (v_day + time '12:30') at time zone 'Africa/Tunis', '');
    caught := 'aucune';
  exception when others then caught := sqlerrm;
  end;
  assert caught = 'SLOT_UNAVAILABLE',
    format('réservation pendant la pause : attendu SLOT_UNAVAILABLE, obtenu « %s »', caught);

  -- 11:07 n'est pas sur la grille du quart d'heure.
  begin
    perform public.request_appointment(v_svc, (v_day + time '11:07') at time zone 'Africa/Tunis', '');
    caught := 'aucune';
  exception when others then caught := sqlerrm;
  end;
  assert caught = 'SLOT_UNAVAILABLE',
    format('heure hors grille : attendu SLOT_UNAVAILABLE, obtenu « %s »', caught);

  -- Hier.
  begin
    perform public.request_appointment(v_svc, now() - interval '1 day', '');
    caught := 'aucune';
  exception when others then caught := sqlerrm;
  end;
  assert caught = 'SLOT_UNAVAILABLE',
    format('réservation dans le passé : attendu SLOT_UNAVAILABLE, obtenu « %s »', caught);

  raise notice 'OK  7. créneau hors grille, pendant la pause ou dans le passé : refusé côté serveur';
end $$;

-- ---------------------------------------------------------------------------
-- 8. Annulation : délai respecté côté client, illimité côté coiffeur
-- ---------------------------------------------------------------------------
do $$
declare
  v_salon uuid := (select v from t_ids where k = 'salon');
  v_svc   uuid := (select v from t_ids where k = 'svc_bh');
  v_karim uuid := (select v from t_ids where k = 'karim');
  v_imminent uuid;
  v_row public.appointments;
  caught text;
begin
  -- Rendez-vous confirmé dans 30 minutes (délai d'annulation : 120 minutes).
  insert into public.appointments
    (salon_id, client_id, service_id, starts_at, duration_minutes, cleanup_minutes,
     price_millimes, service_kind, status, decided_at)
  values (v_salon, v_karim, v_svc, now() + interval '30 minutes', 45, 5, 20000, 'beard_hair',
          'confirmed', now())
  returning id into v_imminent;

  perform set_config('request.jwt.claim.sub', v_karim::text, true);
  begin
    perform public.cancel_appointment(v_imminent, 'Empêchement');
    caught := 'aucune';
  exception when others then caught := sqlerrm;
  end;
  assert caught = 'CANCEL_DEADLINE_PASSED',
    format('annulation tardive : attendu CANCEL_DEADLINE_PASSED, obtenu « %s »', caught);

  -- Le coiffeur, lui, peut toujours annuler.
  perform set_config('request.jwt.claim.sub', (select v from t_ids where k = 'barber')::text, true);
  v_row := public.cancel_appointment(v_imminent, 'Panne d''électricité');
  assert v_row.status = 'cancelled_by_barber', 'le coiffeur doit pouvoir annuler sans délai';

  -- Le client peut annuler un rendez-vous lointain.
  perform set_config('request.jwt.claim.sub', v_karim::text, true);
  v_row := public.cancel_appointment((select v from t_ids where k = 'appt1'), 'Report');
  assert v_row.status = 'cancelled_by_client', 'annulation client dans les délais : acceptée';

  raise notice 'OK  8. annulation : délai opposé au client, jamais au coiffeur';
end $$;

-- ---------------------------------------------------------------------------
-- 9. Notifications déposées dans l'outbox, sur le bon canal
-- ---------------------------------------------------------------------------
do $$
declare
  v_karim uuid := (select v from t_ids where k = 'karim');
  v_nadia uuid := (select v from t_ids where k = 'nadia');
  n int;
begin
  select count(*) into n from public.notifications_outbox
   where recipient_id = v_karim and channel = 'email';
  assert n > 0, 'Karim s''est inscrit par email : ses notifications doivent partir par email';

  select count(*) into n from public.notifications_outbox
   where recipient_id = v_karim and channel = 'sms';
  assert n = 0, 'aucun SMS ne doit partir vers un compte email';

  select count(*) into n from public.notifications_outbox
   where recipient_id = v_nadia and channel = 'sms' and destination = '+21622456789';
  assert n > 0, 'Nadia s''est inscrite par téléphone : ses notifications partent par SMS';

  -- Un rappel J-1 est programmé à la validation, et retiré si on annule.
  select count(*) into n from public.notifications_outbox
   where kind = 'reminder_24h' and appointment_id = (select v from t_ids where k = 'appt1');
  assert n = 0, 'le rappel J-1 doit disparaître quand le rendez-vous est annulé';

  raise notice 'OK  9. notifications : canal email/SMS correct, rappel J-1 annulé avec le RDV';
end $$;

-- ---------------------------------------------------------------------------
-- 10. Cloisonnement RLS : un client ne voit que ses rendez-vous
-- ---------------------------------------------------------------------------
do $$
declare
  v_karim  uuid := (select v from t_ids where k = 'karim');
  v_nadia  uuid := (select v from t_ids where k = 'nadia');
  v_barber uuid := (select v from t_ids where k = 'barber');
  n_karim int; n_nadia int; n_barber int; n_total int;
begin
  select count(*) into n_total from public.appointments;

  -- À partir d'ici on interroge la base comme le ferait l'application : avec le
  -- rôle « authenticated », donc soumis aux politiques RLS.
  set local role authenticated;

  perform set_config('request.jwt.claim.sub', v_karim::text, true);
  select count(*) into n_karim from public.appointments;

  perform set_config('request.jwt.claim.sub', v_nadia::text, true);
  select count(*) into n_nadia from public.appointments;

  perform set_config('request.jwt.claim.sub', v_barber::text, true);
  select count(*) into n_barber from public.appointments;

  reset role;

  assert n_karim > 0 and n_karim < n_total,
    format('Karim voit %s rendez-vous sur %s : le cloisonnement ne fonctionne pas', n_karim, n_total);
  assert n_nadia > 0 and n_nadia < n_total,
    format('Nadia voit %s rendez-vous sur %s', n_nadia, n_total);
  assert n_karim + n_nadia = n_total, 'chaque rendez-vous doit appartenir à exactement un client';
  assert n_barber = n_total, 'le coiffeur doit voir tout l''agenda de son salon';

  raise notice 'OK 10. RLS : client cloisonné (% + % = %), coiffeur voit tout',
               n_karim, n_nadia, n_total;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Écriture directe interdite depuis un compte client
-- ---------------------------------------------------------------------------
do $$
declare
  v_karim uuid := (select v from t_ids where k = 'karim');
  caught boolean := false;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_karim::text, true);
  begin
    update public.appointments set status = 'confirmed' where client_id = v_karim;
    -- Sans policy UPDATE, la commande n'échoue pas : elle ne touche 0 ligne.
    -- On vérifie donc qu'aucune ligne n'a bougé.
    if found then caught := false; else caught := true; end if;
  exception when insufficient_privilege then
    caught := true;
  end;
  reset role;
  assert caught, 'un client ne doit jamais pouvoir confirmer son propre rendez-vous';
  raise notice 'OK 11. un client ne peut pas s''auto-confirmer (aucune policy d''écriture)';
end $$;

rollback;

\echo ''
\echo '================================================'
\echo '  11 groupes de règles métier vérifiés — OK'
\echo '================================================'
