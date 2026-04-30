"""
monitoring_service.py — Datadog metrics + Slack alert integration.

Provides three core capabilities:
  1. send_slack_alert(title, message, severity)  — POST to SLACK_WEBHOOK_URL
  2. log_metric(metric_name, value, tags)         — Ship gauge to Datadog
  3. log_error(error_type, message, context)      — Ship error event to Datadog

All methods fail silently (log a warning) when the required env vars are not
set, so the API continues to function without monitoring configured.

Environment variables:
  DATADOG_API_KEY   — Datadog API key (required for Datadog features)
  SLACK_WEBHOOK_URL — Incoming webhook URL (required for Slack alerts)
  DATADOG_APP_KEY   — Datadog application key (optional, for management API)
  DD_ENV            — Datadog environment tag (default: "production")
  DD_SERVICE        — Datadog service tag (default: "jworden-api")
  DD_VERSION        — Datadog version tag (default: RAILWAY_GIT_COMMIT_SHA or "unknown")
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ── Severity colour map for Slack attachments ─────────────────────────────────
_SEVERITY_COLOURS = {
    "critical": "#FF0000",   # red
    "error":    "#FF4500",   # orange-red
    "warning":  "#FFA500",   # orange
    "info":     "#36A64F",   # green
}

# ── Datadog metric type constants ─────────────────────────────────────────────
_DD_GAUGE = "gauge"
_DD_COUNT = "count"


class MonitoringService:
    """
    Thin wrapper around the Datadog HTTP API and Slack incoming webhooks.

    Instantiate once at module level (see bottom of this file) and import
    the singleton ``monitoring`` wherever alerts or metrics are needed.
    """

    def __init__(self) -> None:
        self._dd_api_key: str = os.getenv("DATADOG_API_KEY", "").strip()
        self._slack_webhook: str = os.getenv("SLACK_WEBHOOK_URL", "").strip()
        self._dd_env: str = os.getenv("DD_ENV", "production")
        self._dd_service: str = os.getenv("DD_SERVICE", "jworden-api")
        self._dd_version: str = os.getenv(
            "DD_VERSION",
            os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown"),
        )

        if self._dd_api_key:
            self._init_datadog()
        else:
            logger.info(
                "MonitoringService: DATADOG_API_KEY not set — Datadog metrics disabled"
            )

        if not self._slack_webhook:
            logger.info(
                "MonitoringService: SLACK_WEBHOOK_URL not set — Slack alerts disabled"
            )

    # ── Datadog initialisation ────────────────────────────────────────────────

    def _init_datadog(self) -> None:
        """Initialise the datadog library with the API key."""
        try:
            from datadog import initialize  # type: ignore  # noqa: PLC0415

            initialize(api_key=self._dd_api_key)
            logger.info(
                "MonitoringService: Datadog initialised (env=%s service=%s)",
                self._dd_env,
                self._dd_service,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("MonitoringService: Datadog init failed: %s", exc)

    # ── Public API ────────────────────────────────────────────────────────────

    def send_slack_alert(
        self,
        title: str,
        message: str,
        severity: str = "error",
    ) -> bool:
        """
        Send a formatted Slack alert via the configured incoming webhook.

        Args:
            title:    Short headline shown in bold (e.g. "API 500 Error").
            message:  Body text with details (path, error message, etc.).
            severity: One of "critical", "error", "warning", "info".
                      Controls the colour of the Slack attachment sidebar.

        Returns:
            True if the webhook call succeeded, False otherwise.
        """
        if not self._slack_webhook:
            logger.debug("Slack alert skipped (no webhook configured): %s", title)
            return False

        colour = _SEVERITY_COLOURS.get(severity.lower(), _SEVERITY_COLOURS["error"])
        severity_emoji = {
            "critical": "🚨",
            "error":    "❌",
            "warning":  "⚠️",
            "info":     "✅",
        }.get(severity.lower(), "❌")

        payload = {
            "attachments": [
                {
                    "color": colour,
                    "blocks": [
                        {
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": f"{severity_emoji} {title}",
                                "emoji": True,
                            },
                        },
                        {
                            "type": "section",
                            "text": {"type": "mrkdwn", "text": message},
                        },
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": (
                                        f"*Service:* {self._dd_service}  |  "
                                        f"*Env:* {self._dd_env}  |  "
                                        f"*Version:* `{self._dd_version}`"
                                    ),
                                }
                            ],
                        },
                    ],
                }
            ]
        }

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(
                    self._slack_webhook,
                    content=json.dumps(payload),
                    headers={"Content-Type": "application/json"},
                )
            if resp.status_code == 200:
                logger.info("Slack alert sent: %s", title)
                return True
            else:
                logger.warning(
                    "Slack webhook returned %d: %s", resp.status_code, resp.text
                )
                return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("Slack alert failed: %s", exc)
            return False

    def log_metric(
        self,
        metric_name: str,
        value: float,
        tags: list[str] | None = None,
        metric_type: str = _DD_GAUGE,
    ) -> bool:
        """
        Ship a single metric point to Datadog.

        Args:
            metric_name:  Dot-separated metric name (e.g. "api.request.latency_ms").
            value:        Numeric value to record.
            tags:         Optional list of "key:value" tag strings.
            metric_type:  "gauge" (default) or "count".

        Returns:
            True if the metric was submitted successfully, False otherwise.
        """
        if not self._dd_api_key:
            logger.debug("Datadog metric skipped (no API key): %s=%s", metric_name, value)
            return False

        base_tags = [
            f"env:{self._dd_env}",
            f"service:{self._dd_service}",
            f"version:{self._dd_version}",
        ]
        all_tags = base_tags + (tags or [])

        try:
            from datadog import api as dd_api  # type: ignore  # noqa: PLC0415

            dd_api.Metric.send(
                metric=metric_name,
                points=[(int(time.time()), value)],
                tags=all_tags,
                type=metric_type,
            )
            logger.debug("Datadog metric sent: %s=%s tags=%s", metric_name, value, all_tags)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("Datadog metric submission failed (%s): %s", metric_name, exc)
            return False

    def log_error(
        self,
        error_type: str,
        message: str,
        context: dict[str, Any] | None = None,
    ) -> bool:
        """
        Send an error event to the Datadog Events stream.

        Args:
            error_type:  Short category label (e.g. "http_500", "db_connection_failure").
            message:     Human-readable description of the error.
            context:     Optional dict of extra key/value pairs appended to the event text.

        Returns:
            True if the event was submitted successfully, False otherwise.
        """
        if not self._dd_api_key:
            logger.debug("Datadog error event skipped (no API key): %s", error_type)
            return False

        tags = [
            f"env:{self._dd_env}",
            f"service:{self._dd_service}",
            f"version:{self._dd_version}",
            f"error_type:{error_type}",
        ]

        text_lines = [message]
        if context:
            text_lines.append("\n*Context:*")
            for k, v in context.items():
                text_lines.append(f"  {k}: {v}")
        event_text = "\n".join(text_lines)

        try:
            from datadog import api as dd_api  # type: ignore  # noqa: PLC0415

            dd_api.Event.create(
                title=f"[{self._dd_service}] {error_type}",
                text=event_text,
                alert_type="error",
                tags=tags,
                source_type_name="python",
            )
            logger.debug("Datadog error event sent: %s", error_type)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.warning("Datadog error event submission failed (%s): %s", error_type, exc)
            return False

    # ── Convenience helpers ───────────────────────────────────────────────────

    def alert_5xx(self, method: str, path: str, status_code: int, error: str) -> None:
        """Fire a Slack alert and Datadog event for a 5xx HTTP error."""
        title = f"API {status_code} Error — {method} {path}"
        message = (
            f"*Endpoint:* `{method} {path}`\n"
            f"*Status:* `{status_code}`\n"
            f"*Error:* {error}"
        )
        self.send_slack_alert(title, message, severity="error")
        self.log_error(
            error_type=f"http_{status_code}",
            message=f"{method} {path} → {status_code}: {error}",
            context={"method": method, "path": path, "status_code": status_code},
        )
        self.log_metric("api.errors.5xx", 1, tags=[f"path:{path}", f"status:{status_code}"], metric_type=_DD_COUNT)

    def alert_high_error_rate(self, error_rate_pct: float, window_minutes: int = 5) -> None:
        """Fire a Slack alert when the error rate exceeds the 5% threshold."""
        title = f"High Error Rate — {error_rate_pct:.1f}% over {window_minutes}m"
        message = (
            f"*Error rate:* `{error_rate_pct:.1f}%` (threshold: 5%)\n"
            f"*Window:* last {window_minutes} minutes\n"
            "Check Datadog APM and Railway logs for root cause."
        )
        self.send_slack_alert(title, message, severity="critical")
        self.log_error(
            error_type="high_error_rate",
            message=f"Error rate {error_rate_pct:.1f}% exceeded 5% threshold",
            context={"error_rate_pct": error_rate_pct, "window_minutes": window_minutes},
        )

    def alert_high_latency(self, p95_ms: float, path: str | None = None) -> None:
        """Fire a Slack alert when p95 latency exceeds 1000 ms."""
        endpoint_info = f" on `{path}`" if path else ""
        title = f"High Latency — p95 {p95_ms:.0f}ms{endpoint_info}"
        message = (
            f"*p95 latency:* `{p95_ms:.0f}ms` (threshold: 1000ms)\n"
            f"*Endpoint:* {path or 'global'}\n"
            "Consider scaling up API replicas or investigating slow queries."
        )
        self.send_slack_alert(title, message, severity="warning")
        self.log_error(
            error_type="high_latency",
            message=f"p95 latency {p95_ms:.0f}ms exceeded 1000ms threshold",
            context={"p95_ms": p95_ms, "path": path or "global"},
        )

    def alert_db_failure(self, error: str) -> None:
        """Fire a Slack alert on database connection failure."""
        title = "Database Connection Failure"
        message = (
            f"*Error:* {error}\n"
            "The API cannot reach PostgreSQL. Check `DATABASE_URL` and DB service health."
        )
        self.send_slack_alert(title, message, severity="critical")
        self.log_error(
            error_type="db_connection_failure",
            message=f"Database connection failed: {error}",
            context={"error": error},
        )
        self.log_metric("api.db.connection_failures", 1, metric_type=_DD_COUNT)

    def alert_elasticsearch_unavailable(self, error: str) -> None:
        """Fire a Slack alert when Elasticsearch is unreachable."""
        title = "Elasticsearch Unavailable"
        message = (
            f"*Error:* {error}\n"
            "Search functionality may be degraded. Check Elasticsearch cluster health."
        )
        self.send_slack_alert(title, message, severity="warning")
        self.log_error(
            error_type="elasticsearch_unavailable",
            message=f"Elasticsearch unreachable: {error}",
            context={"error": error},
        )
        self.log_metric("api.elasticsearch.unavailable", 1, metric_type=_DD_COUNT)

    # ── Status introspection ──────────────────────────────────────────────────

    def status(self) -> dict[str, Any]:
        """Return the current configuration status of the monitoring service."""
        return {
            "datadog_enabled": bool(self._dd_api_key),
            "slack_enabled": bool(self._slack_webhook),
            "dd_env": self._dd_env,
            "dd_service": self._dd_service,
            "dd_version": self._dd_version,
        }


# ── Module-level singleton ────────────────────────────────────────────────────
# Import this wherever you need to send alerts or log metrics:
#   from app.services.monitoring_service import monitoring
monitoring = MonitoringService()
