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

_ART = ("  ◆◇◆", "  ◇◆◇")  # flanks the wordmark on both sides


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


def _banner_lines() -> list[str]:
    v = _version()
    mid = [f"foolsboard  v{v}" if v else "foolsboard", "branching storyboards"]
    width = max(len(m) for m in mid)
    lines = [
        f"{_MAGENTA}{_ART[i]}{_RESET}   {m.ljust(width)}   {_MAGENTA}{_ART[i][2:]}{_RESET}"
        for i, m in enumerate(mid)
    ]
    # Colorize the wordmark / version / subtitle inside the (still plain) middle text.
    lines[0] = lines[0].replace(
        "foolsboard", f"{_BOLD}{_MAGENTA}fools{_RESET}{_BOLD}board{_RESET}"
    )
    if v:
        lines[0] = lines[0].replace(f"v{v}", f"{_DIM}v{v}{_RESET}")
    lines[1] = lines[1].replace(
        "branching storyboards", f"{_DIM}branching storyboards{_RESET}"
    )
    return lines


def print_banner() -> None:
    print("\n" + "\n".join(_banner_lines()) + "\n", flush=True)
