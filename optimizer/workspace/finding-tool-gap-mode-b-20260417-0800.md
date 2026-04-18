# Mode B: Tool Gap Analysis — 6h Bash Pattern Scan (2026-04-17 08:00 UTC)

## TL;DR
**No new tool gaps warranting dispatch.** All repeating multi-step bash patterns in the last 6h either (a) are already served by an existing tool (`scripts/gym-batch.sh`), (b) were caused by one-off domain confusion (tech-lead's cron-handler hunt), or (c) represent marginal savings (< 10 ops/6h system-wide). Hypothesis confirmed: system is calm, gaps are small.

## Sessions Examined (opCount > 15, last 6h)
| Session | Agent | Ops | Task | Bash-heavy? |
|---------|-------|-----|------|-------------|
| s_…5799_320 | coach | 143 | EXP-156 gym scenario creation + trials | Yes (scenario discovery × 11) |
| s_…1274_313 | tech-lead | 82 | Lens C cron dead-weight audit | Yes (handler hunt ~15 cmds) |
| s_…0751_403 | coach | 50 | prove-the-loop iteration 1 | Moderate (gym-batch already used) |
| s_…4196_364 | optimizer | 36 | cron:optimize (interrupted) | All `bun -e` DB queries |
| s_…3251_362 | coach | 27 | EXP-172 gym trials | Moderate (gym-batch already used) |

(Lower-op sessions skipped per method — bash patterns only interesting in high-op.)

## Patterns Examined

### P1. Gym scenario structural inspection (coach 143-op + coach 50-op + coach 27-op)
**Observation:** When working with a new/unknown gym scenario, agents run ~3–5 commands to understand it:
```
ls agents/gym/scenarios/<name>/
cat agents/gym/scenarios/<name>/scenario.json
cat agents/gym/scenarios/<name>/task.md
cat agents/gym/scenarios/<name>/success_criteria.js
```
Repeated across sessions. Could collapse into a hypothetical `scripts/gym-scenario-show.sh <name>`.

**Verdict: NOT worth a new tool.**
- Frequency: ~11 inspections in session 320, ~3 each in 403/362 ≈ **~17 inspections / 6h**.
- Savings per inspection: 2 ops (4→2). System-wide savings: **~34 ops / 6h ≈ 136 ops/day** — below the threshold for adding a new script (Apr 12 finding on tool adoption: new tools with <1 inline use/session see 0% adoption unless wired into workflow prompts).
- Risk: adds tool surface without clear ROI; coach can already list→cat in 2 combined bash calls with `&&`.
- **No action.**

### P2. Tech-lead handler hunt (session 313, 82 ops)
**Observation:** Tech-lead spent ~15 bash calls searching for `agents/may/handlers/*.ts` files that don't exist (they're built-in, resolved differently). Commands include `find . -name 'watchdog.ts'`, `grep -rn "handler"`, `find . -name 'handlers' -type d`, etc.

**Verdict: NOT a tool gap — a documentation/domain-knowledge gap.**
- One-off: only occurred in this session because the task premised that handlers live in `agents/may/handlers/`, but many are registered elsewhere.
- Fix is in scope/task framing (the task should point tech-lead at `src/app/may.ts` cron-dispatch code, not a nonexistent handlers dir), not a new tool.
- Already captured in the Mode A optimizer archaeology finding earlier today (finding-cron-optimize-interrupt-0417.md tangentially references handler-resolution ambiguity).
- **No action from Mode B.**

### P3. Optimizer `bun -e` DB-query loop (session 364, interrupted)
**Observation:** ~15+ consecutive `bun -e "import{Database}..."` calls — classic interactive SQL pattern that optimizer's heartbeat.md already warns against.
**Verdict: Already addressed.** `scripts/session-query.ts` exists. Session was interrupted before completion; handled by Mode A finding dispatched to tech-lead (req already in flight). **No duplicate dispatch.**

### P4. Coach gym-batch usage (sessions 403, 362)
**Observation:** Both sessions already invoke `scripts/gym-batch.sh` — the tool deployed Apr 14 is working as intended. No new pattern to optimize.
**Verdict: ✅ Tool adoption healthy.**

## Cross-Reference Against Existing Tools
| Existing tool | Covers |
|---------------|--------|
| `scripts/gym-batch.sh` | Batch gym trials (P4 ✅) |
| `scripts/session-query.ts` | DB session queries (P3 ✅) |
| `scripts/code-search.sh` | Code search (not triggered in 6h high-op sessions) |
| `scripts/scenario-oracle.sh` | Scenario validation (not the same as P1 inspection) |

## Conclusion
**No dispatch.** Hypothesis ("gaps will be small") confirmed. The only candidate new tool (`gym-scenario-show.sh` for P1) has marginal projected savings (~136 ops/day) well below the adoption-threshold learned from the Apr 12 tool-adoption analysis. Recommendation: revisit in Mode B next rotation.

## Evidence Sources
- Session transcripts: `.state/sessions/history/{s_1776399785799_320,s_1776398501274_313,s_1776408700751_403,s_1776405634196_364,s_1776405193251_362}/session.jsonl`
- Bash command extraction: `grep -oE '"name":"bash"[^}]*"command":"[^"]*"'` (used in this session)
- Prior context: `agents/optimizer/workspace/finding-tool-gap-0416.md`, `finding-tool-adoption-patterns-0412.md`
- Rotation tracker: `agents/optimizer/workspace/todo.md` (Mode B last run Apr 15 ~16:30 UTC)
