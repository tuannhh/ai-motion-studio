#!/usr/bin/env bash
# Entrypoint container AI Motion Studio: đợi MySQL sẵn sàng → áp schema + các
# changelog (đều idempotent, chạy lại an toàn) → khởi động server.
# Bỏ qua bước migration bằng APPLY_MIGRATIONS=0 (ví dụ Cloud Run đã migrate riêng).
set -euo pipefail

DB_HOST="${DB_HOST:-mysql}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-ams}"
DB_PASSWORD="${DB_PASSWORD:-ams_dev_password}"
DB_NAME="${DB_NAME:-ams}"
SQLDIR="apps/server/startup/database"

# Cloud SQL trên Cloud Run chỉ lộ Unix socket tại /cloudsql/<connection-name> —
# đặt DB_SOCKET_PATH thay vì DB_HOST/DB_PORT (khớp apps/server/src/db.ts).
if [ -n "${DB_SOCKET_PATH:-}" ]; then
  mysql_do() {
    mysql --socket="$DB_SOCKET_PATH" --user="$DB_USER" --password="$DB_PASSWORD" "$@"
  }
  WAIT_LABEL="socket ${DB_SOCKET_PATH}"
else
  mysql_do() {
    mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
          --password="$DB_PASSWORD" "$@"
  }
  WAIT_LABEL="${DB_HOST}:${DB_PORT}"
fi

if [ "${APPLY_MIGRATIONS:-1}" != "0" ]; then
  echo "[entrypoint] Đợi MySQL tại ${WAIT_LABEL} ..."
  for i in $(seq 1 60); do
    LAST_ERR=$(mysql_do -e "SELECT 1" 2>&1 >/dev/null) && break
    sleep 2
    if [ "$i" = "60" ]; then
      echo "[entrypoint] MySQL không phản hồi sau 120s — lỗi gần nhất:" >&2
      echo "$LAST_ERR" >&2
      exit 1
    fi
  done

  echo "[entrypoint] Áp schema baseline ..."
  mysql_do "$DB_NAME" < "$SQLDIR/schema.sql"

  echo "[entrypoint] Áp changelogs ..."
  for f in "$SQLDIR"/changelogs/[0-9]*.sql; do
    echo "  → $(basename "$f")"
    mysql_do "$DB_NAME" < "$f"
  done
  echo "[entrypoint] DB sẵn sàng."
fi

exec "$@"
