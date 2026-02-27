#!/bin/sh
set -e

echo "=== FinanceApp Backend Starting ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "Database host: $(echo $DATABASE_URL | sed 's/:[^:]*@/@/; s/\?.*$//')"

echo "Waiting for database to be ready..."
MAX_RETRIES=30
RETRY=0
until npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not reachable after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "  Waiting for database... attempt $RETRY/$MAX_RETRIES"
  sleep 2
done
echo "Database is ready!"

echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Migrations completed successfully."

echo "Starting application on port ${PORT:-3000}..."
exec node dist/main
