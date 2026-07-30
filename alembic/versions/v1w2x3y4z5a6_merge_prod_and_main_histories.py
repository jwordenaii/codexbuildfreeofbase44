"""merge production and main migration histories

Background
----------
The migration history forked at ``q5r8s3t9u2v7`` and the two sides were never
rejoined:

* **Applied to production** (deployed from a branch that was never merged):
  ``r6s9t4u1v3w8`` -> ``s7t0u5v2w4x9`` -> ``t8u1v6w3x9y4`` -> ``u9v2w7x4y1z6``
  (tenant subscription tier, tenant Stripe fields, tenant trial/billing events,
  scan campaign tables). The production DB's ``alembic_version`` sits at
  ``u9v2w7x4y1z6``.

* **Present in main, never applied to production:**
  ``r6s9t4u0v3w8`` -> ``s7t0u5v1w4x9`` (users / market_sites / LMS tables, and
  the customers.services + customers.maintenance_agreement columns).

Because main did not contain the four production-side files, ``alembic upgrade
head`` failed on deploy with "Can't locate revision identified by
'u9v2w7x4y1z6'" and Fly aborted the release. Those four files have now been
restored, which leaves two heads; this revision merges them.

Safety
------
Verified against the live database before writing this: the objects created by
the main-side branch (``users``, ``market_sites``, ``inbox_messages``,
``lms_courses``, ``lms_course_modules``, ``lms_lessons``, ``lms_enrollments``,
``lms_progress``, and the two ``customers`` columns) are all ABSENT from
production, and the production-side objects are all PRESENT. The two sides
touch disjoint objects, so replaying the main-side branch on production is
purely additive — no table or column is created twice and nothing is dropped.

This revision itself is a no-op merge point: it only rejoins the graph.
"""

from __future__ import annotations

from alembic import op  # noqa: F401  (imported for consistency with other revisions)
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision = "v1w2x3y4z5a6"
down_revision = ("u9v2w7x4y1z6", "s7t0u5v1w4x9")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No schema change — this revision exists only to join the two branches."""


def downgrade() -> None:
    """No schema change — splitting the history back apart is not meaningful."""
