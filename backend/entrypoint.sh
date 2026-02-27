#!/bin/sh
set -e

echo "=== FinanceApp Backend Starting ==="
echo "NODE_ENV: ${NODE_ENV:-not set}"
echo "DATABASE_URL: ${DATABASE_URL:+set (hidden)}"
echo "DATABASE_URL is: ${DATABASE_URL:-NOT SET!}"

echo "Running Prisma migrations..."
npx prisma migrate deploy
echo "Migrations completed successfully."

echo "Starting application on port ${PORT:-3000}..."
exec node dist/src/main
