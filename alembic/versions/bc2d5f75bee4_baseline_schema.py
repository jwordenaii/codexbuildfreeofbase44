"""baseline_schema

Initial migration baseline.
For existing deployments, stamp this revision before applying new migrations.

Revision ID: bc2d5f75bee4
Revises: 
Create Date: 2026-04-27 00:27:30.514847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc2d5f75bee4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # baseline marker migration (no-op for existing schema)
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # baseline marker migration (no-op for existing schema)
    pass
