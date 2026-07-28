"""Add users, market_sites, inbox_messages and the six LMS tables

These eight tables existed only in genewgeorge76/jworden-production, whose
backend was never deployed. Ported here on 2026-07-28 along with 12 routers,
6 services and app/jarvis_os, so that one backend carries everything.

The two schemas nested cleanly — 66 tables there, 58 here, zero unique to this
side — so this migration is purely additive. Nothing is dropped or altered.

Written against the model metadata rather than copied from that repo's own
migrations: its revision chain does not join this one, and grafting a foreign
down_revision would break `alembic upgrade head`. Three of its migrations have
no counterpart here (starbase LMS, estimate portal fields, mapbox geo fields);
the LMS tables are recreated below, the other two touch tables this branch
already has.

Note that users / market_sites / inbox_messages had no migration in any repo —
they only ever came into being via AUTO_CREATE_TABLES. This is the first time
they are expressed as a migration.

Revision ID: r6s9t4u0v3w8
Revises: q5r8s3t9u2v7
Create Date: 2026-07-28
"""

from alembic import op
import sqlalchemy as sa

revision = "r6s9t4u0v3w8"
down_revision = "q5r8s3t9u2v7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(length=60), sa.ForeignKey('tenants.tenant_id'), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('hashed_password', sa.String(length=200), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=True),
        sa.Column('role', sa.String(length=30), nullable=False),
        sa.Column('is_active', sa.Integer(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=False)
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_tenant_id', 'users', ['tenant_id'], unique=False)
    op.create_table(
        'market_sites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.String(length=60), nullable=False),
        sa.Column('hostname', sa.String(length=200), nullable=False),
        sa.Column('route_mode', sa.String(length=50), nullable=False),
        sa.Column('site_title', sa.String(length=200), nullable=True),
        sa.Column('site_description', sa.Text(), nullable=True),
        sa.Column('primary_color', sa.String(length=20), nullable=True),
        sa.Column('accent_color', sa.String(length=20), nullable=True),
        sa.Column('hero_headline', sa.String(length=300), nullable=True),
        sa.Column('hero_subheadline', sa.Text(), nullable=True),
        sa.Column('local_weather_copy', sa.Text(), nullable=True),
        sa.Column('city_target', sa.String(length=100), nullable=True),
        sa.Column('state_target', sa.String(length=2), nullable=True),
        sa.Column('phone_override', sa.String(length=30), nullable=True),
        sa.Column('is_active', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hostname'),
    )
    op.create_index('ix_market_sites_hostname', 'market_sites', ['hostname'], unique=False)
    op.create_index('ix_market_sites_id', 'market_sites', ['id'], unique=False)
    op.create_index('ix_market_sites_tenant_id', 'market_sites', ['tenant_id'], unique=False)
    op.create_table(
        'inbox_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_account', sa.String(length=254), nullable=False),
        sa.Column('sender_name', sa.String(length=120), nullable=True),
        sa.Column('sender_email', sa.String(length=254), nullable=False),
        sa.Column('subject', sa.String(length=500), nullable=True),
        sa.Column('body_summary', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=60), nullable=False),
        sa.Column('importance_score', sa.Integer(), nullable=False),
        sa.Column('is_lead', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inbox_messages_email_account', 'inbox_messages', ['email_account'], unique=False)
    op.create_index('ix_inbox_messages_id', 'inbox_messages', ['id'], unique=False)
    op.create_table(
        'lms_courses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('slug', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('difficulty', sa.String(length=50), nullable=False),
        sa.Column('estimated_hours', sa.Float(), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=True),
        sa.Column('tenant_id', sa.String(length=60), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_lms_courses_id', 'lms_courses', ['id'], unique=False)
    op.create_index('ix_lms_courses_slug', 'lms_courses', ['slug'], unique=True)
    op.create_index('ix_lms_courses_tenant_id', 'lms_courses', ['tenant_id'], unique=False)
    op.create_table(
        'lms_course_modules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('lms_courses.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_lms_course_modules_course_id', 'lms_course_modules', ['course_id'], unique=False)
    op.create_index('ix_lms_course_modules_id', 'lms_course_modules', ['id'], unique=False)
    op.create_table(
        'lms_lessons',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), sa.ForeignKey('lms_course_modules.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('video_url', sa.String(length=500), nullable=True),
        sa.Column('body_markdown', sa.Text(), nullable=True),
        sa.Column('quiz_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_lms_lessons_id', 'lms_lessons', ['id'], unique=False)
    op.create_index('ix_lms_lessons_module_id', 'lms_lessons', ['module_id'], unique=False)
    op.create_table(
        'lms_enrollments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('lms_courses.id'), nullable=False),
        sa.Column('user_email', sa.String(length=254), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('certificate_url', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'user_email'),
    )
    op.create_index('ix_lms_enrollments_course_id', 'lms_enrollments', ['course_id'], unique=False)
    op.create_index('ix_lms_enrollments_id', 'lms_enrollments', ['id'], unique=False)
    op.create_index('ix_lms_enrollments_user_email', 'lms_enrollments', ['user_email'], unique=False)
    op.create_table(
        'lms_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('enrollment_id', sa.Integer(), sa.ForeignKey('lms_enrollments.id'), nullable=False),
        sa.Column('lesson_id', sa.Integer(), sa.ForeignKey('lms_lessons.id'), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('enrollment_id', 'lesson_id'),
    )
    op.create_index('ix_lms_progress_enrollment_id', 'lms_progress', ['enrollment_id'], unique=False)
    op.create_index('ix_lms_progress_id', 'lms_progress', ['id'], unique=False)
    op.create_index('ix_lms_progress_lesson_id', 'lms_progress', ['lesson_id'], unique=False)


def downgrade() -> None:

    op.drop_table('lms_progress')
    op.drop_table('lms_enrollments')
    op.drop_table('lms_lessons')
    op.drop_table('lms_course_modules')
    op.drop_table('lms_courses')
    op.drop_table('inbox_messages')
    op.drop_table('market_sites')
    op.drop_table('users')
