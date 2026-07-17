"""drop boards.shared_template_by_id (team templates feature removed)

Reverts the workspace-wide "team template" column added in c9e4f2a1b8d3; the
feature was removed. Personal (per-user) templates are unaffected.

Revision ID: e2f5a3c1d9b4
Revises: c9e4f2a1b8d3
Create Date: 2026-07-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f5a3c1d9b4'
down_revision: Union[str, None] = 'c9e4f2a1b8d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch so SQLite recreates the table without the column (dropping its index +
    # FK); on Postgres it's a plain DROP COLUMN that cascades them.
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_column('shared_template_by_id')


def downgrade() -> None:
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('shared_template_by_id', sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            'fk_boards_shared_template_by', 'users',
            ['shared_template_by_id'], ['id'], ondelete='SET NULL',
        )
        batch_op.create_index('ix_boards_shared_template_by_id', ['shared_template_by_id'])
