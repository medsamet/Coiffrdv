#!/usr/bin/env bash
#
# Assemble toutes les migrations en un seul fichier à coller dans l'éditeur SQL
# de Supabase. Évite d'avoir à ouvrir et exécuter cinq fichiers à la suite.
#
#   ./scripts/build-setup-sql.sh          # écrit supabase/setup.sql
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/supabase/setup.sql"

{
  cat <<'HEADER'
-- =============================================================================
-- Coiff'RDV — INSTALLATION COMPLÈTE
--
-- Fichier généré par scripts/build-setup-sql.sh : ne le modifiez pas à la main,
-- modifiez les fichiers de supabase/migrations/ puis relancez le script.
--
-- À COLLER EN UNE FOIS dans Supabase → SQL Editor → New query → Run.
-- Le script est idempotent : le relancer ne casse rien.
--
-- Il ne crée AUCUN compte et AUCUNE donnée. Pour créer le salon de
-- démonstration, voyez supabase/bootstrap-salon.sql, à lancer ensuite.
-- =============================================================================

HEADER

  for migration in "$ROOT"/supabase/migrations/*.sql; do
    printf '\n\n-- ###########################################################################\n'
    printf -- '-- %s\n' "$(basename "$migration")"
    printf -- '-- ###########################################################################\n\n'
    cat "$migration"
  done

  cat <<'FOOTER'


-- =============================================================================
-- Contrôle final : si vous voyez « INSTALLATION OK » dans les résultats,
-- tout est en place.
-- =============================================================================
do $$
declare
  n_tables    int;
  n_functions int;
  n_policies  int;
  n_triggers  int;
begin
  select count(*) into n_tables from information_schema.tables
   where table_schema = 'public'
     and table_name in ('profiles','salons','services','opening_hours',
                        'recurring_breaks','time_blocks','appointments',
                        'notifications_outbox');

  select count(*) into n_functions from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('available_slots','request_appointment',
                       'decide_appointment','cancel_appointment');

  select count(*) into n_policies from pg_policies where schemaname = 'public';

  select count(*) into n_triggers from pg_trigger
   where tgname in ('on_auth_user_created', 'appointments_no_overlap_check')
     and not tgisinternal;

  assert n_tables = 8,    format('Tables attendues : 8, trouvées : %s', n_tables);
  assert n_functions = 4, format('Fonctions métier attendues : 4, trouvées : %s', n_functions);
  assert n_policies >= 12, format('Politiques RLS attendues : au moins 12, trouvées : %s', n_policies);

  raise notice '=========================================';
  raise notice '  INSTALLATION OK';
  raise notice '  % tables, % fonctions metier, % politiques RLS', n_tables, n_functions, n_policies;
  raise notice '  Etape suivante : bootstrap-salon.sql';
  raise notice '=========================================';
end $$;
FOOTER
} > "$OUT"

echo "Écrit : $OUT ($(wc -l < "$OUT") lignes)"
