"""`python -m foolsboard` — run the foolsboard backend in development.

A thin launcher (the application package itself is `app`). Serves the API on
http://127.0.0.1:8000 with auto-reload and prints the banner. Production launches
the app via its systemd service, not this entry point.
"""
from __future__ import annotations

if __name__ == "__main__":
    import uvicorn

    from app.banner import print_logo

    print_logo()
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
