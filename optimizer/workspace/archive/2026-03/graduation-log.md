# Heartbeat Graduation Log

## Review #2 — 2026-03-17

### Summary
Follow-up on Review #1 proposals. Key action: wired `error-log-scanner.ts` to cron.

### Status of Review #1 Proposals

| # | Proposal | Status | Action Taken |
|---|----------|--------|-------------|
| 1 | Coach ERROR_LOG scanning → JS handler | ✅ **GRADUATED** | Handler already built by prior session (9KB, 258 LOC). Was orphaned — no cron entry. **Wired it to cron today**: `error-log-scanner` job, 4h interval, 7d cooldown. Coach Step 2 now only fires if handler detects patterns. |
| 2 | May Step 3 (System Health) → remove | ⏳ Pending | May's heartbeat still has Step 3. Low priority — only 2 tool calls of waste per heartbeat. May has not actioned this yet. |
| 3 | Tech-Lead health-check.sh → JS pre-flight | ⏳ Deferred | As noted in Review #1, this is lower priority. Tech-Lead's Step 3 is broader than just the health check. |

### New Observations

**Coach heartbeat** (158 lines, 7884 bytes — largest heartbeat):
- Step 2 (Error-Driven Growth) is now **effectively graduated** — the `error-log-scanner` handler does the scanning work. Coach should update Step 2 to note this: "Error scanning is automated via cron:error-log-scanner. Only act on injected `[cron:growth-trigger]` tasks."
- Steps 3-5 (Self-Evolve, Method Invention, Method Learning) are deeply creative — not graduation candidates.
- "What NOT to do" section at bottom is excellent — lists 7 cron-graduated tasks. This pattern should be adopted by other agents.

**Orphaned handlers** still present: `audit-requests.ts`, `focus-task-tracker.ts` (2 files, ~265 LOC dead code). These should be deleted by May.

**agents-auto-commit cron entry**: Has no `type` field (all other entries have `type: "job"` or `type: "heartbeat"`). Not a bug per se — the system likely handles missing type gracefully — but worth noting for consistency.

### New Graduation Candidates
None identified this cycle. All remaining heartbeat steps require LLM judgment (creative dispatch, design, research, calibration). The easily-automatable scanning/monitoring steps have already been graduated.

### Next Review
Scheduled: 2026-03-31 (bi-weekly cadence)

---

## Review #1 — 2026-03-16

