"""Tiny in-memory sliding-window rate limiter.

Single-process only (state lives in this process), which matches how foolsboard
is deployed -- one uvicorn worker. Used to throttle login attempts so passwords
can't be brute-forced. If the app is ever run behind a reverse proxy, configure
uvicorn's --proxy-headers/--forwarded-allow-ips so request.client.host is the
real client and not the proxy.
"""
from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: int) -> None:
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._events: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _prune(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        kept = [t for t in self._events[key] if t > cutoff]
        if kept:
            self._events[key] = kept
        else:
            self._events.pop(key, None)  # keep the dict from growing unbounded

    def is_blocked(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            self._prune(key, now)
            return len(self._events.get(key, ())) >= self.max_events

    def record(self, key: str) -> None:
        with self._lock:
            self._events[key].append(time.time())

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def clear(self) -> None:
        """Drop all tracked events (used by tests for isolation)."""
        with self._lock:
            self._events.clear()


# Up to 10 failed login attempts per IP per 10 minutes; a success clears the IP.
login_limiter = SlidingWindowLimiter(max_events=10, window_seconds=600)

# Up to 5 failed password-change attempts per user per 10 minutes -- stops someone
# with a stolen session from brute-forcing the current password. Success clears it.
password_change_limiter = SlidingWindowLimiter(max_events=5, window_seconds=600)
