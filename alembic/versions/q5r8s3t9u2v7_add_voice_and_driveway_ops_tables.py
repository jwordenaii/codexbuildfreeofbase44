"""add_voice_and_driveway_ops_tables

Revision ID: q5r8s3t9u2v7
Revises: p4n7q2r8s1t6
Create Date: 2026-05-26

Adds durable persistence for ambient voice review events and driveway growth
campaign/opt-in records, including idempotency support for retry-safe writes.
"""

import sqlalchemy as sa

from alembic import op

revision = "q5r8s3t9u2v7"
down_revision = "p4n7q2r8s1t6"
branch_labels = None
depends_on = None


def _column_names(inspector, table_name: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table_name)}


def _index_names(inspector, table_name: str) -> set[str]:
    return {index["name"] for index in inspector.get_indexes(table_name)}


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "voice_review_events" not in existing_tables:
        op.create_table(
            "voice_review_events",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("event_id", sa.String(length=80), nullable=False),
            sa.Column("project_id", sa.String(length=128), nullable=False),
            sa.Column("site_id", sa.String(length=128), nullable=False),
            sa.Column("zone_id", sa.String(length=128), nullable=True),
            sa.Column("trade_id", sa.String(length=128), nullable=True),
            sa.Column("speaker_id", sa.String(length=128), nullable=True),
            sa.Column("speaker_role", sa.String(length=40), nullable=False),
            sa.Column("transcript_text", sa.Text(), nullable=False),
            sa.Column("event_type", sa.String(length=40), nullable=False),
            sa.Column("event_confidence", sa.Float(), nullable=False),
            sa.Column("risk_signal", sa.Boolean(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("reviewed_by", sa.String(length=128), nullable=True),
            sa.Column("review_note", sa.String(length=1024), nullable=True),
            sa.Column("reviewed_at_utc", sa.DateTime(timezone=True), nullable=True),
            sa.Column("source", sa.String(length=40), nullable=False),
            sa.Column("source_audio_uri", sa.String(length=1024), nullable=True),
            sa.Column("captured_at_utc", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at_utc", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_voice_review_events_id", "voice_review_events", ["id"])
        op.create_index(
            "ix_voice_review_events_event_id",
            "voice_review_events",
            ["event_id"],
            unique=True,
        )
        op.create_index(
            "ix_voice_review_events_project_id", "voice_review_events", ["project_id"]
        )
        op.create_index(
            "ix_voice_review_events_site_id", "voice_review_events", ["site_id"]
        )
        op.create_index(
            "ix_voice_review_events_status", "voice_review_events", ["status"]
        )

    if "driveway_campaign_pieces" not in existing_tables:
        op.create_table(
            "driveway_campaign_pieces",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("campaign_id", sa.String(length=40), nullable=False),
            sa.Column("campaign_name", sa.String(length=120), nullable=False),
            sa.Column("source", sa.String(length=40), nullable=False),
            sa.Column("property_id", sa.String(length=128), nullable=False),
            sa.Column("owner_name", sa.String(length=128), nullable=False),
            sa.Column("mailing_address", sa.String(length=256), nullable=False),
            sa.Column("address", sa.String(length=256), nullable=False),
            sa.Column("state", sa.String(length=2), nullable=False),
            sa.Column("estimated_total_usd", sa.Integer(), nullable=False),
            sa.Column("satellite_image_url", sa.String(length=1024), nullable=True),
            sa.Column("polygon_overlay_geojson", sa.Text(), nullable=True),
            sa.Column("token", sa.String(length=64), nullable=False),
            sa.Column("landing_url", sa.String(length=256), nullable=False),
            sa.Column("qr_payload", sa.String(length=256), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("idempotency_key", sa.String(length=128), nullable=True),
            sa.Column("created_at_utc", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_driveway_campaign_pieces_id", "driveway_campaign_pieces", ["id"]
        )
        op.create_index(
            "ix_driveway_campaign_pieces_campaign_id",
            "driveway_campaign_pieces",
            ["campaign_id"],
        )
        op.create_index(
            "ix_driveway_campaign_pieces_property_id",
            "driveway_campaign_pieces",
            ["property_id"],
        )
        op.create_index(
            "ix_driveway_campaign_pieces_token",
            "driveway_campaign_pieces",
            ["token"],
            unique=True,
        )
        op.create_index(
            "ix_driveway_campaign_pieces_idempotency_key",
            "driveway_campaign_pieces",
            ["idempotency_key"],
        )
    else:
        columns = _column_names(inspector, "driveway_campaign_pieces")
        indexes = _index_names(inspector, "driveway_campaign_pieces")
        if "idempotency_key" not in columns:
            op.add_column(
                "driveway_campaign_pieces",
                sa.Column("idempotency_key", sa.String(length=128), nullable=True),
            )
        if "ix_driveway_campaign_pieces_idempotency_key" not in indexes:
            op.create_index(
                "ix_driveway_campaign_pieces_idempotency_key",
                "driveway_campaign_pieces",
                ["idempotency_key"],
            )

    if "driveway_opt_ins" not in existing_tables:
        op.create_table(
            "driveway_opt_ins",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("token", sa.String(length=64), nullable=False),
            sa.Column("property_id", sa.String(length=128), nullable=False),
            sa.Column("full_name", sa.String(length=128), nullable=False),
            sa.Column("email", sa.String(length=254), nullable=False),
            sa.Column("phone", sa.String(length=32), nullable=False),
            sa.Column("consent_email", sa.Boolean(), nullable=False),
            sa.Column("consent_sms", sa.Boolean(), nullable=False),
            sa.Column("consent_tcpa", sa.Boolean(), nullable=False),
            sa.Column(
                "consent_timestamp_utc", sa.DateTime(timezone=True), nullable=False
            ),
            sa.Column("source", sa.String(length=40), nullable=False),
            sa.Column("idempotency_key", sa.String(length=128), nullable=True),
            sa.Column("created_at_utc", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_driveway_opt_ins_id", "driveway_opt_ins", ["id"])
        op.create_index(
            "ix_driveway_opt_ins_token", "driveway_opt_ins", ["token"], unique=True
        )
        op.create_index(
            "ix_driveway_opt_ins_property_id", "driveway_opt_ins", ["property_id"]
        )
        op.create_index("ix_driveway_opt_ins_email", "driveway_opt_ins", ["email"])
        op.create_index(
            "ix_driveway_opt_ins_idempotency_key",
            "driveway_opt_ins",
            ["idempotency_key"],
        )
    else:
        columns = _column_names(inspector, "driveway_opt_ins")
        indexes = _index_names(inspector, "driveway_opt_ins")
        if "idempotency_key" not in columns:
            op.add_column(
                "driveway_opt_ins",
                sa.Column("idempotency_key", sa.String(length=128), nullable=True),
            )
        if "ix_driveway_opt_ins_idempotency_key" not in indexes:
            op.create_index(
                "ix_driveway_opt_ins_idempotency_key",
                "driveway_opt_ins",
                ["idempotency_key"],
            )
        if "ix_driveway_opt_ins_token" not in indexes:
            op.create_index(
                "ix_driveway_opt_ins_token",
                "driveway_opt_ins",
                ["token"],
                unique=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = set(inspector.get_table_names())

    if "driveway_opt_ins" in existing_tables:
        indexes = _index_names(inspector, "driveway_opt_ins")
        for idx in [
            "ix_driveway_opt_ins_idempotency_key",
            "ix_driveway_opt_ins_email",
            "ix_driveway_opt_ins_property_id",
            "ix_driveway_opt_ins_token",
            "ix_driveway_opt_ins_id",
        ]:
            if idx in indexes:
                op.drop_index(idx, table_name="driveway_opt_ins")
        op.drop_table("driveway_opt_ins")

    if "driveway_campaign_pieces" in existing_tables:
        indexes = _index_names(inspector, "driveway_campaign_pieces")
        for idx in [
            "ix_driveway_campaign_pieces_idempotency_key",
            "ix_driveway_campaign_pieces_token",
            "ix_driveway_campaign_pieces_property_id",
            "ix_driveway_campaign_pieces_campaign_id",
            "ix_driveway_campaign_pieces_id",
        ]:
            if idx in indexes:
                op.drop_index(idx, table_name="driveway_campaign_pieces")
        op.drop_table("driveway_campaign_pieces")

    if "voice_review_events" in existing_tables:
        indexes = _index_names(inspector, "voice_review_events")
        for idx in [
            "ix_voice_review_events_status",
            "ix_voice_review_events_site_id",
            "ix_voice_review_events_project_id",
            "ix_voice_review_events_event_id",
            "ix_voice_review_events_id",
        ]:
            if idx in indexes:
                op.drop_index(idx, table_name="voice_review_events")
        op.drop_table("voice_review_events")
