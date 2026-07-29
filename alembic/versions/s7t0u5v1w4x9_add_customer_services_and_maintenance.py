"""Add services and maintenance_agreement columns to customers

The Customers CRM UI (jworden-production /customers) captures, per customer,
the services they buy and the terms of any maintenance agreement. The Customer
model had no home for either, so those two fields were dropped on save. This
adds them as nullable Text columns — purely additive, nothing is altered or
dropped.

Revision ID: s7t0u5v1w4x9
Revises: r6s9t4u0v3w8
Create Date: 2026-07-29
"""

from alembic import op
import sqlalchemy as sa

revision = "s7t0u5v1w4x9"
down_revision = "r6s9t4u0v3w8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("services", sa.Text(), nullable=True))
    op.add_column("customers", sa.Column("maintenance_agreement", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("customers", "maintenance_agreement")
    op.drop_column("customers", "services")
