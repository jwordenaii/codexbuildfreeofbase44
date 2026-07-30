"""add appointments table

Appointments are distinct from follow_up_tasks: a follow-up is an automated
nudge tied to a lead, while an appointment is a commitment a human agreed to
be at — it may have no lead behind it, and it needs a place, a time window and
an attendee. Jarvis creates and reads these on the operator's behalf.

Purely additive: creates one new table, touches nothing existing.

Revision ID: w2x3y4z5a6b7
Revises: v1w2x3y4z5a6
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "w2x3y4z5a6b7"
down_revision = "v1w2x3y4z5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=60), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("location", sa.String(length=300), nullable=True),
        sa.Column("customer_name", sa.String(length=150), nullable=True),
        sa.Column("customer_phone", sa.String(length=40), nullable=True),
        sa.Column("customer_email", sa.String(length=200), nullable=True),
        sa.Column("appointment_type", sa.String(length=30), nullable=False, server_default="estimate"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="scheduled"),
        sa.Column("lead_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_appointments_id", "appointments", ["id"], unique=False)
    op.create_index("ix_appointments_starts_at", "appointments", ["starts_at"], unique=False)
    op.create_index("ix_appointments_tenant_id", "appointments", ["tenant_id"], unique=False)
    op.create_index("ix_appointments_lead_id", "appointments", ["lead_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_appointments_lead_id", table_name="appointments")
    op.drop_index("ix_appointments_tenant_id", table_name="appointments")
    op.drop_index("ix_appointments_starts_at", table_name="appointments")
    op.drop_index("ix_appointments_id", table_name="appointments")
    op.drop_table("appointments")
