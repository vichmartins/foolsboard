"""add users, invite_codes, and board owner

Revision ID: f1a2b3c4d5e6
Revises: d4a7c2e1f093
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'd4a7c2e1f093'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=320), nullable=False),
        sa.Column('username', sa.String(length=60), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False),
        sa.Column('avatar_key', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    op.create_table(
        'invite_codes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('created_by_id', sa.Uuid(), nullable=False),
        sa.Column('used_by_id', sa.Uuid(), nullable=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['used_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invite_codes_code', 'invite_codes', ['code'], unique=True)

    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('owner_id', sa.Uuid(), nullable=True))
        batch_op.create_index('ix_boards_owner_id', ['owner_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_boards_owner_id_users', 'users', ['owner_id'], ['id'], ondelete='CASCADE'
        )


def downgrade() -> None:
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_constraint('fk_boards_owner_id_users', type_='foreignkey')
        batch_op.drop_index('ix_boards_owner_id')
        batch_op.drop_column('owner_id')
    op.drop_index('ix_invite_codes_code', table_name='invite_codes')
    op.drop_table('invite_codes')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
