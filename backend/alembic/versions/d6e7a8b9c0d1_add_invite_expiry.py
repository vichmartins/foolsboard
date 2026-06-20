"""add invite_codes.expires_at

Revision ID: d6e7a8b9c0d1
Revises: c5d6e7f8a9b0
Create Date: 2026-06-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6e7a8b9c0d1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: existing codes have no expiry (treated as never-expiring).
    op.add_column(
        'invite_codes',
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('invite_codes', 'expires_at')
