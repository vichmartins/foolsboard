"""add users.color

Revision ID: a1b2c3d4e5f6
Revises: f8a9b0c1d2e3
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: existing users fall back to their deterministic palette color
    # until they choose one (backfilled on startup).
    op.add_column('users', sa.Column('color', sa.String(length=7), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'color')
