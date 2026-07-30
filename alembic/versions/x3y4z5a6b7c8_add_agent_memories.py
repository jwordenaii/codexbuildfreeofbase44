"""add agent_memories table

Long-term memory for JARVIS. Until now his only persistent recall was
short_memory (a rolling session transcript) — long_memory.py was a Pinecone
shim with no key configured, so anything learned was lost when the session
ended.

Deliberately Postgres-only: tags plus a text index cover retrieval well enough
that adding a vector database would be a dependency without a payoff at this
size. Embeddings can be layered on later without changing this schema.

Purely additive: one new table, nothing existing is touched.

Revision ID: x3y4z5a6b7c8
Revises: w2x3y4z5a6b7
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "x3y4z5a6b7c8"
down_revision = "w2x3y4z5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_memories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=60), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False, server_default="context"),
        sa.Column("subject", sa.String(length=150), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tags", sa.String(length=300), nullable=True),
        sa.Column("source", sa.String(length=20), nullable=False, server_default="stated"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("importance", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("superseded_by", sa.Integer(), nullable=True),
        sa.Column("active", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_memories_id", "agent_memories", ["id"], unique=False)
    op.create_index("ix_agent_memories_tenant_id", "agent_memories", ["tenant_id"], unique=False)
    op.create_index("ix_agent_memories_kind", "agent_memories", ["kind"], unique=False)
    op.create_index("ix_agent_memories_subject", "agent_memories", ["subject"], unique=False)
    op.create_index("ix_agent_memories_active", "agent_memories", ["active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_agent_memories_active", table_name="agent_memories")
    op.drop_index("ix_agent_memories_subject", table_name="agent_memories")
    op.drop_index("ix_agent_memories_kind", table_name="agent_memories")
    op.drop_index("ix_agent_memories_tenant_id", table_name="agent_memories")
    op.drop_index("ix_agent_memories_id", table_name="agent_memories")
    op.drop_table("agent_memories")
