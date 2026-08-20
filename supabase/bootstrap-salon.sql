-- =============================================================================
-- Coiff'RDV — CRÉATION DU SALON
--
-- À lancer APRÈS setup.sql, et APRÈS avoir créé le compte du coiffeur dans
-- Supabase → Authentication → Users → Add user.
--
--   ⚠️  UNE SEULE LIGNE À MODIFIER : l'email ci-dessous, à remplacer par celui
--       du compte coiffeur que vous venez de créer.
--
-- Puis : SQL Editor → New query → coller → Run.
-- Le script est idempotent : le relancer met simplement les valeurs à jour.
-- =============================================================================

do $$
declare
  ------------------------------------------------------------------------------
  -- 👇 REMPLACEZ CETTE ADRESSE PAR CELLE DU COMPTE COIFFEUR
  v_email_coiffeur text := 'coiffeur@coupe-style.tn';
  ------------------------------------------------------------------------------

  -- Renseignements du salon — modifiez librement.
  v_nom       text := 'Coupe & Style';
  v_adresse   text := 'Av. Habib Bourguiba, La Marsa';
  v_telephone text := '+21671000000';
  v_fuseau    text := 'Africa/Tunis';

  v_barber uuid;
  v_salon  uuid;
begin
  ------------------------------------------------------------------------------
  -- 1. Retrouver le compte, et expliquer clairement s'il n'existe pas.
  ------------------------------------------------------------------------------
  select id into v_barber
    from public.profiles
   where lower(email) = lower(v_email_coiffeur);

  if v_barber is null then
    -- Le compte existe peut-être dans auth.users sans profil : cela veut dire
    -- que le trigger on_auth_user_created n'était pas encore en place quand le
    -- compte a été créé. On rattrape le coup ici.
    insert into public.profiles (id, role, full_name, email, phone, notify_channel)
    select u.id, 'client',
           coalesce(u.raw_user_meta_data ->> 'full_name', ''),
           u.email, u.phone,
           case when u.email is not null then 'email' else 'sms' end::public.notify_channel
      from auth.users u
     where lower(u.email) = lower(v_email_coiffeur)
    on conflict (id) do nothing;

    select id into v_barber
      from public.profiles
     where lower(email) = lower(v_email_coiffeur);
  end if;

  if v_barber is null then
    raise exception E'\n\n  Aucun compte trouvé pour « % ».\n\n'
                    '  Créez-le d''abord : Supabase → Authentication → Users → Add user,\n'
                    '  en cochant « Auto Confirm User ». Puis relancez ce script.\n',
                    v_email_coiffeur;
  end if;

  ------------------------------------------------------------------------------
  -- 2. Ce compte devient le coiffeur.
  ------------------------------------------------------------------------------
  update public.profiles
     set role = 'barber',
         full_name = case when full_name = '' then v_nom else full_name end
   where id = v_barber;

  ------------------------------------------------------------------------------
  -- 3. Le salon.
  ------------------------------------------------------------------------------
  insert into public.salons (owner_id, name, address, phone, timezone)
  values (v_barber, v_nom, v_adresse, v_telephone, v_fuseau)
  on conflict (owner_id) do update
    set name = excluded.name,
        address = excluded.address,
        phone = excluded.phone,
        timezone = excluded.timezone
  returning id into v_salon;

  ------------------------------------------------------------------------------
  -- 4. Les 4 prestations. Durées et tarifs modifiables ensuite depuis l'app.
  --    Les prix sont en millimes : 7000 = 7 DT.
  ------------------------------------------------------------------------------
  insert into public.services (salon_id, kind, name, description,
                               duration_minutes, cleanup_minutes, price_millimes, position)
  values (v_salon, 'beard',      'Barbe',           'Taille & contour', 15, 0,  7000, 1),
         (v_salon, 'hair',       'Cheveux',         'Coupe & coiffage', 30, 5, 15000, 2),
         (v_salon, 'beard_hair', 'Barbe + Cheveux', 'Formule complète', 45, 5, 20000, 3),
         (v_salon, 'kids',       'Coupe enfant',    'Moins de 12 ans',  20, 0, 10000, 4)
  on conflict (salon_id, kind) do update
    set name             = excluded.name,
        description      = excluded.description,
        duration_minutes = excluded.duration_minutes,
        cleanup_minutes  = excluded.cleanup_minutes,
        price_millimes   = excluded.price_millimes;

  ------------------------------------------------------------------------------
  -- 5. Horaires : fermé dimanche et lundi.
  ------------------------------------------------------------------------------
  insert into public.opening_hours (salon_id, weekday, is_open, opens_at, closes_at)
  values (v_salon, 0, false, '09:00', '19:00'),   -- dimanche
         (v_salon, 1, false, '09:00', '19:00'),   -- lundi
         (v_salon, 2, true,  '09:00', '19:00'),
         (v_salon, 3, true,  '09:00', '19:00'),
         (v_salon, 4, true,  '09:00', '19:00'),
         (v_salon, 5, true,  '09:00', '20:00'),
         (v_salon, 6, true,  '08:30', '18:00')    -- samedi
  on conflict (salon_id, weekday) do update
    set is_open   = excluded.is_open,
        opens_at  = excluded.opens_at,
        closes_at = excluded.closes_at;

  ------------------------------------------------------------------------------
  -- 6. Pause déjeuner tous les jours ouverts.
  ------------------------------------------------------------------------------
  delete from public.recurring_breaks where salon_id = v_salon;
  insert into public.recurring_breaks (salon_id, weekday, label, starts_at, ends_at)
  values (v_salon, null, 'Déjeuner', '12:00', '14:00');

  raise notice '=========================================';
  raise notice '  SALON CREE';
  raise notice '  Nom      : %', v_nom;
  raise notice '  Coiffeur : %', v_email_coiffeur;
  raise notice '  4 prestations, 5 jours ouverts, pause 12h-14h';
  raise notice '  Vous pouvez lancer l''application.';
  raise notice '=========================================';
end $$;

-- Vérification : la grille de créneaux répond-elle vraiment ?
-- Les quatre lignes doivent afficher un nombre de créneaux supérieur à zéro.
select s.name                                        as prestation,
       s.duration_minutes || ' min'                  as duree,
       (s.price_millimes / 1000.0)::numeric(10,3) || ' DT' as tarif,
       (select count(*)
          from generate_series(current_date, current_date + 6, interval '1 day') d
          cross join lateral public.available_slots(s.id, d::date)) as creneaux_7_prochains_jours
  from public.services s
 order by s.position;
