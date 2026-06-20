"""add folders and boards.folder_id

Revision ID: e7f8a9b0c1d2
Revises: d6e7a8b9c0d1
Create Date: 2026-06-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd6e7a8b9c0d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'folders',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_folders_owner_id', 'folders', ['owner_id'], unique=False)

    # Batch mode so SQLite (which cannot ALTER ADD CONSTRAINT) recreates the
    # table; on Postgres this emits a plain ALTER. Matches the project's other
    # FK-adding migrations.
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('folder_id', sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            'fk_boards_folder_id', 'folders', ['folder_id'], ['id'], ondelete='SET NULL'
        )
    op.create_index('ix_boards_folder_id', 'boards', ['folder_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_boards_folder_id', table_name='boards')
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_constraint('fk_boards_folder_id', type_='foreignkey')
        batch_op.drop_column('folder_id')
    op.drop_index('ix_folders_owner_id', table_name='folders')
    op.drop_table('folders')