### Methodology
Reviewed all 12 agent heartbeat.md files against graduation criteria from `agents/shared/tasks/work-maturity-ladder.md`:
1. Has the step been running 1+ weeks with stable pattern?
2. Is the pattern self-contained (doesn't depend on other heartbeat steps)?
3. Can it be expressed as a focused cron prompt or JS handler?

Cross-referenced against existing cron.json (28 entries, 26 enabled) to avoid duplicate proposals.

### Already Graduated (prior work)
| Step | From Agent | Graduated To | Cron Entry |
|------|-----------|-------------|------------|
| Session evaluation | Evaluator | Stage 2 (cron+LLM) | `evaluate-session-llm` |
| Common-sense verification | Coach | Stage 2 (cron+LLM) | `common-sense-verify` |
| Common-sense infra review | Bob | Stage 2 (cron+LLM) | `common-sense-infra` |
| Failure analysis | Bob | Stage 2 (cron+LLM) | `analyze-failures` |
| Stuck session detection | May | Stage 3 (JS handler) | `watchdog` |
| Session auto-evaluation | May | Stage 3 (JS handler) | `evaluate-sessions` |
| System status | May | Stage 3 (JS handler) | `system-status` |
| Daily metrics | May | Stage 3 (JS handler) | `daily-brief` |
| Coaching quality report | May | Stage 3 (JS handler) | `coaching-report` |
| Memory consolidation | Multiple | Stage 2 (cron+LLM) | `consolidate-memory-*` (5 agents) |
| Human interaction reflection | Coach | Stage 2 (cron+LLM) | `reflect` |

### Graduation Candidates (new proposals)

#### PROPOSAL 1: Coach ERROR_LOG Scanning → JS Pre-check Handler
**Current**: Coach heartbeat Step 2 scans all `agents/*/ERROR_LOG.jsonl` looking for agents with 3+ repeated errors of the same type. If found, Coach initiates a Growth Cycle.
**Pattern stability**: Running since system inception. The scanning logic is deterministic — count errors by type per agent, flag if ≥3.
**Proposal**: Create a JS handler `error-log-scanner` that:
1. Reads all `agents/*/ERROR_LOG.jsonl` files
2. Counts errors by type per agent (last 7 days)
3. If any agent has ≥3 repeated errors of the same type → triggers Coach with a focused message: `[cron:growth-trigger] Agent {name} has {count} repeated {errorType} errors. Initiate Growth Cycle: fork → train → verify → promote/discard.`
4. If no agents meet threshold → no-op (zero cost)

**Benefit**: Eliminates LLM cost of scanning ERROR_LOGs when there's nothing to act on. Coach's heartbeat time is freed for creative work (skills, conventions, user study). Estimated savings: ~$0.50-1.00/day (Coach heartbeat cost when scanning yields nothing).
**Risk**: Low — the detection logic is trivially deterministic. The LLM-requiring part (Growth Cycle) stays LLM-driven.
**Status**: ⏳ Proposed — needs May approval.

#### PROPOSAL 2: May Heartbeat Step 3 (System Health) → Remove (Already Covered)
**Current**: May runs `ls -lt .state/sessions/active/ | head -5` and `ls -lt .state/cron/ | head -3` every heartbeat.
**Finding**: The `watchdog` JS handler already runs every 10 minutes and checks for stuck sessions. The `system-status` handler runs every 4 hours for comprehensive health checks. May's Step 3 is fully redundant.
**Proposal**: Remove Step 3 from May's heartbeat.md entirely. The time saved (2 tool calls + LLM reasoning) goes to dispatch and follow-up work.
**Benefit**: 2 fewer tool calls per May heartbeat × ~50 heartbeats/day = 100 wasted tool calls eliminated. May's core value is in Step 1 (dispatch) and Step 2 (follow-up).
**Risk**: Very low — watchdog + system-status are more thorough than 2 quick `ls` commands.
**Status**: ⏳ Proposed — needs May approval + Hao confirmation.

#### PROPOSAL 3: Tech-Lead health-check.sh → JS Pre-flight Handler  
**Current**: Tech-lead Step 3 (Error Review) runs `bash scripts/health-check.sh` every heartbeat. This is a shell script that runs `tsc --noEmit` and `vitest --run`.
**Pattern stability**: Running since inception. Same script, same outputs, same analysis pattern.
**Proposal**: Create a JS handler `build-health` that runs the health check script and only fires tech-lead if failures are detected. When the build is healthy (most of the time), tech-lead doesn't need to spend an LLM session verifying it.
**Caveat**: This is LOWER priority than Proposals 1 and 2. Tech-lead's health check is embedded within a broader Error Review step that also checks coder/QA memory and workflow runs — those parts need LLM judgment. Splitting just the health-check part out may not save much if tech-lead still needs to run for the other sub-steps.
**Status**: ⏳ Deferred — revisit if Proposals 1-2 prove successful.

### Not Graduated (and why)

| Agent | Step | Why Not |
|-------|------|---------|
| May | Step 1 (Dispatch) | Core creative work — requires judgment about routing |
| May | Step 2 (Follow Up) | Requires reading session output, diagnosing failures |
| May | Step 4 (Signals) | Requires processing and responding to signals |
| Bob | Step 2 (Focus Tasks) | Creative design work |
| Bob | Step 4 (Initiative) | Exploratory, variable — inherently creative |
| Coach | Step 3 (Study/Skills) | Creative — user study, skill development, convention work |
| Evaluator | Step 2 (Signal Quality) | Creative — calibration, criteria evolution |
| Evaluator | Step 3 (Calibration) | Detection is deterministic but investigation needs LLM |
| Tech-Lead | Step 1-2 (Pending/Intake) | Core build work — inherently variable |
| Tech-Lead | Step 4 (Initiative) | Creative — simplicity review, tech debt |
| Scout | All steps | Exploratory research — inherently creative |
| Amy/Amy-Kimi | All steps | Exploratory social media research — creative |
| Coder | All steps | On-demand build work, not scheduled |
| QA | All steps | On-demand review work, not scheduled |
| Master | All steps | On-demand delegation work, not scheduled |
| Optimizer | All steps | Analytical/creative optimization work |

### Next Review
Scheduled: 2026-03-30 (bi-weekly cadence)
