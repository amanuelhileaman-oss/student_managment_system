#!/usr/bin/env bash
set -e

PG_DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/data/pg_data"
PG_PORT=5433
PG_USER=postgres

echo "=== Initializing PostgreSQL Database Cluster ==="
echo "Data Directory: $PG_DATA_DIR"
echo "Port: $PG_PORT"

if [ -d "$PG_DATA_DIR" ] && [ -f "$PG_DATA_DIR/PG_VERSION" ]; then
  echo "PostgreSQL cluster already initialized at $PG_DATA_DIR."
else
  mkdir -p "$PG_DATA_DIR"
  /usr/lib/postgresql/18/bin/initdb -D "$PG_DATA_DIR" -U "$PG_USER" -A trust --encoding=UTF8 --locale=C.UTF-8
  echo "PostgreSQL cluster initialized successfully."
fi

# Ensure postgresql.conf has proper socket directory
echo "unix_socket_directories = '/tmp'" >> "$PG_DATA_DIR/postgresql.conf" || true
echo "port = $PG_PORT" >> "$PG_DATA_DIR/postgresql.conf" || true

echo "=== Initialization Complete ==="
