#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v psql >/dev/null 2>&1; then
  echo "UNVERIFIED: psql not available"
  exit 0
fi

if ! sudo service postgresql status >/dev/null 2>&1; then
  sudo service postgresql start >/dev/null 2>&1 || true
fi

DB=cuboards_rpc_verify
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB};" >/dev/null
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB};" >/dev/null

# Apply 0010 only (table stub created in verify SQL)
TMP="$ROOT/scripts/.rpc-verify-setup.sql"
{
  echo "CREATE SCHEMA IF NOT EXISTS auth;"
  echo "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$ SELECT 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid \$\$;"
  echo "CREATE TABLE IF NOT EXISTS public.cuboards_jobs ("
  echo "  id uuid NOT NULL, user_id uuid NOT NULL, data jsonb NOT NULL,"
  echo "  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, id));"
  grep -v '^grant execute' supabase/migrations/0010_cuboards_job_atomic_sync.sql
} >"$TMP"

sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB" -f "$TMP" >/dev/null

JOB=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
TS='2026-11-01 12:00:00+00'

run_rpc() {
  local body=$1
  local ts=$2
  sudo -u postgres psql -t -A -d "$DB" -c \
    "SELECT public.cuboards_upsert_job_if_not_stale('${JOB}'::uuid, '${body}'::jsonb, '${ts}'::timestamptz);"
}

echo "=== RPC concurrency verify on PostgreSQL ==="
R1=$(run_rpc '{"client":{"name":"A"}}' "$TS")
R2=$(run_rpc '{"client":{"name":"B"}}' "$TS")
R3=$(run_rpc '{"client":{"name":"A"}}' "$TS")
R4=$(run_rpc '{"client":{"name":"C"}}' "$TS")
R5=$(run_rpc '{"client":{"name":"D"}}' '2026-11-01 11:00:00+00')

echo "first_create=$R1"
echo "second_same_ts_diff=$R2"
echo "idempotent_same_body=$R3"
echo "equal_ts_diff_body=$R4"
echo "stale_timestamp=$R5"

BODY=$(sudo -u postgres psql -t -A -d "$DB" -c "SELECT data->'client'->>'name' FROM cuboards_jobs WHERE id='${JOB}'::uuid;")
echo "final_name=$BODY"

FAIL=0
[[ "$R1" == "ok" ]] || FAIL=1
[[ "$R2" == "conflict" ]] || FAIL=1
[[ "$R3" == "ok" ]] || FAIL=1
[[ "$R4" == "conflict" ]] || FAIL=1
[[ "$R5" == "conflict" ]] || FAIL=1
[[ "$BODY" == "A" ]] || FAIL=1

if [[ $FAIL -eq 0 ]]; then
  echo "RESULT=PASS"
  exit 0
fi
echo "RESULT=FAIL"
exit 1
