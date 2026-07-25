"""add_tenant_trial_and_billing_events

Revision ID: t8u1v6w3x9y4
Revises: s7t0u5v2w4x9
Create Date: 2026-07-25

Ports the admin-visibility fields and audit trail that existed in the
NewRepo saas_billing.py prototype but were never carried into the live
factory.py: trial period tracking, custom domain, per-tenant feature
flags, and a Stripe billing event log for MRR/ARR reporting.
"""

import sqlalchemy as sa

from alembic import op

revision = "t8u1v6w3x9y4"
down_revision = "s7t0u5v2w4x9"
branch_labels = None
depends_on = None

NEW_TENANT_COLUMNS = [
    ("trial_ends_at", sa.DateTime(timezone=True), True, None),
    ("current_period_end", sa.DateTime(timezone=True), True, None),
    ("custom_domain", sa.String(length=200), True, None),
    ("feature_flags", sa.Text(), True, None),
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("tenants")}
    for name, col_type, nullable, default in NEW_TENANT_COLUMNS:
        if name not in existing:
            op.add_column(
                "tenants",
                sa.Column(name, col_type, nullable=nullable, server_default=default),
            )

    existing_tables = set(inspector.get_table_names())
    if "tenant_billing_events" not in existing_tables:
        op.create_table(
            "tenant_billing_events",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("tenant_id", sa.Integer(), nullable=False, index=True),
            sa.Column("stripe_event_id", sa.String(length=120), nullable=False, unique=True),
            sa.Column("event_type", sa.String(length=100), nullable=False),
            sa.Column("amount_cents", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=True),
            sa.Column("raw_json", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    if "tenant_billing_events" in existing_tables:
        op.drop_table("tenant_billing_events")

    existing = {c["name"] for c in inspector.get_columns("tenants")}
    for name, _col_type, _nullable, _default in NEW_TENANT_COLUMNS:
        if name in existing:
            op.drop_column("tenants", name)
