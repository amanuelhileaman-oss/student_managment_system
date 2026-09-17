#!/usr/bin/env bash
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PG_DATA_DIR="$BACKEND_DIR/data/pg_data"
PG_PORT=5433

echo "Stopping PostgreSQL on port $PG_PORT..."
/usr/lib/postgresql/18/bin/pg_ctl -D "$PG_DATA_DIR" stop -m fast || true
echo "PostgreSQL stopped."
