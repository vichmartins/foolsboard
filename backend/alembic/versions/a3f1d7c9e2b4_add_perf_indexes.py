"""performance indexes: assets.storage_key/thumbnail_key + logs.created_at

Adds the indexes that back hot queries:
- assets.storage_key / thumbnail_key: every media delete checks "any other asset
  still references this file?" before removing it (dedup-safe cleanup). Without
  an index that's a full scan of the assets table on each delete.
- {activity,request,error}_logs.created_at: the admin log views ORDER BY
  created_at DESC; request_logs grows on every API request, so an unindexed sort
  degrades as it fills up.

create_index is plain DDL on both Postgres and SQLite (no batch needed).

Revision ID: a3f1d7c9e2b4
Revises: c7d9e1f3a5b8
Create Date: 2026-06-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a3f1d7c9e2b4'
down_revision: Union[str, None] = 'c7d9e1f3a5b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_assets_storage_key', 'assets', ['storage_key'], unique=False)
    op.create_index('ix_assets_thumbnail_key', 'assets', ['thumbnail_key'], unique=False)
    op.create_index('ix_activity_logs_created_at', 'activity_logs', ['created_at'], unique=False)
    op.create_index('ix_request_logs_created_at', 'request_logs', ['created_at'], unique=False)
    op.create_index('ix_error_logs_created_at', 'error_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_error_logs_created_at', 'error_logs')
    op.drop_index('ix_request_logs_created_at', 'request_logs')
    op.drop_index('ix_activity_logs_created_at', 'activity_logs')
    op.drop_index('ix_assets_thumbnail_key', 'assets')
    op.drop_index('ix_assets_storage_key', 'assets')
