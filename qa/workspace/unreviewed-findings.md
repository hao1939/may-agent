# Unreviewed findings (QA heartbeat)

## Scope of this heartbeat
- No production alerts or QA projects were active.
- Investigated **Convention Alert**: **C1.4** and **C8.2** both at 60%.
- Performed a lightweight repo verification sweep.

## Findings

### 1) Pre-existing toolchain mismatch blocks mandatory QA checks (CRITICAL)
**What I expected (per QA SOUL + qa/context.md):**
- `./node_modules/.bin/tsc --noEmit`
- `./node_modules/.bin/vitest --run`

**What I observed:**
- Project root `/app` is **not** a git repo; only `/app/agents` is.
- `/app` has `node_modules/`, but does **not** have `./node_modules/.bin/tsc` or `./node_modules/.bin/vitest`.

**Evidence:**
- `./node_modules/.bin/tsc --noEmit` → `/bin/bash: ... No such file or directory` (exit 127)
- `./node_modules/.bin/vitest --run` → `/bin/bash: ... No such file or directory` (exit 127)

**Impact:**
- QA cannot execute its mandatory verification steps in this environment, which directly contributes to convention compliance issues (sessions end without required evidence).

**Recommendation:**
- Clarify which repo is the authoritative TS/Vitest workspace for QA gating.
- Ensure the chosen workspace includes `typescript` + `vitest` and installs them (e.g., add to devDependencies + `npm ci`/`bun install`).

### 2) Recent commit touches multiple agent context/last-session files; no code/tests to verify (IMPORTANT)
**Evidence:**
- `cd agents && git show --name-only --oneline -1 3544a499f` lists only markdown updates:
  - `bob/context.md`, `bob/last-session.md`, `coach/last-session.md`, `evaluator/last-session.md`, `optimizer/last-session.md`, `qa/context.md`, `scout/context.md`, `tech-lead/context.md`, `tech-lead/last-session.md`

**Risk:**
- Context docs can drift; but there’s no runnable code here to validate beyond consistency.

### 3) Example of potentially incomplete last-session doc (MINOR)
**Evidence:**
- `agents/coach/last-session.md` ends with “Let me verify my deliverables and finish:” (no subsequent content).

**Risk:**
- Suggests generator may cut off or fail to append final verification lines; could indirectly affect C8.2 (missing completed_items) and C1.4 (missing finish discipline).

## Convention Alert triage (act/delegate/dismiss/escalate)
- **C1.4 (always call finish())**: **ACT** — I will comply in this heartbeat (finish() with required fields). Root cause likely also includes toolchain mismatch preventing last-step verification.
- **C8.2 (include summary + completed_items)**: **ACT** — include both in finish(). Also recommend updating any agent templates/prompts that omit completed_items.

