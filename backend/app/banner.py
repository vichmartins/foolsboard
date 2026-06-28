"""Branded startup banner for the foolsboard backend.

Printed from the app lifespan, so it shows whether you launch via `python -m app`,
plain uvicorn, or systemd in production (where it lands in the journal). Colors are
emitted only to an interactive terminal -- prod logs get clean, escape-free text.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_tty = sys.stdout.isatty()
_MAGENTA = "\033[38;5;213m" if _tty else ""
_BOLD = "\033[1m" if _tty else ""
_DIM = "\033[2m" if _tty else ""
_RESET = "\033[0m" if _tty else ""


def _version() -> str:
    """Best-effort app version (single source of truth is frontend/package.json)."""
    here = Path(__file__).resolve()
    for cand in (
        here.parents[2] / "frontend" / "package.json",
        here.parents[3] / "frontend" / "package.json",
    ):
        try:
            return str(json.loads(cand.read_text(encoding="utf-8")).get("version", ""))
        except Exception:
            continue
    return ""


def print_banner(subtitle: str = "branching storyboards") -> None:
    v = _version()
    ver = f"  {_DIM}v{v}{_RESET}" if v else ""
    print(
        f"\n  {_BOLD}{_MAGENTA}fools{_RESET}{_BOLD}board{_RESET}{ver}\n"
        f"  {_DIM}{subtitle}{_RESET}\n",
        flush=True,
    )
