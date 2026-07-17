"""add boards.shared_template_by_id (workspace/team templates)

A board with a non-null shared_template_by_id is published as a team template
that anyone in the workspace can start a copy from; the value is who published it.

Revision ID: c9e4f2a1b8d3
Revises: b7d3e1f9a2c4
Create Date: 2026-07-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e4f2a1b8d3'
down_revision: Union[str, None] = 'b7d3e1f9a2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite recreates the table with the FK; plain ALTER on Postgres.
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('shared_template_by_id', sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            'fk_boards_shared_template_by', 'users',
            ['shared_template_by_id'], ['id'], ondelete='SET NULL',
        )
        batch_op.create_index('ix_boards_shared_template_by_id', ['shared_template_by_id'])


def downgrade() -> None:
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_index('ix_boards_shared_template_by_id')
        batch_op.drop_constraint('fk_boards_shared_template_by', type_='foreignkey')
        batch_op.drop_column('shared_template_by_id')
