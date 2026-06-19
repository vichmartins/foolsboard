"""add boards.position for manual ordering

Revision ID: c5d6e7f8a9b0
Revises: b2c3d4e5f6a7
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows default to 0; the list still orders them by created_at as a
    # tiebreaker, so current ordering is preserved until the user reorders.
    op.add_column(
        'boards',
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('boards', 'position')
