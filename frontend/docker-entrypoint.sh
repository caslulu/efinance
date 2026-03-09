#!/bin/sh
set -e

CERT_DIR="/etc/letsencrypt/live/efinancepro.me"
FULLCHAIN="$CERT_DIR/fullchain.pem"
PRIVKEY="$CERT_DIR/privkey.pem"

if [ ! -f "$FULLCHAIN" ] || [ ! -f "$PRIVKEY" ]; then
  echo "[entrypoint] TLS certificate not found. Generating local self-signed certificate..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout "$PRIVKEY" \
    -out "$FULLCHAIN" \
    -subj "/CN=localhost"
fi

exec nginx -g "daemon off;"
