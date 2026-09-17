#!/usr/bin/env bash
set -e

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PG_DATA_DIR="$BACKEND_DIR/data/pg_data"
PG_LOG_FILE="$BACKEND_DIR/data/postgres.log"
PG_PORT=5433
PG_USER=postgres

mkdir -p "$BACKEND_DIR/data"

# Check if cluster is initialized
if [ ! -f "$PG_DATA_DIR/PG_VERSION" ]; then
  echo "Cluster not initialized. Initializing now..."
  "$BACKEND_DIR/scripts/init-db.sh"
fi

# Check if already running on port 5433
if /usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; then
  echo "PostgreSQL is already running on port $PG_PORT."
else
  echo "Starting PostgreSQL on port $PG_PORT..."
  /usr/lib/postgresql/18/bin/pg_ctl -D "$PG_DATA_DIR" -l "$PG_LOG_FILE" -o "-p $PG_PORT -k /tmp" start
  
  # Wait for postgres to be ready
  count=0
  while ! /usr/lib/postgresql/18/bin/pg_isready -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; do
    sleep 0.5
    count=$((count+1))
    if [ $count -gt 20 ]; then
      echo "PostgreSQL failed to start. Check logs at $PG_LOG_FILE"
      cat "$PG_LOG_FILE"
      exit 1
    fi
  done
  echo "PostgreSQL started successfully on port $PG_PORT."
fi

# Ensure database exists
if ! /usr/bin/psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw highschool_db; then
  echo "Creating database highschool_db..."
  /usr/bin/psql -h 127.0.0.1 -p "$PG_PORT" -U "$PG_USER" -c "CREATE DATABASE highschool_db;"
  echo "Database highschool_db created."
else
  echo "Database highschool_db exists."
fi
