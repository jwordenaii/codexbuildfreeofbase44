# WordenUniversity Cross-Repo Contract

Purpose: keep this repo stable while Worden University lives in a separate repository.

Target repository:

- GitHub: [jwordenaii/wordenuniversity](https://github.com/jwordenaii/wordenuniversity)
- Branch baseline: `main`
- Contract file: `/.well-known/worden-contract.json`

## Contract Scope

This repo treats Worden University as an external product surface.

Current contract assumptions:

- University is a standalone React/Vite frontend.
- Core learning UX exists in `src/App.jsx` with in-app course/module/quiz flows.
- Root mount exists in `src/main.jsx` and renders `App`.
- Versioned machine-readable contract is published at `/.well-known/worden-contract.json`.
- No hard runtime dependency from this repo onto private University internals.

## Guard Command

Run this before releases that touch cross-repo links or training flows:

```bash
npm run guard:wordenuniversity-contract
```

What it checks:

- Remote files are reachable from `jwordenaii/wordenuniversity@main`:
  - `/.well-known/worden-contract.json`
  - `README.md`
  - `src/App.jsx`
  - `src/main.jsx`
- Contract JSON validates:
  - `contract_version` compatibility
  - product/repository identity
  - required capabilities
  - storage progress key (`wu-progress`)
- Baseline shape markers still exist in `src/App.jsx`:
  - `WORDEN UNIVERSITY`
  - `const COURSES = [`
  - `wu-progress`
  - `Worden University Certified`
- Baseline root-render markers exist in `src/main.jsx`.
- Emits notes when API usage or persistence patterns appear to change.

## Integration Rules

- Do not assume shared runtime state across repos.
- Do not couple this repo to non-versioned University component internals.
- Prefer URL-level integration contracts (links, SSO tokens, documented API) over scraping app structure.
- If guard fails, pause deployment and review University changes before re-enabling cross-links.

## Deployment Enforcement

The premium deploy gate now includes this guard:

- `npm run gate:deploy-premium`
  - runs `guard:wordenuniversity-contract` before premium-quality checks.

## Future Hardening (Optional)

Potential next upgrades:

- Add signed contract metadata (checksum/signature) for tamper detection.
- Add contract changelog and semantic versioning policy in University repo.
- Pin this guard to released tags in addition to branch checks.
