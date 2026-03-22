# Knowledge Context

## ⚠️ Verify-Before-Return (READ THIS)
See `knowledge/verify-before-return.md` — 31% of your "Done" messages are lies.
Before reporting success: `tsc --noEmit` + `npx vitest --run` + intent check. Quote evidence.

## Team
Tech-lead is the Builder (Opus). Drives implementation via coder+QA.
Bob is Architect (Gemini). May is Supervisor (Opus).
Coder implements (Opus). QA reviews (GPT-5.2). Master uses CLI tools (Opus).

## Design Philosophy (distilled)
- **Harness Over Model**: System prompt + tools + middleware > model size.
- **Simplest Thing That Works**: Don't over-engineer. Build for observed failures.
- **Crash Recovery**: Write state to disk. Recover from `[STARTED]` sentinel.
- **Deterministic Guardrails**: Use code for routing/structure, LLM for reasoning.
- **File System as Memory**: Files are context. Directories are indexes.

## Skills (distilled)
- **Agent Coordination**: Use `agents.call` to block/sync, `agents.send` to async/todo.
  Delegate implementation to Coder/Master. Delegate review to QA.
- **File Safety**: Read before write. Verify edits. Don't edit outside workspace
  unless explicitly tasked.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: Use `implement-and-review` for code changes.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `agents/` — agent configs (**gitignored** — changes are on disk only, not committed)
- `test/` — test files (use `npm test` or `npx tsx test/...`)

## Project Evolution (Key Decisions)
- **`handoff()` removed** (commit `fd5bda9`): Replaced by `agents.send()` + request tracking. No handoff tool exists.
- **`classifyError` default**: Changed from `"infra"` to `"logic"` (commit `36d4642`). Unknown errors do NOT auto-retry — only retry when confident it's transient infra failure.
- **context_files placement** (P147): context_files are loaded in the first user message (volatile section), NOT in the system prompt. This was an intentional move.
- **P209 (Request Tracking)**: Fully implemented and deployed.

## MAST Failure Codes
When reporting implementation failures, use standardized MAST codes from `agents/shared/knowledge/mast-taxonomy.md`.
- **FM codes** (Failure Mode): *what* went wrong (e.g., FM-1.3 Looping, FM-5.1 Dependency Violation).
- **FC codes** (Failure Cause): *why* it went wrong (e.g., FC-5.1 Error Blindness, FC-1.2 Bad Decomposition).

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  environment grounding (no `cd /home/user`), edit ambiguity recovery (expand
  oldText context), path discovery, tool grounding. Anti-patterns: planning
  without executing (14 occurrences in your sessions), silent abandon.
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on. You already do this well — this codifies your
  implicit fallback ladders for consistency.
- `agents/shared/skills/state-check-before-action/SKILL.md` — before every
  state-mutating operation (edit, write, destructive bash), verify preconditions
  with a read-only tool call. Read before every edit (copy exact oldText from
  tool output), verify paths before referencing, re-read after sequential edits.
  Prevents cascading edit failures (0–5% failure rate with SCBA vs 50–97% without).
- `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn budget
  upfront, create deliverable skeletons early, checkpoint at 50%/75% marks.
  Targets FM-3.1 (premature termination) — you have 8 FM-3.1 cases (26% of total).
  Key rule: exploration ≤30% of turns, deliverable file must exist by turn 4.
  Anti-pattern for you: "planning without executing" — budget forces the
  transition from reading/planning to writing output.
