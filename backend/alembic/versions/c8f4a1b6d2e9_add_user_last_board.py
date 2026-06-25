"""add users.last_board_id (remember last-opened board per user)

So a fresh browser / cleared cache reopens the board the user last had open,
instead of falling back to the first board. No FK -- a stale id just falls back
on the client.

Revision ID: c8f4a1b6d2e9
Revises: b5e2f8c1d3a6
Create Date: 2026-06-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8f4a1b6d2e9'
down_revision: Union[str, None] = 'b5e2f8c1d3a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite recreates the table; on Postgres it's a plain ALTER.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('last_board_id', sa.Uuid(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('last_board_id')
