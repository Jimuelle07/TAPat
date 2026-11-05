#!/usr/bin/env bash
# One-time VM provisioning, docs/deployment.md §6.2. Idempotent; holds and writes no secret.
# Usage (as the sudo-capable ssh user):
#   git clone <repo-url> /tmp/tapat && sudo bash /tmp/tapat/deploy/provision.sh <repo-url>
# The units are copied but NOT started: there is no .env yet (DEP2, deployment.md §6.3).
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: sudo bash provision.sh <repo-url>" >&2
  exit 2
fi
if [[ $EUID -ne 0 ]]; then
  echo "provision.sh must run as root: sudo bash provision.sh <repo-url>" >&2
  exit 1
fi
REPO_URL="$1"

# 1. Base packages. The build tools are the fallback if better-sqlite3 has no prebuilt binary.
apt-get update
apt-get install -y build-essential python3 git sqlite3 curl debian-keyring debian-archive-keyring apt-transport-https

# 2. Swap when RAM < 2 GB (the GCP e2-micro case): next build needs it. Survives a reboot via /etc/fstab.
mem_kb="$(awk '/^MemTotal:/ { print $2 }' /proc/meminfo)"
if (( mem_kb < 2 * 1024 * 1024 )); then
  if [[ ! -f /swapfile ]]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
    swapon /swapfile
  fi
  if ! grep -q '^/swapfile ' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  swapon --show
fi

# 3. Node 22 from NodeSource, then a pinned pnpm 9 on the image (not corepack's on-demand download).
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
corepack enable
# --force: `corepack enable` already placed a pnpm shim at the same path, and npm refuses to overwrite it otherwise.
npm install -g --force pnpm@9

# 4. Service user (home, login shell, own group), checkout root, and the clone as that user.
if ! id -u tapat >/dev/null 2>&1; then
  useradd --system --create-home -U --shell /bin/bash tapat
fi
install -d -o tapat -g tapat -m 755 /opt/tapat
if [[ ! -d /opt/tapat/.git ]]; then
  # A private repo needs a read-only deploy key for tapat first (deployment.md §6.2 step 4).
  sudo -H -u tapat git clone "$REPO_URL" /opt/tapat
fi

# 5. Caddy from its official apt repository; our Caddyfile; an empty users file (root:caddy, 640).
if [[ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]]; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
fi
if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
fi
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
install -m 644 /opt/tapat/deploy/Caddyfile /etc/caddy/Caddyfile
if [[ ! -f /etc/caddy/tapat-users ]]; then
  install -m 640 -o root -g caddy /dev/null /etc/caddy/tapat-users
fi
chown root:caddy /etc/caddy/tapat-users
chmod 640 /etc/caddy/tapat-users

# 6. Tailscale.
if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# 7. systemd units: copied and loaded, not enabled or started.
install -m 644 /opt/tapat/deploy/tapat-api.service /etc/systemd/system/tapat-api.service
install -m 644 /opt/tapat/deploy/tapat-web.service /etc/systemd/system/tapat-web.service
systemctl daemon-reload

cat <<'EOF'
Provisioned. Next, once and interactively (deployment.md §6.2):
  sudo tailscale up --hostname=tapat
  sudo tailscale funnel --bg 8080
  caddy hash-password
  sudo tee /etc/caddy/tapat-users > /dev/null <<< '<user> <hash>'
  sudo systemctl enable caddy
  sudo systemctl restart caddy
Do not start tapat-api / tapat-web until DEP2 (deployment.md §6.3).
EOF
