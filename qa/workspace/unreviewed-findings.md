# QA Heartbeat — Unreviewed Findings

## 2026-04-25 — Inbox triage + EXP-220 alert verification

### Finding: EXP-220 / enoent-file-search scenario naming mismatch
**Severity:** IMPORTANT

**What the alert says:** “Verify the new gym scenario EXP-220 (enoent-file-search) was properly set”.

**What exists in repo:** A gym scenario folder exists at `agents/gym/scenarios/enoent-file-search/` with:
- `scenario.json`
- `task.md`
- `success_criteria.js`

Evidence (repo reads):
- `agents/gym/scenarios/enoent-file-search/scenario.json` has `"name": "enoent-file-search"` and describes the ENOENT/file-search trap.

**Issue:** There is no scenario folder/file explicitly named `EXP-220` under `agents/gym/scenarios/`. Either:
1) EXP-220 is intended to be the codename for the `enoent-file-search` scenario (in which case the alert is fine but should clarify the mapping), or
2) A distinct EXP-220 scenario folder is missing.

**Recommendation:** Update the alert text to reference the concrete repo path `agents/gym/scenarios/enoent-file-search/` (and/or add EXP-220 metadata somewhere authoritative).

### Environment limitation: mandatory QA gate commands unavailable
**Severity:** IMPORTANT (environment)

The required QA gate commands fail in this repo checkout because `node_modules/.bin/tsc` and `node_modules/.bin/vitest` are not present.
- `./node_modules/.bin/tsc --noEmit` → ENOENT
- `./node_modules/.bin/vitest --run` → ENOENT

Recommendation: Ensure dependencies are installed in this environment or provide the correct invocation (e.g., via `pnpm`/`npm` scripts) so QA can run the mandated checks.
