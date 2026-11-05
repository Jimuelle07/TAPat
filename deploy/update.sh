#!/usr/bin/env bash
# Redeploy, docs/deployment.md §7. Run as the sudo-capable ssh user; repo commands run as tapat
# (-H keeps HOME=/home/tapat so pnpm's store and git's deploy key resolve).
set -euo pipefail

sudo -H -u tapat git -C /opt/tapat pull --ff-only
sudo -H -u tapat pnpm -C /opt/tapat install --frozen-lockfile
sudo -H -u tapat pnpm -C /opt/tapat --filter web build
sudo systemctl restart tapat-api tapat-web
