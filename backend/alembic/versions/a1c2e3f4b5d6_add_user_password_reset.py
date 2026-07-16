"""add users.must_change_password + users.temp_password_expires_at

Lets an admin reset a user's password: either set one directly, or issue a
temporary password that expires and is single-use. must_change_password forces
the user to pick a new password on next sign-in; temp_password_expires_at bounds
how long an issued temp password stays valid.

Revision ID: a1c2e3f4b5d6
Revises: f4b1a9c8d3e2
Create Date: 2026-07-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, None] = 'f4b1a9c8d3e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch mode so SQLite recreates the table; on Postgres it's a plain ALTER.
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'must_change_password',
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(
            sa.Column(
                'temp_password_expires_at',
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('temp_password_expires_at')
        batch_op.drop_column('must_change_password')
