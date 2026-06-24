"""Read/write admin-tunable runtime settings (persisted in app_settings), with
the env-based config as the fallback default."""
from __future__ import annotations

from sqlalchemy.orm import Session

from .models import AppSetting

# Known keys.
ORPHAN_RETENTION_DAYS = "orphan_retention_days"


def get_int(db: Session, key: str, default: int) -> int:
    row = db.get(AppSetting, key)
    if row is None:
        return default
    try:
        return int(row.value)
    except (TypeError, ValueError):
        return default


def set_value(db: Session, key: str, value: str) -> None:
    """Upsert a setting. Caller commits."""
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value
