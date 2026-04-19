#!/bin/bash
set -e
CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"
if [ -f "$CERT_DIR/server.crt" ]; then
  echo "証明書が既に存在します: $CERT_DIR/server.crt"
  exit 0
fi
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -subj "/C=JP/ST=Tokyo/L=Chiyoda/O=PJMO/CN=pjmo-review.local" \
  -addext "subjectAltName=DNS:pjmo-review.local,DNS:localhost,IP:127.0.0.1"
chmod 600 "$CERT_DIR/server.key"
echo "完了: $CERT_DIR/"
