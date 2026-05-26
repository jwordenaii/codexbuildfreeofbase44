# Source Of Truth Guardrails

Use this checklist whenever multiple Copilot conversations or forks are active.

Reference matrix:

- See [NETLIFY_PROJECT_MATRIX.md](NETLIFY_PROJECT_MATRIX.md) for current site-to-role mapping and guard expectations.

## Session Start (Required)

1. Confirm local repo root:
   - `git rev-parse --show-toplevel`
2. Confirm remote URL:
   - `git remote -v`
3. Confirm branch:
   - `git branch --show-current`
4. Confirm local and remote head:
   - `git rev-parse HEAD`
   - `git rev-parse origin/main`

If any mismatch appears, stop and fix before editing.

## Before Every Commit

1. Run `git status --short`.
2. Verify changed files are expected for this task only.
3. Use one focused commit message with clear scope.
4. Push and verify:
   - `git push origin main`
   - `git log --oneline -n 3`

## Netlify Deploy Source Check

1. Open the Netlify site that owns domain:
   - [www.jwordenasphaltpaving.com](https://www.jwordenasphaltpaving.com)
2. Confirm linked repo:
   - jwordenaii/codexbuildfreeofbase44
3. Confirm branch:
   - main
4. Confirm published commit SHA matches local push.
5. Use Clear cache and deploy site when route behavior is stale.

## Parallel Conversation Rule

When another forked conversation is active:

1. Copy current commit SHA into both threads before making edits.
2. In each thread, state the working branch and target repo explicitly.
3. Never run deployment actions from two threads at once.
4. Treat one thread as deployment owner and one as build owner.

## Quick Ownership Pattern

- Build owner: writes code, commits, pushes.
- Deploy owner: runs Netlify deploy and verifies production routes.
- Validation owner: checks bundle hash, key routes, and sitemap.

## Production Validation Commands

- Route health (HEAD):
  - `https://www.jwordenasphaltpaving.com/jwordenai`
  - `https://www.jwordenasphaltpaving.com/contractor-ai-platform`
  - `https://www.jwordenasphaltpaving.com/lp/richmond-parking-lot-repair`
- Bundle fingerprint from homepage HTML:
  - extract `/assets/index-*.js`
- Sitemap verification:
  - ensure expected public URLs are present.

## Current Canonical Repo

- Local folder:
  - C:/Users/genew/Downloads/jworden_netlify_standalone_patched (2) (1)
- Remote:
  - [github.com/jwordenaii/codexbuildfreeofbase44.git](https://github.com/jwordenaii/codexbuildfreeofbase44.git)
- Branch:
  - main
