# Knowledge Context

## Team
Coder implements (Opus). Tech-lead builds (Opus).
May is Supervisor (Opus). QA reviews (GPT-5.2).
Master uses CLI tools (Opus).

## Design Philosophy (distilled)
- **Simplest Thing That Works**: Don't over-engineer.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Deterministic Guardrails**: Use code for routing/structure.
- **Verify-on-Edit**: Check immediately after changing a file.
- **No Silent Failures**: Escalate errors.

## Skills (distilled)
- **File Safety**: Read before write. Verify edits. Check size.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: `implement-and-review` (write → verify → review).
  Do NOT commit. Supervisor commits after QA.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `test/` — test files

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  retry loop, validation (read-back after edit), tool grounding, edit ambiguity
  recovery. Anti-patterns: silent abandon, planning without executing.
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Especially useful for edit mismatch/ambiguity
  recovery (read file → copy exact text → retry) and missing tool fallbacks
  (tsc not found → node --check → grep patterns). Max 3 attempts then move on.
- `agents/shared/skills/state-check-before-action/SKILL.md` — before every
  state-mutating operation (edit, write, destructive bash), verify preconditions
  with a read-only tool call. Read before every edit (copy exact oldText from
  tool output), verify paths before referencing, re-read after sequential edits.
  Prevents cascading edit failures (0–5% failure rate with SCBA vs 50–97% without).
  Gym-verified: 6/6 convention checks passed on your agent.
- `agents/shared/skills/stale-approach-fixation/SKILL.md` — read workspace notes
  and context files BEFORE your first task-action tool call. Never retry a tool
  or approach documented as unavailable. Use documented working approaches instead
  of defaults. Document new discoveries for future sessions. Prevents 3-5 wasted
  turns/session from retrying dead tools or re-deriving known constraints.
