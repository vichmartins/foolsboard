"""Best-effort server vitals for the admin panel.

Cross-platform via stdlib only (no psutil): CPU and memory come from /proc on
Linux (production is a Debian VM) and from the Win32 API via ctypes on Windows
(the dev box). Each metric degrades to None where unavailable, so the endpoint
never fails.

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
import sys
import time
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, Board, Node, User

# Approximate process start (module import happens at startup).
_PROC_START = time.time()

_IS_WINDOWS = sys.platform.startswith("win")

if _IS_WINDOWS:
    import ctypes

    class _MEMORYSTATUSEX(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    class _FILETIME(ctypes.Structure):
        _fields_ = [("dwLowDateTime", ctypes.c_uint32), ("dwHighDateTime", ctypes.c_uint32)]

    def _ft(ft: "_FILETIME") -> int:
        return (ft.dwHighDateTime << 32) | ft.dwLowDateTime


def _meminfo() -> dict | None:
    if _IS_WINDOWS:
        try:
            st = _MEMORYSTATUSEX()
            st.dwLength = ctypes.sizeof(st)
            if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st)):
                return None
            total, avail = st.ullTotalPhys, st.ullAvailPhys
        except Exception:
            return None
        used = total - avail
        return {"total": total, "used": used, "available": avail,
                "percent": round(used / total * 100, 1)} if total else None
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
        return {"total": total, "used": used, "available": avail,
                "percent": round(used / total * 100, 1)}
    except (OSError, ValueError, IndexError):
        return None


def _cpu_snapshot() -> tuple[float, float] | None:
    """Return (total_ticks, idle_ticks), or None if unavailable."""
    if _IS_WINDOWS:
        try:
            idle, kern, user = _FILETIME(), _FILETIME(), _FILETIME()
            if not ctypes.windll.kernel32.GetSystemTimes(
                ctypes.byref(idle), ctypes.byref(kern), ctypes.byref(user)
            ):
                return None
            # kernel time already includes idle time on Windows.
            return float(_ft(kern) + _ft(user)), float(_ft(idle))
        except Exception:
            return None
    try:
        parts = Path("/proc/stat").read_text().splitlines()[0].split()[1:]
        vals = [float(x) for x in parts]
        idle = vals[3] + (vals[4] if len(vals) > 4 else 0.0)  # idle + iowait
        return sum(vals), idle
    except (OSError, ValueError, IndexError):
        return None


def _cpu_percent() -> float | None:
    """Instantaneous CPU usage from two samples ~100ms apart. Self-contained."""
    a = _cpu_snapshot()
    if a is None:
        return None
    time.sleep(0.1)
    b = _cpu_snapshot()
    if b is None:
        return None
    dt = b[0] - a[0]
    if dt <= 0:
        return None
    return round((1 - (b[1] - a[1]) / dt) * 100, 1)


def _loadavg() -> dict | None:
    try:
        l1, l5, l15 = os.getloadavg()
        return {"1": round(l1, 2), "5": round(l5, 2), "15": round(l15, 2)}
    except (OSError, AttributeError):  # not available on Windows
        return None


def _uptime_system() -> float | None:
    if _IS_WINDOWS:
        try:
            fn = ctypes.windll.kernel32.GetTickCount64
            fn.restype = ctypes.c_uint64
            return fn() / 1000.0
        except Exception:
            return None
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
