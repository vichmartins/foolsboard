"""One-off migration: copy all foolsboard data from a SQLite database into a
Postgres database.

The target's schema must already exist (run ``alembic upgrade head`` against it
first). Rows are copied table-by-table in foreign-key dependency order, so the
target should be empty. SQLAlchemy converts each column's Python value between
dialects (UUID, JSON, timestamps, booleans), so no manual type juggling.

Usage (from backend/, with the app virtualenv):
    python -m scripts.sqlite_to_postgres <sqlite_url> <postgres_url>

Example:
    python -m scripts.sqlite_to_postgres \\
        sqlite:////var/lib/foolsboard/foolsboard.db \\
        postgresql+psycopg://foolsboard:PASS@localhost:5432/foolsboard
"""
from __future__ import annotations

import sys

from sqlalchemy import create_engine, insert, select

from app.database import Base
import app.models  # noqa: F401  -- registers every table on Base.metadata


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: python -m scripts.sqlite_to_postgres <sqlite_url> <postgres_url>")

    src = create_engine(sys.argv[1])
    dst = create_engine(sys.argv[2])

    total = 0
    with src.connect() as s, dst.begin() as d:
        for table in Base.metadata.sorted_tables:  # parents before children
            rows = [dict(r._mapping) for r in s.execute(select(table))]
            if rows:
                d.execute(insert(table), rows)
            total += len(rows)
            print(f"  {table.name}: {len(rows)} rows")
    print(f"done -- copied {total} rows")


if __name__ == "__main__":
    main()
