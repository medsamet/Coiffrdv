#!/usr/bin/env bash
#
# Applique les migrations sur une base PostgreSQL jetable et lance les tests
# des règles métier. Aucun Supabase requis : un PostgreSQL 14+ avec l'extension
# btree_gist suffit.
#
#   ./scripts/test-db.sh                       # démarre un cluster temporaire
#   PGHOST=localhost ./scripts/test-db.sh      # utilise un PostgreSQL déjà lancé
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${DB_NAME:-coiffrdv_test}"
OWN_CLUSTER=0

if [[ -z "${PGHOST:-}" ]]; then
  # Pas de serveur indiqué : on en démarre un pour la durée du script.
  OWN_CLUSTER=1
  export PGDATA="${PGDATA:-$(mktemp -d)/pgdata}"
  export PGHOST="$(dirname "$PGDATA")"
  export PGPORT="${PGPORT:-5433}"
  export PGUSER=postgres

  echo "▶ Démarrage d'un PostgreSQL temporaire dans $PGDATA"
  initdb -D "$PGDATA" -U postgres -A trust >/dev/null
  pg_ctl -D "$PGDATA" -o "-p $PGPORT -k $PGHOST" -l "$PGHOST/postgres.log" start >/dev/null
  trap 'pg_ctl -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true' EXIT
  sleep 2
fi

export PGUSER="${PGUSER:-postgres}"

echo "▶ Base $DB_NAME"
psql -q -d postgres -c "drop database if exists $DB_NAME;" >/dev/null
psql -q -d postgres -c "create database $DB_NAME;" >/dev/null
export PGDATABASE="$DB_NAME"

echo "▶ Shim d'authentification (remplace ce que Supabase fournit)"
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_local_auth_shim.sql" >/dev/null 2>&1

echo "▶ Migrations"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  printf '   %s\n' "$(basename "$migration")"
  psql -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null 2>&1
done

echo "▶ Tests des règles métier"
psql -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/01_business_rules_test.sql" 2>&1 \
  | sed -e 's/^psql:[^ ]* //' -e 's/^NOTICE:  /   /'

if [[ $OWN_CLUSTER -eq 1 ]]; then
  echo "▶ Cluster temporaire arrêté"
fi
