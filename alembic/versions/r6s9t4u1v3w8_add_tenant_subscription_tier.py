"""add_tenant_subscription_tier

Revision ID: r6s9t4u1v3w8
Revises: q5r8s3t9u2v7
Create Date: 2026-07-25

Adds subscription_tier to tenants so SaaS-provisioned tenants (starter/pro/
enterprise) can be billed and feature-gated per tier, not just tracked as
generic white-label configs.
"""

import sqlalchemy as sa

from alembic import op

revision = "r6s9t4u1v3w8"
down_revision = "q5r8s3t9u2v7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("tenants")]
    if "subscription_tier" not in columns:
        op.add_column(
            "tenants",
            sa.Column("subscription_tier", sa.String(length=20), nullable=False, server_default="starter"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns("tenants")]
    if "subscription_tier" in columns:
        op.drop_column("tenants", "subscription_tier")
