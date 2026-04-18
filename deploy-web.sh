#!/bin/bash
set -e

# ─── CONFIG ───────────────────────────────────────────────
SSH_USER="ton_user"           # utilisateur SSH HestiaCP
SSH_HOST="ton_vps_ip"         # IP ou hostname du VPS
REMOTE_PATH="/home/$SSH_USER/web/app.goespay.io/public_html"
# ──────────────────────────────────────────────────────────

echo "▶ Build Expo web..."
npx expo export --platform web

echo "▶ Copie du .htaccess dans dist/..."
cp web-public/.htaccess dist/.htaccess

echo "▶ Déploiement sur $SSH_HOST..."
rsync -avz --delete dist/ "$SSH_USER@$SSH_HOST:$REMOTE_PATH/"

echo "✅ Déployé sur https://app.goespay.io"
