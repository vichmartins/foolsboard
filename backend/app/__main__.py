"""Run the foolsboard backend in development: `python -m app` (from backend/, with
the venv active). Serves the API on http://127.0.0.1:8000 with auto-reload; the
branded banner is printed by the app's lifespan. Production launches the app via its
systemd service, not this entry point.
"""
from __future__ import annotations

if __name__ == "__main__":
    import copy

    import uvicorn
    from uvicorn.config import LOGGING_CONFIG

    # Hush uvicorn's own lifecycle chatter ("Uvicorn running on…", "Started reloader
    # … using WatchFiles", startup/shutdown notices) so the foolsboard banner is the
    # only startup output. WARNING keeps real warnings/errors; request access logs
    # (uvicorn.access) stay at INFO.
    log_config = copy.deepcopy(LOGGING_CONFIG)
    for name in ("uvicorn", "uvicorn.error"):
        if name in log_config["loggers"]:
            log_config["loggers"][name]["level"] = "WARNING"

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_config=log_config,
    )
