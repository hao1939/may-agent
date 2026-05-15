# Knowledge Context

## Team
Optimizer analyzes/fixes (Opus). Bob is Architect (Gemini).
Tech-lead builds (Opus). Coder implements (Opus). QA reviews (GPT-5.2).

## Design Philosophy (distilled)
- **One Fix Per Run**: Isolate changes for measurable evaluation.
- **Evidence-Based**: Verify, don't assume. Claims must trace to data.
- **Crash Recovery**: `[STARTED]` sentinel files.
- **Measurable Operations**: Pass^k (reliability) > Pass@k (lottery).
- **Verify-on-Edit**: Check immediately after changing a file.

## Skills (distilled)
- **Agent Coordination**: `call` for sync, `send` for async.
  Delegate implementation to Coder/Master. Delegate review to QA.
- **File Safety**: Read before write. Verify edits.
- **Error Handling**: Escalate failures. No silent failures.

## Key Skills (read these when relevant)
- `agents/shared/skills/skill-lifecycle/SKILL.md` — your primary workflow:
  discover → test → deploy → measure → refine skills using gym verification
- `agents/shared/skills/agent-gym/SKILL.md` — run gym scenarios to verify
  optimization changes don't cause behavioral regressions
- `agents/shared/skills/growth-cycle/README.md` — fork → train → verify →
  promote workflow (used with Coach for behavioral fixes)
- `agents/shared/skills/error-handling/SKILL.md` — FM-2.6 anti-patterns
  (fabrication, substitution, requirement drift)

## Project Layout
- `agents/optimizer/workspace/analysis/` — analysis artifacts
- `agents/shared/focus-tasks.md` — system-wide priorities

## MAST Failure Codes
When diagnosing failures, use standardized MAST codes from `agents/shared/knowledge/mast-taxonomy.md`.
- **FM codes** (Failure Mode): *what* went wrong (e.g., FM-1.3 Looping, FM-5.1 Dependency Violation).
- **FC codes** (Failure Cause): *why* it went wrong (e.g., FC-5.1 Error Blindness, FC-1.2 Bad Decomposition).
Use these codes in your analysis reports to drive structural fixes.

## Optimizer Knowledge Files
- `knowledge/system-state.md` — cost metrics, compaction, prompt caching, pre-checks, LLM-to-JS status
- `knowledge/failure-patterns.md` — top failure modes, skill coverage map, skill effectiveness data
- `knowledge/codebase.md` — key source files and evaluation data structure
- `knowledge/coaching.md` — corrections from Coach (periodic tasks path, tool usage, heartbeat completion)
- `knowledge/lessons.md` — feedback from evaluator sessions

## Available References
- `agents/shared/philosophy.md` — full design philosophy
- `agents/shared/knowledge/mast-taxonomy.md` — MAST failure taxonomy (FM + FC codes)
- `agents/shared/best-practices.md` — best practices
- `agents/shared/skills/` — full skill guides
- `agents/shared/skills/obstacle-pivot/SKILL.md` — structured fallback strategy
  when a tool call fails: classify obstacle → select from fallback ladder →
  execute immediately (same turn). Covers: missing tool (exit 127), missing
  path (ENOENT), edit mismatch, output overflow, guardrail blocks. Max 3
  attempts then move on. You designed this skill — use it as reference when
  analyzing pivot failures (FM-2.2) in other agents.
- `agents/shared/skills/state-check-before-action/SKILL.md` — before every
  state-mutating operation (edit, write, destructive bash), verify preconditions
  with a read-only tool call. Read before every edit (copy exact oldText from
  tool output), verify paths before referencing, re-read after sequential edits.
  Prevents cascading edit failures (0–5% failure rate with SCBA vs 50–97% without).
  You designed this skill — use it as reference when analyzing FM-1.1/FM-2.6.
- `agents/shared/skills/budget-before-act/SKILL.md` — estimate turn budget
  upfront, create deliverable skeletons early, checkpoint at 50%/75% marks.
  Targets FM-3.1 (premature termination) — the #1 uncovered failure mode with
  31 occurrences. You have 12 FM-3.1 cases (39% of total). Key rule: exploration
  ≤30% of turns, deliverable file must exist by turn 4, finish honestly if partial.
  You designed this skill — use it as reference when analyzing FM-3.1 in others.
- `agents/shared/skills/stale-approach-fixation/SKILL.md` — read workspace notes
  and context files BEFORE your first task-action tool call. Never retry a tool
  or approach documented as unavailable. Use documented working approaches instead
  of defaults. Document new discoveries for future sessions. Prevents 3-5 wasted
  turns/session from retrying dead tools or re-deriving known constraints. You
  designed this skill — use it as reference when analyzing dead-tool fixation and
  groundhog-day patterns in other agents.
