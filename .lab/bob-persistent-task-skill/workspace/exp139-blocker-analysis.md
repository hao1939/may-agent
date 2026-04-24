# EXP-139 Production Pilot Blocker Analysis

**Date**: 2026-04-11
**Author**: Bob (Research)
**Status**: Analysis complete — actionable proposal included

---

## 1. Background

EXP-139 is the production pilot for H-102 (Workflow Adoption Determines Behavioral Internalization). The experiment aims to deploy `verify-wrap` workflow to scout and measure whether workflow-mediated verification produces better behavioral internalization than tool-level guards alone.

**The blocker**: Tech-lead assessed that `verify-wrap` is not viable for scout because scout doesn't fork work sessions — it does all work inline during heartbeats.

## 2. Is the Tech-Lead's Assessment Correct?

**Partially correct, but stale and incomplete.**

### What's accurate:
- Scout does NOT fork work sessions. All work is done inline within heartbeat sessions.
- Scout's dispatch pattern is `agents.call({action: 'fork'})` in its heartbeat template, but in practice scout processes tasks inline during heartbeats rather than spawning separate work sessions.
- `verify-wrap` was designed for agents that dispatch work via `workflow.run('verify-wrap', task)`, which wraps a forked work session with pre/post verification gates. An agent that never forks never hits these gates.

### What's stale:
- Coach has ALREADY partially deployed EXP-139. The deployment log shows the heartbeat patch was applied, and scout's heartbeat now references `verify-wrap` in its workflow table (lines 55-57).
- However, the deployment is **inconsistent**: the heartbeat's workflow table mentions `verify-wrap`, but the actual dispatch template (line 65) still shows the raw `agents.call({action: 'fork'})` pattern rather than `workflow.run('verify-wrap', ...)`.
- The deployment log marks the heartbeat patch as "pending on May" (unchecked checkbox), confirming incomplete deployment.

### Assessment summary:
The tech-lead correctly identified the **architectural mismatch** — verify-wrap assumes fork-based dispatch, scout uses inline execution. But framing this as a simple "blocker" understates the situation. The real issue is that **scout's execution model is fundamentally different from bob's**, making verify-wrap (as currently designed) structurally incompatible.

## 3. Viable Alternatives

### Option A: Modify scout to use forked work sessions
- **Feasibility**: LOW. Scout's inline-heartbeat model is intentional — scout is a scanning/routing agent, not a deep-work agent. Forcing fork-based dispatch would change scout's fundamental architecture.
- **Informativeness**: HIGH if it worked — would directly test H-102. But the behavioral change itself would confound results.
- **Verdict**: Not recommended. Changes the independent variable.

### Option B: Design inline verify-after-write mechanism
- **Feasibility**: MEDIUM-HIGH. Instead of wrapping a forked session, insert verification checkpoints into scout's inline workflow. After scout writes/edits a file, a lightweight verification step runs within the same heartbeat.
- **Informativeness**: MEDIUM. Tests a variant of H-102 — "inline workflow steps" rather than "workflow-wrapped sessions." This is a meaningfully different intervention than what bob uses.
- **Implementation**: Add a `verify-inline` workflow or helper that scout calls after each write operation within its heartbeat. Could be as simple as: `workflow.run('verify-inline', {file, checks})`.
- **Verdict**: Most feasible. But tests a different mechanism than the original H-102 design.

### Option C: Test with a different reliant agent (optimizer or may)
- **Feasibility**: MEDIUM. Optimizer and may both have different dispatch patterns. Would need to assess whether either uses fork-based work sessions.
- **Informativeness**: HIGH — if another agent uses fork-based dispatch, we get a clean H-102 test without modifying anyone's architecture.
- **Verdict**: Worth investigating. Requires checking optimizer/may dispatch patterns.

### Option D: Accept as H-102 boundary condition
- **Feasibility**: HIGH (no work needed).
- **Informativeness**: LOW — we learn nothing new, just document a limitation.
- **Verdict**: Acceptable fallback, but premature. We haven't exhausted alternatives.

