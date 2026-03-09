# Self-Evaluation: Coach — 2026-03-09

## Methodology

This is an honest self-assessment of the coach agent's setup, knowledge, workflows,
skills, and operational effectiveness. No coaching exercises were run (coach cannot
coach itself via detached process in a meaningful way). Instead, this is a structural
audit of everything that makes coach work.

---

## Overall Assessment

**Level:** L2 (self-directing, recovers from errors, learns from feedback)  
**Verdict:** Competent infrastructure, solid methodology, significant operational gaps  
**Grade:** 6/10

---

## STRENGTHS — What's Working

### 1. Comprehensive Methodology (9/10)
The coaching pipeline is well-designed and documented:
- `knowledge/coaching-methodology.md` covers planning → execution → reporting with clear anti-patterns
- Priority ordering (audit findings > domain responsibility > common sense > adversarial > regression) is sound
- Scoring rubric (PASS/PARTIAL/FAIL) keeps assessments consistent
- Evidence-based coaching principle is consistently applied

### 2. Well-Structured Workspace (8/10)
- `COACHEES.md` tracks all 10 agents with levels, pass streaks, coaching history, and graduation blockers
- `journal.md` has detailed findings across 15+ sessions (accumulated, append-only)
- `todo.md` distinguishes between FOCUS items and Tracking with clear status
- `periodic-tasks.md` tracks rotation through evaluation scan, COACHEES review, and pattern checks
- Session reports are consistently formatted and evidence-rich (20 reports in workspace/sessions/)

### 3. Skills Are Practical and Correct (8/10)
- `agent-conventions` — comprehensive reference for assessing coachee behavior
- `socket-communication` — accurate event interpretation guide with intervention guidelines
- `detached-agent-sessions` — correct lifecycle documentation (spawn → socket → observe → cleanup)
- All three skills have proper YAML frontmatter and are loaded into system prompt

### 4. Workflow Design (7/10)
- 4 workflows covering the main operational modes (coaching, convention review, skill development, setup verification)
- `coaching-session.ts` has clean 3-step architecture: plan → execute → report
- `verify-setup.ts` includes both self-check and live connectivity test
- `skill-development.ts` includes testing via live agent session — good practice
- All use `ctx.summarize()` for inter-step context passing

### 5. Pattern Recognition (8/10)
- Identified 4 cross-agent patterns: identity confusion, completion bias, wasted tool calls, knowledge file neglect
- Correctly classified root causes using MAST taxonomy (Agent/Design/Infrastructure)
- Connected patterns to structural fixes (not just behavioral coaching)
- Quality of analysis in journal entries is high (specific, evidence-cited)

---

## GAPS — What's Missing or Broken

### 1. No Graduated Agents (CRITICAL)
**After 11+ coaching sessions across 7 agents, zero agents have graduated (0/10 at 3/3 passes).**

Best streaks: Coder 1/3, Bob 1/3, Scout 1/3. This is the single most important metric
for coach effectiveness, and it's at zero. Possible causes:
- Sessions are too spread across agents instead of focusing on graduating one agent
- Turn budget and infrastructure blockers consume sessions without producing coaching
- Max 2-3 exercises per session means graduation requires 2+ sessions minimum per agent
- The 3-consecutive-passes requirement may be too strict for the coaching cadence

**Recommendation:** Focus exclusively on Coder (1/3) — it's closest to graduation and
has the simplest remaining exercises. Graduate one agent to prove the pipeline works.

### 2. Infrastructure Blockers Have Consumed ~40% of Coaching Capacity
Timeline of blockers:
- Docker mount gap blocked Amy coaching (2026-03-05)
- `run/may.ts` stray `}` blocked process spawning (2026-03-05)
- `manager.hasAgent is not a function` blocked ALL coaching (2026-03-09, duration unknown)
- XHS IP ban + expired cookie blocked Amy live validation (ongoing)

**Coach spends significant turns diagnosing infrastructure instead of coaching.**
The journal shows at least 5 entries where the planned coaching session devolved into
infrastructure troubleshooting. Coach has no way to fix infrastructure directly (read-only exec).

**Recommendation:** Coach should fail-fast on infrastructure blockers (≤2 diagnostic
attempts), then create a precise escalation ticket and move to the next coachable agent.