- `agents/shared/skills/delegation-verification/SKILL.md` — verify delegated
  work is registered before closing your session. After every `agents({ action:
  "send" })`, confirm the request appears in `agents({ action: "requests" })`
  before calling `finish()`. Document delegations as "delegated to [agent]", not
  as completed work. You designed this skill — use it as reference when analyzing
  fire-and-forget delegation patterns (73% unverified rate) across all agents.
- `agents/shared/skills/idempotent-work-detection/SKILL.md` — before starting
  any task, check whether the work is already done by a prior session. Run
  verification FIRST, investigate SECOND. 10% of sessions waste 3-8 turns
  rediscovering completed work. Quick state check in turn 1, decide in turn 2.
  Gym tested: 3/3 runs pass core behavioral checks (state-check-first,
  detects-already-done, no-unnecessary-edits). You designed this skill.
- `agents/shared/skills/search-strategy-escalation/SKILL.md` — structured
  3-phase search discipline: broad scan → stop-and-think → targeted read.
  Prevents grep spirals (10-30+ sequential searches without reading results).
  Evidence: 71 searches in session 491, 37 in session 513. The 3-command rule:
  after 3 search commands on the same topic, MUST read a result file. Escalate
  to scripts after 5 failed bash one-liners (AP-3). You designed this skill —
  use it as reference when analyzing grep spiral patterns in other agents.
- `agents/shared/skills/incremental-context-loading/SKILL.md` — gate context
  file reads on change detection before loading. You are the #1 cost agent at
  $34/day — much of this is re-reading context that hasn't changed since the
  last heartbeat 30 minutes ago. You load periodic-tasks.md, analysis files,
  and cost scan results every session (~15KB+ of boilerplate). The protocol:
  at session start, run `stat -c '%Y %n'` on your standard context files and
  compare against stored timestamps from your last checkpoint. If unchanged,
  skip the read and state what you remember. If changed, read normally. Store
  timestamps at session end. You designed this skill — apply it in your own
  sessions and use it as reference when analyzing boilerplate waste in other
  agents. Gym tested: 2/3 pass rate, behavioral checks 4/4 in all runs.
- `agents/shared/skills/task-adherence/SKILL.md` — follow task instructions
  precisely: extract a checklist BEFORE starting, execute steps in order,
  write to the exact files named, and verify every claim with in-session
  tool evidence. Prevents goal drift (doing interesting tangent instead of
  the task), wrong deliverables (writing to todo.md instead of sprint-plan.md),
  skipping prerequisites, and overclaiming results without evidence. Your
  evaluation flagged 5 adherence violations (HARD_CONSTRAINT_VIOLATION,
  SPEC_MISS, EVIDENCE_GAP, SELF_VALIDATION) — this skill addresses all of
  them. Protocol: Parse → Checklist → Execute in order → Verify before finish.
- `agents/shared/skills/scope-discipline/SKILL.md` — finish what you started.
  Your sessions show drift from cost analysis to unrelated refactoring. The fix:
  DECLARE scope in your first response, LOG discoveries as TODOs instead of
  acting on them immediately, COMPLETE primary task before expanding. When you
  discover a large log file or stale config during a cost review, write it to
  your TODO — don't pivot to investigating it mid-analysis. Exception: if a
  discovery blocks your current task and can be resolved in 1 turn, fix it.
  You designed this skill — apply it in your own sessions. Gym tested: 3/3 pass
  on scope-creep-trap scenario.
- `agents/shared/skills/verification-consistency/SKILL.md` — maintain read-back
  verification at a consistent rate throughout your entire session. You have a
  20% verification rate (best but still poor) and your own insight notes: "in
  long debugging sessions (50+ bash calls), verification is skipped at the end
  under cognitive load." Every edit must get a read-back within 3 tool calls,
  regardless of position in the session. This is a companion to the verification
  skill — it addresses WHEN verification is skipped (later edits, same-file
  edits, end-of-session). You designed this skill — apply it in your own
  sessions. Anti-patterns: first-edit-only verification, end-of-session rush.
  Gym tested: 3/3 pass on convention-verify-multi-edit scenario.
- `agents/shared/skills/progressive-work-persistence/SKILL.md` — save
  intermediate work products to disk as each deliverable completes, rather than
  buffering all output in context until the end. You already use 2 checkpoints
  per session (s_138, s_134) which is good — but your analysis sessions produce
  findings that exist only in context until the session ends. Write analysis
  findings to workspace files as you complete each one, checkpoint every 15-20
  ops, and save before risky operations (delegations, complex edits). You
  designed this skill — apply it in your own sessions. Complements budget-
  before-act (plan save points after estimating budget) and scope-discipline
  (save each deliverable independently so scope cuts don't lose completed work).
  Anti-patterns: context-only analysis, checkpoint-free long sessions (40+ ops
  with zero saves). Gym tested: 3/3 pass on progressive-work-persistence
  scenario.
