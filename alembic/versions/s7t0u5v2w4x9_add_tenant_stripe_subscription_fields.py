"""add_tenant_stripe_subscription_fields

Revision ID: s7t0u5v2w4x9
Revises: r6s9t4u1v3w8
Create Date: 2026-07-25

Adds Stripe customer/subscription tracking to tenants so SaaS-provisioned
tenants can actually be billed on a recurring basis, not just recorded.
"""

import sqlalchemy as sa

from alembic import op

revision = "s7t0u5v2w4x9"
down_revision = "r6s9t4u1v3w8"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    ("stripe_customer_id", sa.String(length=120), True, None),
    ("stripe_subscription_id", sa.String(length=120), True, None),
    ("subscription_status", sa.String(length=20), False, "pending_payment"),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("tenants")}
    for name, col_type, nullable, default in NEW_COLUMNS:
        if name not in existing:
            op.add_column(
                "tenants",
                sa.Column(name, col_type, nullable=nullable, server_default=default),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("tenants")}
    for name, _col_type, _nullable, _default in NEW_COLUMNS:
        if name in existing:
            op.drop_column("tenants", name)
