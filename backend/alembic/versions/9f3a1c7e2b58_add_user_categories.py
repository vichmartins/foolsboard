"""add users.categories (explorer layout)

Revision ID: 9f3a1c7e2b58
Revises: a1b2c3d4e5f6
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f3a1c7e2b58'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Per-user explorer layout (JSON list of categories). Null until set.
    op.add_column('users', sa.Column('categories', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'categories')
