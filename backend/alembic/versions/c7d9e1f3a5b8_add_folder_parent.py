"""add folders.parent_folder_id (nested folders)

Revision ID: c7d9e1f3a5b8
Revises: 9f3a1c7e2b58
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7d9e1f3a5b8'
down_revision: Union[str, None] = '9f3a1c7e2b58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite recreates the table; on Postgres it's a plain ALTER.
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.add_column(sa.Column('parent_folder_id', sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            'fk_folders_parent_folder_id', 'folders', ['parent_folder_id'], ['id'],
            ondelete='SET NULL',
        )
    op.create_index('ix_folders_parent_folder_id', 'folders', ['parent_folder_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_folders_parent_folder_id', 'folders')
    with op.batch_alter_table('folders', schema=None) as batch_op:
        batch_op.drop_constraint('fk_folders_parent_folder_id', type_='foreignkey')
        batch_op.drop_column('parent_folder_id')
