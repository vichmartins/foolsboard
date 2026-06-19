"""add asset processing flag

Revision ID: c3e8a91f5b22
Revises: b7f3c1d92a40
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3e8a91f5b22'
down_revision: Union[str, None] = 'b7f3c1d92a40'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'processing',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_column('processing')
