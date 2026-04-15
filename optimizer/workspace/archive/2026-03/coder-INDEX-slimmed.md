# Knowledge Context

## Team
Coder implements (Opus). Tech-lead builds (Opus).
May is Supervisor (Opus). QA reviews (GPT-5.2).
Master uses CLI tools (Opus).

## Design Philosophy
- **Simplest Thing That Works**: Don't over-engineer.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Deterministic Guardrails**: Use code for routing/structure.
- **Verify-on-Edit**: Check immediately after changing a file.
- **No Silent Failures**: Escalate errors.

## File Safety Classification
When deleting/cleaning files: classify BEFORE acting.
See `knowledge/library/file-safety-classification.md` for full taxonomy.
- 🔴 NEVER-DELETE: databases, configs, secrets
- 🟢 SAFE-TO-DELETE: cache/, *.tmp, scratch files
- 🟡 ASK-FIRST: anything ambiguous

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `test/` — test files

## Skills Reference
Read the full SKILL.md when you need the detailed protocol.

- **error-handling** → `shared/skills/error-handling/SKILL.md` — when: tool error or unexpected result
- **obstacle-pivot** → `shared/skills/obstacle-pivot/SKILL.md` — when: tool call fails, need fallback
- **state-check-before-action** → `shared/skills/state-check-before-action/SKILL.md` — when: before any edit/write/destructive bash
- **stale-approach-fixation** → `shared/skills/stale-approach-fixation/SKILL.md` — when: starting a session, check workspace notes first
- **idempotent-work-detection** → `shared/skills/idempotent-work-detection/SKILL.md` — when: starting any task, check if already done
- **search-strategy-escalation** → `shared/skills/search-strategy-escalation/SKILL.md` — when: after 2 grep/find commands on same topic
- **evidence-over-narrative** → `shared/skills/evidence-over-narrative/SKILL.md` — when: comments vs test results conflict
- **scope-discipline** → `shared/skills/scope-discipline/SKILL.md` — when: tempted to fix unrelated issues mid-task
- **task-adherence** → `shared/skills/task-adherence/SKILL.md` — when: multi-step implementation tasks
- **classify-then-act** → `shared/skills/classify-then-act/SKILL.md` — when: multi-file bugs or ambiguous specs
- **verification-consistency** → `shared/skills/verification-consistency/SKILL.md` — when: every edit, especially later in session
- **progressive-work-persistence** → `shared/skills/progressive-work-persistence/SKILL.md` — when: multi-file edits, save after each completion

## References
- `knowledge/library/codebase.md` — file map and architecture
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
