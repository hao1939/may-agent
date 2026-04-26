# QA Heartbeat — Unreviewed Findings (2026-04-26)

## Scope
- Checked last commit in /app: `41ce69d` (scout deep-dive doc)
- Verified presence of gym scenario EXP-220 (enoent-file-search)

## Findings
### 1) EXP-220 scenario not found (IMPORTANT)
- `find agents/gym/scenarios ... '*EXP-220*'` returned no results.
- `rg "EXP-220" agents/gym/scenarios agents/gym` returned no results.
- `find agents/gym/scenarios ... '*enoent*file*search*'` returned no results.

This conflicts with the inbox notification requesting verification that EXP-220 exists. Either the scenario was never added, it lives outside the expected directory, or it was removed/renamed.

### 2) Repo toolchain mismatch with mandatory QA checks (IMPORTANT / ENV)
- `./node_modules/.bin/tsc --noEmit` exits with code 1 and prints the help banner, consistent with no `tsconfig.json` in repo root.
- `./node_modules/.bin/vitest --run` fails: `No such file or directory` (vitest not installed; package.json only contains typescript).

This is likely an environment/setup baseline issue rather than a patch-specific regression, but it blocks standard TypeScript/test verification.

## Changed File Reviewed
- `.state/research/deep-dive-autogenesis-self-evolving-protocol.md` (doc-only change). Content looks internally consistent; no executable code impact identified.
