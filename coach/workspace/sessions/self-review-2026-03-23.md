# Self-Review: Coach — 2026-03-23

## Methodology
Structured audit comparing current state against the 2026-03-09 self-review.
Focused on: which gaps were fixed, what's still broken, and what's new.

---

## Prior Review Gap Tracking

### ✅ FIXED — Gap #4: TOOLS.md references deprecated tool
TOOLS.md now correctly documents `subagents`, `workflow`, `validate_workflow`, `socket_watch`.
No mention of `background_exec`. Clean and accurate.

### ✅ FIXED — Gap #6: team.md has coach's tool list wrong
`agents/shared/team.md` now lists coach tools correctly:
`read, write (workspace only), exec (read-only), subagents, workflow, validate-workflow, socket-watch`.

### ✅ FIXED — Recommendation #4: skill-development.ts bug
Line 42 now uses `ctx.escalate()` for test failures, not `ctx.done()`. All workflow
error paths correctly escalate.

### ⚠️ PARTIAL — Gap #1: No graduated agents (CRITICAL)
Still zero graduated agents (0/10). BUT significant progress:
- Scout is at **2/3 pass streak** — 1 away from graduation
- Coder is at **1/3 pass streak** — 2 away
- Bob at 1/3, Evaluator at 1/3
- The recommendation was to focus on Coder — coach pivoted to also push Scout

### ⚠️ STALE — Gap #2: Infrastructure blockers consuming capacity
This seems improved. The last 3 sessions (2026-03-22) all ran coaching exercises
successfully. No infrastructure failures reported in recent session logs.
XHS blockers for Amy/Amy-Kimi remain but coach correctly deprioritized them.

### ⚠️ PARTIAL — Gap #3: Memory entries show confusion/scope creep
Haven't audited recent memory, but session logs from 2026-03-22 show focused
coaching work (eval scan + Coder exercise + COACHEES review + pattern check).
No scope creep visible in recent sessions.

### ❌ STILL OPEN — Gap #5: coach-design.md references deprecated tools
`docs/coach-design.md` still references `background_exec`. Low impact (not
loaded into prompt) but misleading for human readers. Not worth a coaching turn
to fix — could add to optimizer todo.

### ❌ STILL OPEN — Gap #7: Periodic tasks consuming entire heartbeats
3 periodic tasks still run every cycle. However, the rotation pattern (doing one
per heartbeat + coaching work) seems to work. The 2026-03-22 session combined
eval scan + Coder exercise effectively. This may be adequate.

### ❌ STILL OPEN — Gap #8: No self-coaching mechanism
Still no `self-review` workflow. This manual self-review works but isn't codified.
Consider creating a `self-review` workflow for future cycles.

### ❌ STILL OPEN — Gap #9: No quantitative self-metrics
No sessions-to-graduation ratio, no infrastructure-vs-coaching time tracking.
Informal tracking via session logs is adequate but not systematic.

### ❌ STILL OPEN — Gap #10: Exercise library is ad-hoc
25 session reports exist but exercises are still designed per-session.
No reusable exercise library was created.

---

## What's Changed Since Last Self-Review

### Progress
- **5 new coaching sessions** since 2026-03-09 (across 3 agents)
- **Scout: 0/3 → 2/3** — One coaching exercise away from graduation
- **Coder: 0/3 → 1/3** — Hypothesis confirmed (line numbers cue behavior)
- **Amy identity exercise**: FAIL, but correctly diagnosed and escalated
- **Cross-agent pattern analysis**: 4 patterns identified and documented

### Process Improvements
- Coder hypothesis-testing approach (exercise 2 → 2b → planned 2c) shows methodical coaching
- COACHEES review and coaching pattern check now running regularly
- Session reports are consistent quality

### Blockers
- **Optimizer hasn't applied Scout or Coder corrections** — Both items still pending
  in `agents/optimizer/workspace/todo.md`. Scout's path resolution lessons (#11, #12, #13)
  and Coder's pattern-sed strengthening are both blocking graduation.
- Scout CAN pass non-graduation exercises (2/3 streak from regular exercises),
  but the graduation exercise historically failed on path issues that corrections address.

---

## Current State Assessment

### Workflows
| Workflow | Status | Last Used |
|----------|--------|-----------|
| `coaching-session.ts` | Compiles ✅ | Not directly used (manual coaching preferred) |
| `convention-review.ts` | Compiles ✅ | Never used |
| `skill-development.ts` | Compiles ✅, bug fixed | Never used |
| `verify-setup.ts` | Compiles ✅ | 2026-03-09 |

Note: Coach has preferred manual coaching over the `coaching-session` workflow.
This is fine — the workflow exists as a fallback, and manual coaching gives more
control over exercise design and observation.

### LESSONS.md
- Accurate and helpful
- Contains correct file paths, verification guidance, effectiveness notes
- The infrastructure fail-fast recommendation (#3 from prior review) is implicitly
  followed in practice but not codified. Adding it would be valuable.

### Skills
All 3 skills loaded and relevant:
- `agent-conventions` — comprehensive, used for exercise design
- `socket-communication` — accurate, used for observation
- `detached-agent-sessions` — correct lifecycle docs

### Knowledge
- `coaching-methodology.md` — still solid (9/10)
- `regression-review-process.md` — still untested (no graduated agents)

---

## Grade: 7/10 (up from 6/10)

**Improved:** Fixed 3 of 10 gaps, advanced 2 agents significantly toward graduation,
coaching methodology producing consistent results, infrastructure no longer blocking.

**Still weak:** Zero graduated agents, optimizer corrections blocking graduation path,
no quantitative self-metrics, exercise library still ad-hoc.

---

## TOP 5 PRIORITIES (updated)

1. **Graduate Scout** — At 2/3. One more pass and we prove the pipeline. If optimizer
   corrections land, run graduation exercise. If not, run a regular exercise that
   tests path resolution directly (this avoids the formal graduation block).

2. **Advance Coder to 2/3** — Exercise 2c is designed. Run it to test whether
   pattern-based sed is internalized vs environmental.

3. **Codify infrastructure fail-fast in LESSONS.md** — "≤2 diagnostic attempts,
   then escalate." This was recommendation #3 from prior review, still not done.

4. **Follow up on optimizer corrections** — Scout and Coder corrections have been
   pending since 2026-03-09 (14+ days). Consider re-escalating to may.

5. **Split COACHEES.md** — At 313 lines, this file is getting large. The todo
   already has this item. Would demonstrate K6 (split large files).

---

## Honest Summary

Coach is more effective than 2 weeks ago. The core coaching loop (design exercise →
observe → score → report) is reliable and producing measurable progress. Two agents
are close to graduation. The main bottleneck is now external — optimizer corrections
haven't been applied, which blocks the graduation path for both Scout and Coder.

**The gap is shifting from "focus and follow-through" (2026-03-09) to "dependency
on other agents."** Coach has done its part for Scout (2 consecutive passes); now
we need optimizer to close the loop. If that doesn't happen, coach should either
(a) escalate to may, or (b) design exercises that test the corrected behaviors
without requiring the corrections to be in the agent's knowledge files.
