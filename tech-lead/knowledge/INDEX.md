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
- **`extractFinishParams()` + `lessons`** (commit `b01ab44`): `finish()` schema now includes `lessons` field. `extractFinishParams()` in `manager-retry.ts` must destructure it.
- **Dynamic agent tool loading** (`loadLocalTools()`): Agents can define local tools shipped at runtime.
- **Smart Send idempotency** (commits `d45bd4d`/`86a63cb`/`0001f33`): `agents.send()` has dedup guard to prevent duplicate task injection.

## MAST Failure Codes
When reporting implementation failures, use standardized MAST codes from `agents/shared/knowledge/mast-taxonomy.md`.
- **FM codes** (Failure Mode): *what* went wrong (e.g., FM-1.3 Looping, FM-5.1 Dependency Violation).
- **FC codes** (Failure Cause): *why* it went wrong (e.g., FC-5.1 Error Blindness, FC-1.2 Bad Decomposition).

## Gym & Growth-Cycle
- `knowledge/gym-scoring.md` — Gym scoring bugs, callIndex vs entryIndex, CJS/TS sync, ceiling effects
- `knowledge/growth-cycle.md` — Growth-cycle workflow issues: fork discarding, agent type mismatch

## Project State (updated 2026-03-20)
- **P209 (Request Tracking)**: Fully implemented and deployed.
- **Gym**: 48 scenarios, 11 with workflow variants. Scoring now uses `callIndex` for reliable same-turn ordering.
- **TSC**: Consistently clean since commit `37a6a2b`.
- **Evaluator opBudget**: 15 (was 5, caused OpBudgetExceeded). Coach opBudget: 60 (was 200).
- **TODOs in src/**: 2 deferred (compose-guards import, verify_skill preset).

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `agents/shared/best-practices.md` — coding standards
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/error-handling/SKILL.md` — error recovery patterns:
  environment grounding (no `cd /home/user`), edit ambiguity recovery (expand
  oldText context), path discovery, tool grounding. Anti-patterns: planning
  without executing (14 occurrences in your sessions), silent abandon.
