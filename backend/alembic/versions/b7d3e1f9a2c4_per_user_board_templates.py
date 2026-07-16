"""per-user board templates

Replaces the global boards.is_template flag with a per-user board_templates
association, so a collaborator marking a shared board as their template no longer
stars it for everyone. Existing template flags are migrated to the board's owner
(the party that, in practice, set them).

Revision ID: b7d3e1f9a2c4
Revises: a1c2e3f4b5d6
Create Date: 2026-07-16 00:00:00.000000
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d3e1f9a2c4'
down_revision: Union[str, None] = 'a1c2e3f4b5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'board_templates',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('board_id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'board_id', name='uq_board_template_user_board'),
    )
    op.create_index('ix_board_templates_user_id', 'board_templates', ['user_id'])
    op.create_index('ix_board_templates_board_id', 'board_templates', ['board_id'])

    # Migrate existing global templates to their owner (the likely setter). Boards
    # without an owner are dropped -- there's no account to attribute them to.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, owner_id FROM boards WHERE is_template = true AND owner_id IS NOT NULL")
    ).fetchall()
    if rows:
        tbl = sa.table(
            'board_templates',
            sa.column('id', sa.Uuid()),
            sa.column('user_id', sa.Uuid()),
            sa.column('board_id', sa.Uuid()),
        )
        op.bulk_insert(
            tbl,
            [{'id': uuid.uuid4(), 'user_id': r.owner_id, 'board_id': r.id} for r in rows],
        )

    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.drop_column('is_template')


def downgrade() -> None:
    with op.batch_alter_table('boards', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('is_template', sa.Boolean(), nullable=False, server_default=sa.false())
        )
    op.drop_index('ix_board_templates_board_id', table_name='board_templates')
    op.drop_index('ix_board_templates_user_id', table_name='board_templates')
    op.drop_table('board_templates')
