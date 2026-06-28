"""Branded startup banner for the foolsboard backend.

`print_logo()` draws the full ASCII wordmark (the dev launcher uses it once at the
top). `print_ready()` is a one-line brand marker printed from the app lifespan, so
production logs (journald) get branding too. Colors are emitted only to an
interactive terminal -- prod logs get clean, escape-free text.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_tty = sys.stdout.isatty()
_M = "\033[38;5;213m" if _tty else ""  # magenta ("fools")
_W = "\033[97m" if _tty else ""        # bright white ("board")
_B = "\033[1m" if _tty else ""
_D = "\033[2m" if _tty else ""
_R = "\033[0m" if _tty else ""


def _read_version() -> str:
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


_VERSION = _read_version()  # cached at import -- no per-reload file read

# 5-row block letters (each exactly 5 cols wide).
_GLYPHS = {
    "F": ["█████", "█    ", "████ ", "█    ", "█    "],
    "O": ["█████", "█   █", "█   █", "█   █", "█████"],
    "L": ["█    ", "█    ", "█    ", "█    ", "█████"],
    "S": ["█████", "█    ", "█████", "    █", "█████"],
    "B": ["████ ", "█   █", "████ ", "█   █", "████ "],
    "A": ["█████", "█   █", "█████", "█   █", "█   █"],
    "R": ["████ ", "█   █", "████ ", "█  █ ", "█   █"],
    "D": ["████ ", "█   █", "█   █", "█   █", "████ "],
}


def _word(letters: str, i: int) -> str:
    return " ".join(_GLYPHS[c][i] for c in letters)


def print_logo() -> None:
    lines = [""]
    for i in range(5):
        lines.append(f"  {_B}{_M}{_word('FOOLS', i)}{_R}  {_B}{_W}{_word('BOARD', i)}{_R}")
    ver = f"  ·  v{_VERSION}" if _VERSION else ""
    lines.append(f"  {_D}branching storyboards{ver}{_R}")
    lines.append("")
    print("\n".join(lines), flush=True)


def print_ready() -> None:
    ver = f" {_D}v{_VERSION}{_R}" if _VERSION else ""
    print(f"  {_B}{_M}fools{_R}{_B}board{_R}{ver} {_D}· ready{_R}", flush=True)
