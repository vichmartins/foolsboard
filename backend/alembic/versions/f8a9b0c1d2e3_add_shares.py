"""add shares table

Revision ID: f8a9b0c1d2e3
Revises: e7f8a9b0c1d2
Create Date: 2026-06-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'shares',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('board_id', sa.Uuid(), nullable=True),
        sa.Column('folder_id', sa.Uuid(), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('shared_with_id', sa.Uuid(), nullable=False),
        sa.Column('permission', sa.String(length=10), nullable=False, server_default='edit'),
        sa.Column('status', sa.String(length=10), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['folder_id'], ['folders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['shared_with_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_shares_board_id', 'shares', ['board_id'], unique=False)
    op.create_index('ix_shares_folder_id', 'shares', ['folder_id'], unique=False)
    op.create_index('ix_shares_owner_id', 'shares', ['owner_id'], unique=False)
    op.create_index('ix_shares_shared_with_id', 'shares', ['shared_with_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_shares_shared_with_id', table_name='shares')
    op.drop_index('ix_shares_owner_id', table_name='shares')
    op.drop_index('ix_shares_folder_id', table_name='shares')
    op.drop_index('ix_shares_board_id', table_name='shares')
    op.drop_table('shares')
