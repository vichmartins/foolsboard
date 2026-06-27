"""add boards.is_template (mark a board as a reusable template)

Revision ID: f4b1a9c8d3e2
Revises: c8f4a1b6d2e9
Create Date: 2026-06-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b1a9c8d3e2'
down_revision: Union[str, None] = 'c8f4a1b6d2e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite recreates the table; on Postgres it's a plain ALTER.
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_template',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_column('is_template')
