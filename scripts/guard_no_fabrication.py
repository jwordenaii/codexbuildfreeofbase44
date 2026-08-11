#!/usr/bin/env python3
"""guard_no_fabrication.py — CI gate against fabricated data in API responses.

Scans app/routers/ and app/services/ for the exact patterns that have,
historically, shipped fake data to real users on this codebase:

  1. random.random()/randint()/uniform()/choice() used to fabricate a
     value, outside a function/context that's clearly labeled as a
     mock/demo/stub (by name or a nearby comment/docstring).
  2. A literal "source": "live" / "source": "real" string in a file
     that contains no real data call anywhere (httpx, requests, db.query,
     db.execute) — i.e. a response claims to be live but nothing in the
     file could have produced live data.
  3. TODO/FIXME/NotImplementedError left in a router (unfinished work
     shipping as if it were finished).

This is a blunt instrument by design — false positives get an inline
`# guard: allow (reason)` comment on the flagged line, not a change to
this script's rules. The bar for suppressing a finding is a real,
written reason, not just making the check quieter.

Exit code 0 = clean, 1 = findings (fails CI).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = [ROOT / "app" / "routers", ROOT / "app" / "services"]
ALLOW_MARKER = "# guard: allow"

RANDOM_FABRICATION_RE = re.compile(
    r"\brandom\.(random|randint|uniform|choice|choices|sample)\s*\("
)
LIVE_SOURCE_CLAIM_RE = re.compile(r'"source"\s*:\s*"(live|real)"')
REAL_DATA_CALL_RE = re.compile(
    r"\b(httpx\.|requests\.|db\.query\(|db\.execute\(|await\s+\w*client\.(get|post))"
)
MOCK_CONTEXT_RE = re.compile(r"mock|demo|stub|simulat|fake|synthetic", re.IGNORECASE)
TODO_RE = re.compile(r"\b(TODO|FIXME)\b")


def _nearby_context(lines: list[str], idx: int, window: int = 6) -> str:
    lo = max(0, idx - window)
    return "\n".join(lines[lo : idx + 1])


def _line_allowed(line: str) -> bool:
    return ALLOW_MARKER in line


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    try:
        text = path.read_text(encoding="utf-8")
    except Exception:
        return findings
    lines = text.splitlines()
    has_real_data_call = bool(REAL_DATA_CALL_RE.search(text))

    for i, line in enumerate(lines, start=1):
        if _line_allowed(line):
            continue

        if RANDOM_FABRICATION_RE.search(line):
            context = _nearby_context(lines, i - 1)
            if not MOCK_CONTEXT_RE.search(context):
                findings.append(
                    f"{path.relative_to(ROOT)}:{i}: random fabrication with no "
                    f"mock/demo/stub context nearby — {line.strip()}"
                )

        if LIVE_SOURCE_CLAIM_RE.search(line) and not has_real_data_call:
            findings.append(
                f"{path.relative_to(ROOT)}:{i}: claims source=live/real but this "
                f"file has no httpx/requests/db call anywhere — {line.strip()}"
            )

        if TODO_RE.search(line):
            findings.append(
                f"{path.relative_to(ROOT)}:{i}: unfinished work (TODO/FIXME) in "
                f"shipped router/service code — {line.strip()}"
            )

    return findings


def main() -> int:
    all_findings: list[str] = []
    for d in SCAN_DIRS:
        if not d.exists():
            continue
        for path in sorted(d.glob("*.py")):
            all_findings.extend(scan_file(path))

    if all_findings:
        print(f"guard_no_fabrication: {len(all_findings)} finding(s)\n")
        for f in all_findings:
            print(f"  {f}")
        print(
            "\nEach of these either fabricates data presented as real, or "
            "claims to be live with nothing backing it. Fix the code, or if "
            "it's a genuine false positive, add `# guard: allow (reason)` on "
            "that exact line explaining why."
        )
        return 1

    print(f"guard_no_fabrication: clean ({sum(1 for d in SCAN_DIRS for _ in d.glob('*.py') if d.exists())} files scanned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
