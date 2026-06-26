"""Application settings, loaded from environment / .env file.

Everything that differs between environments (which database, where media
lives, who may call the API) is funneled through here so the rest of the code
never hard-codes an environment assumption. Swapping databases is a one-line
change to DATABASE_URL.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database -- any SQLAlchemy URL. Default is zero-install SQLite.
    database_url: str = "sqlite:///./foolsboard.db"

    # Media storage backend: "local" today; "s3" can be added later without
    # touching call sites (see app/storage.py).
    storage_backend: str = "local"
    storage_local_dir: str = "./storage"
    storage_public_url: str = "/media"

    # Where the nightly backup job writes dumps/archives (mirrors the default in
    # packaging/foolsboard-backup.sh). Surfaced in Admin > Storage.
    backup_dir: str = "/var/backups/foolsboard"
    # The backup script the admin "Run backup now" button invokes (same one the
    # systemd timer runs). The backup dir is group-writable so the app can run it.
    backup_script: str = "/opt/foolsboard/backup.sh"

    # Built frontend directory (the Vite `dist/`). When set, uvicorn serves the
    # SPA + its assets alongside the API on one port -- the production single-port
    # deployment. Left unset in dev, where Vite serves the frontend separately.
    static_dir: str | None = None

    # Frontend origins allowed to call the API (Vite dev server by default).
    cors_origins: list[str] = ["http://localhost:5173"]

    # --- Auth ---
    # Secret for signing access tokens. CHANGE THIS via JWT_SECRET in .env for
    # any real deployment; the default only exists so dev works out of the box.
    jwt_secret: str = "dev-insecure-change-me-please"
    jwt_expire_minutes: int = 60 * 24 * 14  # 14 days
    # PBKDF2-HMAC-SHA256 iterations for password hashing.
    password_iterations: int = 210_000

    # --- Media compression (applied on upload; result kept only if smaller) ---
    # Set compress_media=False to store uploads untouched.
    compress_media: bool = True
    image_webp_quality: int = 82      # 0-100; higher = better quality / larger
    video_crf: int = 23               # quality (x264 CRF / NVENC CQ); lower = better/larger
    video_preset: str = "fast"        # x264 speed/efficiency trade-off (CPU fallback)
    audio_bitrate: str = "128k"       # Opus target bitrate
    # Skip re-encoding media that's already in an efficient codec at/under these
    # bitrates (avoids wasted work and needless quality loss). 0 disables skip.
    video_skip_bitrate: int = 4_000_000   # ~4 Mbps
    audio_skip_bitrate: int = 160_000     # 160 kbps
    # Cap on decoded image area (width*height) when opening an uploaded image.
    # Bounds decoder memory and refuses "decompression bomb" images (a tiny file
    # that expands to an enormous canvas). 0 disables the cap.
    max_image_pixels: int = 64_000_000    # 64 MP

    # --- Log retention ---
    # On startup, delete raw request/error log rows older than this many days so
    # those high-volume tables stay bounded. The curated activity log is kept.
    # 0 disables pruning.
    request_log_retention_days: int = 30

    # --- Orphaned media retention ---
    # Default grace period before the startup auto-sweep deletes an orphaned
    # storage file (one no asset/thumbnail/avatar references). This is only the
    # fallback default; admins can override it at runtime in the Admin panel
    # (stored in app_settings). 0 disables the automatic sweep. The manual GC in
    # the Admin panel ignores this and removes all orphans on demand.
    orphan_retention_days: int = 90

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
