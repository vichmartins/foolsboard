"""add asset content_hash

Revision ID: d4a7c2e1f093
Revises: c3e8a91f5b22
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4a7c2e1f093'
down_revision: Union[str, None] = 'c3e8a91f5b22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('content_hash', sa.String(length=64), nullable=True))
        batch_op.create_index(batch_op.f('ix_assets_content_hash'), ['content_hash'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assets_content_hash'))
        batch_op.drop_column('content_hash')
