"""add asset thumbnail_key

Revision ID: b7f3c1d92a40
Revises: ea52beab42d6
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7f3c1d92a40'
down_revision: Union[str, None] = 'ea52beab42d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('thumbnail_key', sa.String(length=500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_column('thumbnail_key')