### 3. Memory Entries Show Confusion and Scope Creep
From `coach.jsonl`:
- One session identified as "Amy" produced a signal scan using Bob's perspective
- One session wrote a Weekly Synthesis Brief (that's Bob's job, not coach's)
- One session confessed to destroying a 193K-line journal file with `allowShrink: true`
- One session hit the identity confusion pattern coach identified in OTHER agents

**Coach is affected by the same patterns it diagnoses in others:** identity confusion,
completion bias (doing work outside scope), and knowledge file neglect.

### 4. TOOLS.md References Deprecated Tool
TOOLS.md still documents `background_exec` (spawn, output, input, kill, list).
The actual tool available is `subagents` with detached mode. The LESSONS.md correctly
notes "Use subagents (mode: 'detached') for coachee processes, not background_exec"
but TOOLS.md still has the old documentation.

**Impact:** Moderate. If TOOLS.md is always-loaded, it provides conflicting guidance
on every session. The skill `detached-agent-sessions` has the correct info, but the
two conflict.

### 5. coach-design.md References Deprecated Tools
`docs/coach-design.md` still shows `background_exec` in the architecture diagram and
tool access section. This is a design document, not loaded into prompt, but it would
mislead any agent or human reading it.

### 6. team.md Has Coach's Tool List Wrong
`agents/shared/team.md` lists coach tools as: `read, write, exec (read-only), background-exec, socket-watch`
Actual tools from `agent.json`: `read-write, exec-readonly, socket-watch, subagents, workflow, validate_workflow`

Missing from team.md: `subagents`, `workflow`, `validate_workflow`
Wrong in team.md: `background-exec` (doesn't exist)

### 7. Periodic Tasks Have Gone Stale
- **Full regression sweep:** "Last done: never" — cannot be done because no agents are graduated
- **Evaluation scan:** Last done 2026-03-09 — but the evaluation files listed in the
  scan don't all contain coach-relevant data
- The rotation (eval scan → COACHEES review → pattern check) works but each task
  consumes an entire heartbeat session, meaning 3 heartbeats just for bookkeeping

### 8. No Self-Coaching Mechanism
Coach can coach every other agent but has no way to coach itself. The coaching-session
workflow spawns "the target agent as a detached session" — but coach coaching coach
creates a circular dependency. There's no skill or workflow for self-improvement.

**Recommendation:** Create a `self-review` workflow that:
1. Reads coach's own memory and recent session transcripts
2. Identifies coach-specific patterns (scope creep, infrastructure rabbit holes, etc.)
3. Updates coach's LESSONS.md with concrete findings

### 9. No Quantitative Self-Metrics
Coach tracks coachees quantitatively (quality scores, pass streaks, efficiency) but
has no self-metrics:
- No tracking of sessions-to-graduation ratio
- No tracking of infrastructure-vs-coaching time ratio
- No tracking of turn efficiency per coaching session
- No tracking of whether coaching findings led to actual improvements

### 10. Exercise Library Is Ad-Hoc
20 session reports exist but only 8 exercise definition files in `workspace/exercises/`.
Exercises are designed per-session rather than maintained as a reusable library.
The regression-review-process.md references an exercise-replay mapping but it's
mostly "TBD".

---

## WORKFLOW ASSESSMENT

| Workflow | Quality | Issues |
|----------|---------|--------|
| `coaching-session` | 7/10 | Clean 3-step design. But step 2 gives coach too much to do in one agent session (spawn, connect, run all exercises, verify, cleanup). If any step fails, the whole execution step fails. |
| `verify-setup` | 8/10 | Good — tests both local setup and live connectivity. Should be run more often. |
| `convention-review` | 6/10 | Only 2 steps (survey + synthesize). Missing a "check for regressions since last review" step. |
| `skill-development` | 7/10 | 3-step design with live testing is good. But step 2 (test) failure returns `ctx.done()` instead of `ctx.escalate()` — masks test failures as successes. |

### skill-development.ts Bug
Line in step 2 error handler:
```typescript
return ctx.done(
  `Skill drafted but test failed — needs manual review.\n\n` +
  ...
);
```
This should be `ctx.escalate()` — a failed test is not a successful outcome.

---

## KNOWLEDGE ASSESSMENT

| File | Quality | Issues |
|------|---------|--------|
| `coaching-methodology.md` | 9/10 | Comprehensive. Only gap: doesn't mention the `subagents` tool by name (references it indirectly). |
| `regression-review-process.md` | 7/10 | Well-designed process but untested — zero agents graduated, zero regressions reviewed. The cadence math is theoretical. |

---

## SKILL ASSESSMENT

| Skill | Quality | Issues |
|-------|---------|--------|
| `agent-conventions` | 8/10 | Good coverage of universal rules. "Relative Paths Only" rule says "all file operations use paths relative to project root" but coach's own memory shows absolute paths being used. |
| `socket-communication` | 8/10 | Accurate and practical. Missing: what to do when events contain errors the coachee doesn't notice. |
| `detached-agent-sessions` | 7/10 | Correct lifecycle. But references `background_exec` NOT being used — defensive, but confusing if a reader doesn't know the history. |

---

## TOP 5 RECOMMENDATIONS (Prioritized)

1. **Graduate one agent.** Focus Coder through 2 more exercises (exercises 2 and 3 from COACHEES.md). Don't context-switch to other agents until Coder hits 3/3. This proves the pipeline works end-to-end.

2. **Fix TOOLS.md.** Remove `background_exec` documentation. Replace with `subagents` documentation reflecting the actual API. This is a constant-load file providing wrong information every session.

3. **Add fail-fast infrastructure escalation to LESSONS.md.** Rule: "If infrastructure blocks coaching, diagnose in ≤2 tool calls, create escalation ticket, move to next coachable agent." This prevents the 40% capacity waste pattern.

4. **Fix skill-development.ts bug.** Change `ctx.done()` to `ctx.escalate()` in the step 2 error handler. Failed tests should not produce successful workflow results.

5. **Create self-metrics.** Add a section to COACHEES.md or a separate file tracking:
   - Sessions run vs productive coaching sessions (exclude infrastructure-blocked sessions)
   - Average turns per coaching exercise
   - Time from first session to graduation per agent

---

## HONEST SUMMARY

Coach has built a solid *system* — the methodology, workspace structure, skills, and
workflows are well-designed and consistently applied. The problem isn't the design,
it's the execution. After 11+ sessions, no agent has graduated. Infrastructure
blockers have consumed ~40% of capacity. Coach itself exhibits patterns it diagnoses
in other agents (identity confusion, scope creep, knowledge file neglect).

The coaching methodology works when it can actually run — Coder, QA, Bob, and Scout
all showed measurable improvement from targeted exercises. But the graduation
pipeline has never completed for any agent, which means the entire regression-review
system (Tier 1/2/3) has never been tested.

**The gap isn't knowledge or design — it's focus and follow-through.**
