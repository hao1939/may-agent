# Knowledge Context

## ⚠️ Verify-Before-Return (READ THIS)
See `knowledge/verify-before-return.md` — 31% of your "Done" messages are lies.
Before reporting success: `tsc --noEmit` + `bun run test` + intent check. Quote evidence.

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
- **Agent Coordination**: Use `agents.call` to block/sync, `agents.fork` to
  start asynchronous work, and `message` for a queued notification.
  Delegate implementation to Coder/Master. Delegate review to QA.
- **File Safety**: Read before write. Verify edits. Don't edit outside workspace
  unless explicitly tasked.
- **Error Handling**: Escalate failures. Don't retry blindly.
- **Workflow**: Use `implement-and-review` for code changes.

## System Architecture
See `knowledge/system-architecture.md` — prompt loading, request DB performance,
finish guards, structured delegation, active nudge thresholds, QA review phases.

## Project Layout
- `src/lib/` — core library
- `src/app/` — application layer
- `agents/` — agent configs (**gitignored** — changes are on disk only, not committed)
- `shared/**` and `agents/**` — app tests (use `bun run test`; use `bun test path/to/file.test.ts` for targeted checks)

## Project Evolution (Key Decisions)
- **`handoff()` removed** (commit `fd5bda9`): Use `agents.call`/`agents.fork`
  for work and `message` for notifications. No handoff tool exists.
- **`classifyError` default**: Changed from `"infra"` to `"logic"` (commit `36d4642`). Unknown errors do NOT auto-retry — only retry when confident it's transient infra failure.
- **context_files placement** (P147): context_files are loaded in the first user message (volatile section), NOT in the system prompt. This was an intentional move.
- **P209 (Request Tracking)**: Fully implemented and deployed.
- **DOMAIN.md restored** (commit `63e76d2`): `resolveSystemPrompt` was silently skipping DOMAIN.md for all agents. Now loads SOUL.md → DOMAIN.md → common-sense.md.
- **Ghost Deliverable Guard** (commit `d4ca28a`): `finish-guard.ts` Gate 0 blocks false success claims when no write/edit evidence exists.

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
- `agents/shared/skills/stale-approach-fixation/SKILL.md` — read workspace notes
  and context files BEFORE your first task-action tool call. Never retry a tool
  or approach documented as unavailable. Use documented working approaches instead
  of defaults. Document new discoveries for future sessions. Prevents 3-5 wasted
  turns/session from retrying dead tools or re-deriving known constraints.
- `agents/shared/skills/delegation-verification/SKILL.md` — verify delegated
  work is registered before closing your session. After every `agents({ action:
  "send" })`, confirm the request appears in `agents({ action: "requests" })`
  before calling `finish()`. Document delegations as "delegated to [agent]", not
  as completed work. You delegate implementation tasks to coder (1/1 unverified
  in evidence) — this skill ensures requests don't get lost silently.
- `agents/shared/skills/idempotent-work-detection/SKILL.md` — before starting
  any task, check if the work is already done. Quick state check in turn 1,
  decide in turn 2. Prevents 3-8 wasted turns per incident.
- `agents/shared/skills/search-strategy-escalation/SKILL.md` — structured
  3-phase search discipline: broad scan → stop-and-think → targeted read.
  Prevents grep spirals (10-30+ sequential searches without reading results).
  You are the worst offender — 27 greps in session 507, 19 git+grep in session
  516. The 3-command rule: after 3 search commands on the same topic, you MUST
  read a result file before searching again. Escalate strategy (read structure,
  trace imports, search callers) after 5 failed commands instead of refining
  the same grep pattern.
- `agents/shared/skills/incremental-context-loading/SKILL.md` — gate context
  file reads on change detection before loading. All heartbeat agents load
  their full heartbeat.md (~5KB) every 30-60 min session despite weekly change
  frequency. For git-based work: after `git log <last-commit>..HEAD` returns
  empty, stop immediately — don't re-read files, re-scan directories, or write
  "nothing found" journal entries. The protocol: run `stat -c '%Y %n'` on
  context files, compare against stored timestamps, skip unchanged files. Store
  timestamps at session end for next session. Reduces boilerplate by ~60-80%.
- `agents/shared/skills/task-adherence/SKILL.md` — follow task instructions
  precisely: extract a checklist BEFORE starting, execute steps in order,
  write to the exact files named, and verify every claim with in-session
  tool evidence. Prevents goal drift, wrong deliverables, skipping prerequisites,
  and overclaiming. Your implementation tasks have specific specs and output
  requirements — this skill ensures you complete every specified step before
  reporting done (complements verify-before-return which catches false claims).
  Protocol: Parse → Checklist → Execute in order → Verify before finish.
- `agents/shared/skills/scope-discipline/SKILL.md` — finish what you started.
  When implementing features, you read broadly and discover tangential issues
  (stale configs, minor bugs in unrelated files). The fix: DECLARE scope in
  your first response, LOG discoveries as TODOs instead of acting on them,
  COMPLETE primary task before expanding. Your "planning without executing"
  anti-pattern (14 occurrences) is partly scope creep — exploration consumes
  turns that should go to delivery. Exception: if a discovery blocks your
  current task and can be resolved in 1 turn, fix it. Gym tested: 3/3 pass
  on scope-creep-trap scenario.
- `agents/shared/skills/classify-then-act/SKILL.md` — split judgment-critical
  tasks into two phases: (1) CLASSIFY all inputs and write a structured
  assessment with NO modifications allowed, then (2) ACT only on items
  classified as ACTIONABLE. Proven at 92% on 38 gym experiments vs. 30-50%
  baselines. Key for you: exp-094 showed you editing config.json correctly
  but skipping verify read-back (C2.3 fail) — acting without the review
  step. When delegating multi-file implementations or handling ambiguous
  specs, structure the work as classify→act: read all relevant code first,
  write a plan/analysis, then execute only what's clearly needed. UNCERTAIN
  items get reported, not guessed at. Complements verify-before-return —
  classify-then-act prevents bad actions, verify-before-return catches bad
  claims.
- `agents/shared/skills/verification-consistency/SKILL.md` — maintain read-back
  verification at a consistent rate throughout your entire session, not just
  the first few edits. Tech-lead showed the sharpest position decay: 25%→0%
  (s_73: verified edit #1 to repo-gate-check.ts, then skipped edits #2-#7).
  Every edit must get a read-back within 3 tool calls. This is a companion to
  the verification skill — it addresses WHEN verification is skipped (later
  edits, same-file edits, end-of-session). Complements verify-before-return
  which catches false done claims. Gym tested: 3/3 pass on
  convention-verify-multi-edit scenario.
- `agents/shared/skills/progressive-work-persistence/SKILL.md` — save
  intermediate work products to disk as each deliverable completes, rather than
  buffering all output in context until the end. Your implementation sessions
  involve multi-file edits and test runs — if the session ends unexpectedly
  after completing 2 of 3 files, unwritten state is lost and the next session
  re-investigates from scratch. Write deliverables immediately after completion,
  checkpoint after major state changes (15-20 ops between checkpoints max),
  and save before risky operations (complex multi-file edits, delegations to
  coder/QA). Complements budget-before-act (plan save points after estimating
  budget). Anti-patterns: delayed batch (3+ deliverables then write all at end),
  checkpoint-free long sessions (40+ ops with zero saves). Gym tested: 3/3
  pass on progressive-work-persistence scenario.
