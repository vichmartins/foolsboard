#!/usr/bin/env bash
# Build a foolsboard .deb. Run on a Debian/Linux host that has dpkg-deb.
#
# The frontend is bundled prebuilt: if frontend/dist exists it's used as-is;
# otherwise this builds it with npm (requires Node on the build host).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

VERSION="$(grep -m1 '"version"' frontend/package.json \
          | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
ARCH=all
PKG="foolsboard_${VERSION}_${ARCH}"
STAGE="build/deb/${PKG}"

echo "==> Building ${PKG}.deb"

# 1. Frontend (use existing dist; else build it).
if [ ! -f frontend/dist/index.html ]; then
  echo "==> Building frontend (npm ci && npm run build)"
  ( cd frontend && npm ci && npm run build )
else
  echo "==> Using existing frontend/dist"
fi

# 2. Stage the package tree.
rm -rf "$STAGE"
mkdir -p "$STAGE/DEBIAN" \
         "$STAGE/opt/foolsboard/backend" \
         "$STAGE/opt/foolsboard/frontend/dist" \
         "$STAGE/lib/systemd/system" \
         "$STAGE/usr/share/doc/foolsboard"

# Backend source (no dev artifacts).
cp -r backend/app backend/alembic backend/alembic.ini backend/scripts \
      backend/requirements.txt backend/requirements-postgres.txt \
      "$STAGE/opt/foolsboard/backend/"
find "$STAGE/opt/foolsboard/backend" -type d -name __pycache__ -prune -exec rm -rf {} +
find "$STAGE/opt/foolsboard/backend" -type f -name '*.pyc' -delete

# Built frontend.
cp -r frontend/dist/. "$STAGE/opt/foolsboard/frontend/dist/"

# Control + maintainer scripts.
sed -e "s/@VERSION@/${VERSION}/" -e "s/@ARCH@/${ARCH}/" \
    packaging/debian/control.in > "$STAGE/DEBIAN/control"
install -m 0755 packaging/debian/postinst "$STAGE/DEBIAN/postinst"
install -m 0755 packaging/debian/prerm    "$STAGE/DEBIAN/prerm"
install -m 0755 packaging/debian/postrm   "$STAGE/DEBIAN/postrm"

# systemd unit + docs.
install -m 0644 packaging/systemd/foolsboard.service "$STAGE/lib/systemd/system/foolsboard.service"
# Backup script + daily timer + the interactive restore helper.
install -m 0755 packaging/foolsboard-backup.sh              "$STAGE/opt/foolsboard/backup.sh"
install -m 0755 packaging/foolsboard-restore.sh            "$STAGE/opt/foolsboard/restore.sh"
install -m 0644 packaging/systemd/foolsboard-backup.service "$STAGE/lib/systemd/system/foolsboard-backup.service"
install -m 0644 packaging/systemd/foolsboard-backup.timer   "$STAGE/lib/systemd/system/foolsboard-backup.timer"
install -m 0644 packaging/foolsboard.env.example      "$STAGE/usr/share/doc/foolsboard/foolsboard.env.example"
install -m 0644 packaging/BACKUP-RESTORE.md           "$STAGE/usr/share/doc/foolsboard/BACKUP-RESTORE.md"
[ -f CHANGELOG.md ] && install -m 0644 CHANGELOG.md   "$STAGE/usr/share/doc/foolsboard/CHANGELOG.md" || true
# Optional reverse-proxy example (added once finalized).
[ -f packaging/nginx/foolsboard-proxy.example.conf ] && \
  install -m 0644 packaging/nginx/foolsboard-proxy.example.conf \
                  "$STAGE/usr/share/doc/foolsboard/nginx-proxy.example.conf" || true

# Normalize line endings on control/scripts (guards against a CRLF checkout).
for f in control postinst prerm postrm; do
  [ -f "$STAGE/DEBIAN/$f" ] && sed -i 's/\r$//' "$STAGE/DEBIAN/$f"
done
sed -i 's/\r$//' "$STAGE/lib/systemd/system/foolsboard.service" \
                 "$STAGE/lib/systemd/system/foolsboard-backup.service" \
                 "$STAGE/lib/systemd/system/foolsboard-backup.timer" \
                 "$STAGE/opt/foolsboard/backup.sh" \
                 "$STAGE/opt/foolsboard/restore.sh"

# 3. Build.
mkdir -p build
dpkg-deb --root-owner-group --build "$STAGE" "build/${PKG}.deb"
echo "==> Built build/${PKG}.deb"
