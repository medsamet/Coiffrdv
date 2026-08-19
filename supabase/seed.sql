-- =============================================================================
-- Coiff'RDV — jeu de données de démonstration
--
-- Reproduit le salon des maquettes : Coupe & Style, La Marsa.
-- À lancer sur une base locale (`supabase db reset` l'applique automatiquement).
-- Ne jamais lancer en production.
-- =============================================================================

do $$
declare
  v_barber uuid := '00000000-0000-4000-8000-000000000001';
  v_karim  uuid := '00000000-0000-4000-8000-000000000002';
  v_nadia  uuid := '00000000-0000-4000-8000-000000000003';
  v_salon  uuid;
begin
  -- Comptes. Sur un projet Supabase hébergé, créez-les plutôt depuis le
  -- dashboard (Authentication → Users) : le mot de passe est géré par GoTrue.
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_barber, 'coiffeur@coupe-style.tn',
          jsonb_build_object('role','barber','full_name','Coupe & Style'))
  on conflict (id) do nothing;

  insert into auth.users (id, email, raw_user_meta_data)
  values (v_karim, 'karim.b@exemple.com', jsonb_build_object('full_name','Karim Belhadj'))
  on conflict (id) do nothing;

  -- Nadia s'inscrit par téléphone : elle n'a pas d'email.
  insert into auth.users (id, phone, raw_user_meta_data)
  values (v_nadia, '+21622456789', jsonb_build_object('full_name','Nadia Mansour'))
  on conflict (id) do nothing;

  insert into public.profiles (id, role, full_name, email, notify_channel)
  values (v_barber, 'barber', 'Coupe & Style', 'coiffeur@coupe-style.tn', 'email'),
         (v_karim,  'client', 'Karim Belhadj', 'karim.b@exemple.com',    'email')
  on conflict (id) do nothing;

  insert into public.profiles (id, role, full_name, phone, notify_channel)
  values (v_nadia, 'client', 'Nadia Mansour', '+21622456789', 'sms')
  on conflict (id) do nothing;

  insert into public.salons (owner_id, name, address, phone, timezone)
  values (v_barber, 'Coupe & Style', 'Av. Habib Bourguiba, La Marsa', '+21671000000', 'Africa/Tunis')
  on conflict (owner_id) do update set name = excluded.name
  returning id into v_salon;

  -- Les 4 prestations, avec les durées et tarifs validés sur la maquette.
  insert into public.services (salon_id, kind, name, description,
                               duration_minutes, cleanup_minutes, price_millimes, position)
  values (v_salon, 'beard',      'Barbe',           'Taille & contour',   15, 0,  7000, 1),
         (v_salon, 'hair',       'Cheveux',         'Coupe & coiffage',   30, 5, 15000, 2),
         (v_salon, 'beard_hair', 'Barbe + Cheveux', 'Formule complète',   45, 5, 20000, 3),
         (v_salon, 'kids',       'Coupe enfant',    'Moins de 12 ans',    20, 0, 10000, 4)
  on conflict (salon_id, kind) do update
    set duration_minutes = excluded.duration_minutes,
        price_millimes   = excluded.price_millimes;

  -- Fermé dimanche et lundi.
  insert into public.opening_hours (salon_id, weekday, is_open, opens_at, closes_at)
  values (v_salon, 0, false, '09:00', '19:00'),
         (v_salon, 1, false, '09:00', '19:00'),
         (v_salon, 2, true,  '09:00', '19:00'),
         (v_salon, 3, true,  '09:00', '19:00'),
         (v_salon, 4, true,  '09:00', '19:00'),
         (v_salon, 5, true,  '09:00', '20:00'),
         (v_salon, 6, true,  '08:30', '18:00')
  on conflict (salon_id, weekday) do update
    set is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at;

  delete from public.recurring_breaks where salon_id = v_salon;
  insert into public.recurring_breaks (salon_id, weekday, label, starts_at, ends_at)
  values (v_salon, null, 'Déjeuner', '12:00', '14:00');

  raise notice 'Jeu de démonstration installé — salon %', v_salon;
end $$;
