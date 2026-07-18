"""add categories table + folders/boards/shares.category_id, migrate JSON layout

Promotes categories from a per-user JSON blob (users.categories) into real,
shareable entities. Creates the `categories` table, adds a nullable category_id
FK to folders, boards and shares, then migrates each user's existing JSON
categories into rows (setting category_id on the folders/boards they own; items
they don't own -- shared items they'd filed in -- are left uncategorized, matching
how folder sharing works). users.categories is kept for now (harmless).

Revision ID: d4e5f6a7b8c9
Revises: e2f5a3c1d9b4
Create Date: 2026-07-17 00:00:00.000000
"""
import json
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Column, MetaData, Table


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'e2f5a3c1d9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_category_fk(table: str) -> None:
    # Batch mode so SQLite recreates the table (it can't ALTER ADD CONSTRAINT);
    # on Postgres this emits a plain ALTER. Matches the other FK-adding migrations.
    with op.batch_alter_table(table, schema=None) as batch_op:
        batch_op.add_column(sa.Column('category_id', sa.Uuid(), nullable=True))
        batch_op.create_foreign_key(
            f'fk_{table}_category_id', 'categories',
            ['category_id'], ['id'], ondelete='SET NULL' if table != 'shares' else 'CASCADE',
        )
    op.create_index(f'ix_{table}_category_id', table, ['category_id'], unique=False)


def upgrade() -> None:
    op.create_table(
        'categories',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('item_order', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_categories_owner_id', 'categories', ['owner_id'], unique=False)

    _add_category_fk('folders')
    _add_category_fk('boards')
    _add_category_fk('shares')

    # --- data migration: users.categories JSON -> categories rows ---
    bind = op.get_bind()
    md = MetaData()
    users = Table('users', md, Column('id', sa.Uuid()), Column('categories', sa.Text()))
    categories = Table(
        'categories', md,
        Column('id', sa.Uuid()), Column('name', sa.String(120)),
        Column('owner_id', sa.Uuid()), Column('position', sa.Integer()),
        Column('item_order', sa.Text()),
    )
    folders = Table('folders', md, Column('id', sa.Uuid()), Column('owner_id', sa.Uuid()), Column('category_id', sa.Uuid()))
    boards = Table('boards', md, Column('id', sa.Uuid()), Column('owner_id', sa.Uuid()), Column('category_id', sa.Uuid()))

    for uid, cats_json in bind.execute(sa.select(users.c.id, users.c.categories)).all():
        if not cats_json:
            continue
        try:
            data = json.loads(cats_json)
        except (ValueError, TypeError):
            continue
        cat_list = data.get('categories') if isinstance(data, dict) else None
        if not cat_list:
            continue
        owned_folders = set(bind.execute(sa.select(folders.c.id).where(folders.c.owner_id == uid)).scalars())
        owned_boards = set(bind.execute(sa.select(boards.c.id).where(boards.c.owner_id == uid)).scalars())
        for pos, cat in enumerate(cat_list):
            if not isinstance(cat, dict):
                continue
            items = cat.get('items') or []
            new_id = uuid.uuid4()
            bind.execute(categories.insert().values(
                id=new_id,
                name=(cat.get('name') or 'Category')[:120],
                owner_id=uid,
                position=pos,
                item_order=json.dumps(items),
            ))
            for item in items:
                try:
                    item_uuid = uuid.UUID(str(item))
                except (ValueError, AttributeError, TypeError):
                    continue
                if item_uuid in owned_folders:
                    bind.execute(sa.update(folders).where(folders.c.id == item_uuid).values(category_id=new_id))
                elif item_uuid in owned_boards:
                    bind.execute(sa.update(boards).where(boards.c.id == item_uuid).values(category_id=new_id))


def downgrade() -> None:
    for table in ('shares', 'boards', 'folders'):
        op.drop_index(f'ix_{table}_category_id', table_name=table)
        with op.batch_alter_table(table, schema=None) as batch_op:
            batch_op.drop_constraint(f'fk_{table}_category_id', type_='foreignkey')
            batch_op.drop_column('category_id')
    op.drop_index('ix_categories_owner_id', table_name='categories')
    op.drop_table('categories')
