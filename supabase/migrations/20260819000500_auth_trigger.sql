-- =============================================================================
-- Coiff'RDV — 0005 : création automatique du profil à l'inscription
--
-- Sans ce trigger, Supabase Auth crée bien le compte, mais aucune ligne
-- n'apparaît dans public.profiles : l'application se retrouve avec un utilisateur
-- connecté sans profil, et n'affiche rien. C'est le maillon qui relie
-- l'authentification aux données métier.
-- =============================================================================

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Le profil doit aussi suivre les changements d'identifiant : un client qui
-- ajoute son email après s'être inscrit par téléphone doit pouvoir basculer de
-- canal de notification.
create or replace function public.handle_user_identity_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.profiles p
     set email = new.email,
         phone = new.phone,
         -- On ne bascule le canal que s'il est devenu injoignable.
         notify_channel = case
           when p.notify_channel = 'email' and new.email is null and new.phone is not null then 'sms'
           when p.notify_channel = 'sms'   and new.phone is null and new.email is not null then 'email'
           else p.notify_channel
         end
   where p.id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_identity_change on auth.users;
create trigger on_auth_user_identity_change
  after update of email, phone on auth.users
  for each row execute function public.handle_user_identity_change();
