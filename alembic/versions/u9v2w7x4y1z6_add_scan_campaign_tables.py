"""add_scan_campaign_tables

Revision ID: u9v2w7x4y1z6
Revises: t8u1v6w3x9y4
Create Date: 2026-07-25

Adds the ZIP-code property scan -> direct-mail campaign pipeline tables,
ported from NewRepo's Worden Standard prototype (Regrid parcel lookup ->
Google Maps satellite imagery -> GPT-4o Vision condition assessment ->
pricing estimate -> mailer HTML -> optional Lob physical mail send).
See app/tasks/scan_tasks.py for the pipeline and app/routers/scan_campaign.py
for the CRUD/run/export endpoints.
"""

import sqlalchemy as sa

from alembic import op

revision = "u9v2w7x4y1z6"
down_revision = "t8u1v6w3x9y4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "scan_campaigns" not in existing_tables:
        op.create_table(
            "scan_campaigns",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("zip_code", sa.String(length=10), nullable=False),
            sa.Column("label", sa.String(length=200), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("max_properties", sa.Integer(), nullable=False),
            sa.Column("auto_mail", sa.Boolean(), nullable=False),
            sa.Column("total_properties", sa.Integer(), nullable=False),
            sa.Column("scanned", sa.Integer(), nullable=False),
            sa.Column("mailed", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_scan_campaigns_id", "scan_campaigns", ["id"])
        op.create_index("ix_scan_campaigns_zip_code", "scan_campaigns", ["zip_code"])

    if "scan_properties" not in existing_tables:
        op.create_table(
            "scan_properties",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("campaign_id", sa.Integer(), nullable=False),
            sa.Column("parcel_id", sa.String(length=120), nullable=True),
            sa.Column("address", sa.String(length=256), nullable=False),
            sa.Column("city", sa.String(length=120), nullable=True),
            sa.Column("state", sa.String(length=2), nullable=True),
            sa.Column("zip_code", sa.String(length=10), nullable=True),
            sa.Column("owner_name", sa.String(length=200), nullable=True),
            sa.Column("owner_type", sa.String(length=40), nullable=True),
            sa.Column("land_use_code", sa.String(length=40), nullable=True),
            sa.Column("lot_size_sqft", sa.Float(), nullable=True),
            sa.Column("year_built", sa.Integer(), nullable=True),
            sa.Column("latitude", sa.Float(), nullable=True),
            sa.Column("longitude", sa.Float(), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_scan_properties_id", "scan_properties", ["id"])
        op.create_index("ix_scan_properties_campaign_id", "scan_properties", ["campaign_id"])
        op.create_index("ix_scan_properties_parcel_id", "scan_properties", ["parcel_id"])

    if "scan_results" not in existing_tables:
        op.create_table(
            "scan_results",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("property_id", sa.Integer(), nullable=False),
            sa.Column("roof_condition", sa.String(length=10), nullable=True),
            sa.Column("driveway_condition", sa.String(length=10), nullable=True),
            sa.Column("drainage_condition", sa.String(length=10), nullable=True),
            sa.Column("overall_score", sa.Integer(), nullable=True),
            sa.Column("condition_narrative", sa.Text(), nullable=True),
            sa.Column("services_recommended", sa.Text(), nullable=True),
            sa.Column("service_type", sa.String(length=80), nullable=True),
            sa.Column("estimated_sqft", sa.Float(), nullable=True),
            sa.Column("estimate_low", sa.Float(), nullable=True),
            sa.Column("estimate_high", sa.Float(), nullable=True),
            sa.Column("mailer_html", sa.Text(), nullable=True),
            sa.Column("lob_letter_id", sa.String(length=80), nullable=True),
            sa.Column("lob_status", sa.String(length=30), nullable=True),
            sa.Column("mailed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_scan_results_id", "scan_results", ["id"])
        op.create_index("ix_scan_results_property_id", "scan_results", ["property_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    if "scan_results" in existing_tables:
        op.drop_table("scan_results")
    if "scan_properties" in existing_tables:
        op.drop_table("scan_properties")
    if "scan_campaigns" in existing_tables:
        op.drop_table("scan_campaigns")
