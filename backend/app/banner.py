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

# Line-art lightning bolt (the logo mark), drawn with pipes/slashes.
_BOLT = [" ___ ", "|  / ", "| /  ", "|/__ ", " __/ ", "/    "]


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
    fools, board = "f o o l s", "b o a r d"
    rule = "─" * len(f"{fools} {board}")
    ver = f"  ·  v{_VERSION}" if _VERSION else ""

    def bolt(i: int) -> str:
        return f"{_B}{_V}{_BOLT[i]}{_R}"

    lines = [
        "",
        f"  {bolt(0)}",
        f"  {bolt(1)}",
        f"  {bolt(2)}   {_B}{_V}{fools}{_R} {_B}{_W}{board}{_R}",
        f"  {bolt(3)}   {_D}{rule}{_R}",
        f"  {bolt(4)}   {_D}branching storyboards{ver}{_R}",
        f"  {bolt(5)}",
        "",
    ]
    print("\n".join(lines), flush=True)


def print_ready() -> None:
    ver = f" {_D}v{_VERSION}{_R}" if _VERSION else ""
    print(f"  {_B}{_V}fools{_R}{_B}board{_R}{ver} {_D}· ready{_R}", flush=True)
