"""Best-effort server vitals for the admin panel.

Linux-focused (production is a Debian VM): CPU and memory come from /proc, which
on a bare VM reports the host. Each metric degrades to None where unavailable
(e.g. the Windows dev box), so the endpoint never fails.

Container note: under Docker, /proc/meminfo and /proc/stat reflect the *host*,
not the container's cgroup limits. Keeping all collection behind collect() means
a future container deploy can add cgroup v2 reads (/sys/fs/cgroup/memory.max,
cpu.stat) here without touching the endpoint or the UI. Disk and the app-level
stats below are already environment-agnostic.
"""
from __future__ import annotations

import os
import platform
import shutil
import socket
import time
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, Board, Node, User

# Approximate process start (module import happens at startup).
_PROC_START = time.time()


def _meminfo() -> dict | None:
    try:
        data: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text().splitlines():
            k, _, rest = line.partition(":")
            data[k.strip()] = int(rest.strip().split()[0]) * 1024  # kB -> bytes
        total = data.get("MemTotal")
        if not total:
            return None
        avail = data.get("MemAvailable", 0)
        used = total - avail
        return {
            "total": total,
            "used": used,
            "available": avail,
            "percent": round(used / total * 100, 1),
        }
    except (OSError, ValueError, IndexError):
        return None


def _cpu_percent() -> float | None:
    """Instantaneous CPU usage from two /proc/stat samples ~100ms apart.
    Self-contained (no shared state), so concurrent admins don't interfere."""

    def snap() -> tuple[float, float]:
        parts = Path("/proc/stat").read_text().splitlines()[0].split()[1:]
        vals = [float(x) for x in parts]
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0.0)  # idle + iowait
        return sum(vals), idle

    try:
        t0, i0 = snap()
        time.sleep(0.1)
        t1, i1 = snap()
    except (OSError, ValueError, IndexError):
        return None
    dt = t1 - t0
    if dt <= 0:
        return None
    return round((1 - (i1 - i0) / dt) * 100, 1)


def _loadavg() -> dict | None:
    try:
        l1, l5, l15 = os.getloadavg()
        return {"1": round(l1, 2), "5": round(l5, 2), "15": round(l15, 2)}
    except (OSError, AttributeError):  # not available on Windows
        return None


def _uptime_system() -> float | None:
    try:
        return float(Path("/proc/uptime").read_text().split()[0])
    except (OSError, ValueError, IndexError):
        return None


def _disk() -> dict | None:
    target = settings.storage_local_dir if settings.storage_backend == "local" else "."
    try:
        u = shutil.disk_usage(target)
        return {
            "total": u.total,
            "used": u.used,
            "free": u.free,
            "percent": round(u.used / u.total * 100, 1),
        }
    except OSError:
        return None


def _storage_dir() -> dict | None:
    if settings.storage_backend != "local":
        return None
    try:
        total = 0
        files = 0
        with os.scandir(settings.storage_local_dir) as it:
            for e in it:
                if not e.is_file():
                    continue
                files += 1
                try:
                    total += e.stat().st_size
                except OSError:
                    pass
        return {"bytes": total, "files": files}
    except OSError:
        return None


def _db_bytes(db: Session) -> int | None:
    try:
        if settings.database_url.startswith("postgres"):
            return int(
                db.execute(text("SELECT pg_database_size(current_database())")).scalar() or 0
            )
        if settings.is_sqlite:
            return Path(settings.database_url.split("///", 1)[-1]).stat().st_size
    except Exception:
        return None
    return None


def _host() -> dict | None:
    try:
        return {
            "hostname": socket.gethostname(),
            "python": platform.python_version(),
            "platform": platform.platform(),
        }
    except Exception:
        return None


def collect(db: Session) -> dict:
    """Gather all vitals. Single entry point so a future container deploy can add
    cgroup-aware CPU/memory here without touching the endpoint or UI."""
    return {
        "cpu": {"count": os.cpu_count(), "percent": _cpu_percent(), "load": _loadavg()},
        "memory": _meminfo(),
        "disk": _disk(),
        "storage": _storage_dir(),
        "db_bytes": _db_bytes(db),
        "uptime": {"system": _uptime_system(), "process": round(time.time() - _PROC_START)},
        "app": {
            "users": db.scalar(select(func.count()).select_from(User)) or 0,
            "boards": db.scalar(select(func.count()).select_from(Board)) or 0,
            "nodes": db.scalar(select(func.count()).select_from(Node)) or 0,
            "assets": db.scalar(select(func.count()).select_from(Asset)) or 0,
        },
        "host": _host(),
    }
