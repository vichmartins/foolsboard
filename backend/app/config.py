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

    # Frontend origins allowed to call the API (Vite dev server by default).
    cors_origins: list[str] = ["http://localhost:5173"]

    # --- Media compression (applied on upload; result kept only if smaller) ---
    # Set compress_media=False to store uploads untouched.
    compress_media: bool = True
    image_webp_quality: int = 82      # 0-100; higher = better quality / larger
    video_crf: int = 23               # x264 quality; lower = better/larger (~18-28)
    video_preset: str = "fast"        # x264 speed/efficiency trade-off
    audio_bitrate: str = "128k"       # Opus target bitrate

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


settings = Settings()
