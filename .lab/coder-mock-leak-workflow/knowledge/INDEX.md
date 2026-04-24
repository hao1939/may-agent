# Knowledge Context

## Team
Coder implements (Opus). Tech-lead builds (Opus). May supervises (Opus). QA reviews (GPT-5.2). Master uses CLI (Opus).

## Design Philosophy
- **Simplest Thing That Works** — don't over-engineer
- **Crash Recovery** — `[STARTED]` sentinel files
- **Deterministic Guardrails** — code for routing/structure
- **Verify-on-Edit** — check immediately after changes
- **No Silent Failures** — escalate errors

## Core Skills
- **File Safety**: Read before write. Verify edits. Check size.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: `implement-and-review` (write → verify → review). Do NOT commit.

## Project Layout
`src/lib/` — core library · `src/app/` — application layer · `test/` — test files

## File Safety Classification
Classify BEFORE deleting. See `knowledge/library/file-safety-classification.md`:
🔴 NEVER-DELETE: databases, configs, secrets · 🟢 SAFE: cache, tmp, debug logs · 🟡 ASK-FIRST: ambiguous
Procedure: list → classify → delete only 🟢 → preserve 🔴 → report.

## Available Skills
All at `shared/skills/<name>/SKILL.md`:
- **error-handling** — when: tool error or unexpected result
- **file-safety** — when: deleting or cleaning up files
- **obstacle-pivot** — when: tool fails; classify → fallback → max 3 attempts
- **state-check-before-action** — when: before edit/write/destructive bash
- **stale-approach-fixation** — when: session start; read workspace notes first
- **idempotent-work-detection** — when: task start; check if already done
- **search-strategy-escalation** — when: 3+ grep/find on same topic
- **evidence-over-narrative** — when: comments vs tests disagree
- **scope-discipline** — when: unrelated issues mid-task; log TODO, stay on task
- **task-adherence** — when: multi-step task; parse → checklist → execute → verify
- **classify-then-act** — when: multi-file bugs or ambiguous specs
- **verification-consistency** — when: every edit; read-back within 3 calls
- **progressive-work-persistence** — when: multi-file edits; save + checkpoint