## 4. Recommendation: Hybrid Approach (B + C)

### Primary path: Option B — Inline verification for scout
Design `verify-inline` as a lightweight verification mechanism that works within scout's heartbeat execution model:

1. **Define verification checks** specific to scout's outputs (routing decisions, file edits, brief deliveries)
2. **Insert verification calls** after scout's write operations within the heartbeat template
3. **Measure** whether inline verification produces behavioral internalization (same metrics as EXP-139 original design: error rate, self-correction frequency, verification habit formation)

This tests a **variant** of H-102: does workflow-mediated verification internalize regardless of whether the workflow wraps a fork or runs inline? If yes, H-102 is stronger than originally formulated. If no, we learn that the fork-based session boundary is a critical factor.

### Secondary path: Option C — Identify fork-based agents
Survey optimizer and may to determine if either uses fork-based work dispatch. If so, run the original EXP-139 design (verify-wrap) on that agent as a parallel test.

### Research value of the hybrid:
Running both paths gives us a **2x2 comparison**:
- Bob (fork-based + verify-wrap) — already has data from EXP-130
- Scout (inline + verify-inline) — new via Option B
- [Other agent] (fork-based + verify-wrap) — new via Option C if viable

This comparison would let us **decompose** H-102 into sub-factors: is it the workflow adoption per se, or the fork-based session boundary that drives internalization?

## 5. Concrete Next Steps

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Design `verify-inline` specification (what it checks, how it integrates with heartbeat flow) | Bob | P1 |
| 2 | Survey optimizer/may dispatch patterns for fork-based work sessions | Bob | P2 |
| 3 | Update EXP-139 design doc to reflect hybrid approach | Bob | P1 (after #1) |
| 4 | Send design brief to tech-lead for `verify-inline` implementation | Bob | P1 (after #1) |
| 5 | Update H-102 with "execution model" as a moderating variable | Bob | P2 |

## 6. Impact on H-102

This analysis reveals that H-102 as originally stated — "workflow adoption determines behavioral internalization" — may need refinement. The scout blocker exposes a hidden moderator: **execution model** (fork-based vs. inline).

**Proposed H-102 refinement**: "Workflow-mediated verification determines behavioral internalization, with the execution model (forked session vs. inline heartbeat) as a moderating variable that affects the strength but not the direction of the effect."

This is a research *opportunity*, not just a blocker resolution. The scout incompatibility forces us to think more precisely about what aspect of workflow adoption drives internalization.

---

## 7. ADDENDUM: Optimizer is the Ideal Pilot Agent (2026-04-11 15:00)

**Survey of optimizer/may dispatch patterns reveals a clear winner:**

| Agent | Forks work sessions? | verify-wrap in heartbeat? | Reliant (EXP-137)? | Viable? |
|-------|---------------------|--------------------------|--------------------|---------| 
| Scout | ❌ Inline heartbeats | Partially (inconsistent) | ✅ Yes | ❌ No |
| Optimizer | ✅ `agents.fork(...)` | ✅ Yes (line 52) | ✅ Yes (reliant) | ✅ **YES** |
| May | ❌ Coordinator/dispatcher | No | ✅ Yes (worst reliant, 71%) | ❌ No |

**Optimizer is the ideal pilot agent:**
1. Uses fork-based work sessions (verify-wrap compatible)
2. Already references `workflow.run('verify-wrap', task)` for investigation tasks
3. Classified as reliant in EXP-137 (has the FM-3.3 pattern we want to fix)
4. Has dispatcher structure similar to learner agents (scout also has this but lacks forking)

**Revised recommendation**: Run EXP-139 on **optimizer** instead of scout. The experimental design transfers directly — only the agent name changes. This preserves the original EXP-139 methodology while working around the scout architectural blocker.

Keep the scout `verify-inline` design (Option B) as a secondary test to decompose the fork vs. inline moderator variable.

*Cross-references: H-102, EXP-139, EXP-130 results, WKWA-009 (Behavioral Internalization Illusion)*
