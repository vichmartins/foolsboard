"""Branded startup banner for the foolsboard backend.

`print_logo()` draws a line-art lightning bolt beside the wordmark (the dev
launcher prints it once at the top). `print_ready()` is a one-line brand marker
from the app lifespan, so production logs (journald) get branding too. Colors are
emitted only to an interactive terminal -- prod logs get clean, escape-free text.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_tty = sys.stdout.isatty()
_V = "\033[38;5;99m" if _tty else ""   # violet, ~ the logo's #863bff
_W = "\033[38;5;253m" if _tty else ""  # near-white ("board")
_B = "\033[1m" if _tty else ""
_D = "\033[2m" if _tty else ""
_R = "\033[0m" if _tty else ""

# 4-row block-shadow font for the "foolsboard" title.
_FONT = {
    "f": ["▄██", "██▄", "█  ", "█  "],
    "o": ["███", "█ █", "█ █", "███"],
    "l": ["█  ", "█  ", "█  ", "███"],
    "s": ["▄██", "██▄", "▄▄█", "██▀"],
    "b": ["█  ", "██▄", "█ █", "███"],
    "a": ["▄█▄", "█ █", "███", "█ █"],
    "r": ["██▄", "█ █", "█  ", "█  "],
    "d": ["  █", "▄██", "█ █", "███"],
}


def _row(word: str, i: int) -> str:
    return " ".join(_FONT[c][i] for c in word)


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


def print_logo() -> None:
    ver = f"  ·  v{_VERSION}" if _VERSION else ""
    lines = [""]
    for i in range(4):
        lines.append(f"  {_B}{_V}{_row('fools', i)}{_R} {_B}{_W}{_row('board', i)}{_R}")
    lines.append(f"  {_D}branching storyboards{ver}{_R}")
    lines.append("")
    print("\n".join(lines), flush=True)


def print_ready() -> None:
    ver = f" {_D}v{_VERSION}{_R}" if _VERSION else ""
    print(f"  {_B}{_V}fools{_R}{_B}board{_R}{ver} {_D}· ready{_R}", flush=True)
