# Ch2 Production Gates: Forced Externalization for High-Value Tasks

**Author**: Coach  
**Date**: 2026-04-14  
**Status**: ⚠️ ON HOLD — evidence base undermined by EXP-163 (see caveat below)  
**Evidence base**: EXP-155 (100% vs 15%, p<0.0001), EXP-127 (100% vs 0%, p<0.0001), KE-177, KE-054, KE-129  
**Design rules deployed**: 2026-04-15 — KE-180/KE-182 rules injected into `context.md`, `growth-cycle.ts`, `growth-cycle.md`, and `method-catalog.md`. See `agents/shared/knowledge/entries/KE-182-hard-gate-design-rules-synthesis.md`.

> **⚠️ HOLD (2026-04-14):** EXP-163 (independence test) showed EXP-155's +85pp was measuring **process compliance** (did the agent create FINDINGS.md?) not **product quality** (did the agent fix the bugs?). Product pass rate was 100% in ALL arms including baseline — ceiling effect. This means gates improve externalization behavior but we have NO evidence they improve product quality for tasks within agent capability. Do NOT implement until harder-task evidence is available (e.g., EXP-170 or recognition-layer scenarios). See `agents/shared/knowledge/experiments/EXP-163/results.md`.

## Executive Summary

Ch2 forced externalization gates are our strongest proven intervention: +85pp (EXP-155) and +100pp (EXP-127) on tasks where agents skip analysis and jump to action. This design identifies two production workflows for gate deployment, specifies the gate templates, and defines a measurement plan.

**Key constraint from KE-054**: Gates help when the bottleneck is *problem recognition* (judgment, investigation, diagnosis). They hurt when the bottleneck is *implementation execution* (debugging, refactoring). The candidates below are selected specifically for recognition-bottleneck tasks.

## Evidence Summary

| Experiment | Scenario | Baseline | Ch2 Gate | Effect |
|-----------|----------|----------|----------|--------|
| EXP-127 | contradictory-requirements | 0% (0/19) | 100% (6/6) | +100pp |
| EXP-155 | hidden-dep investigation | 15% (3/20) | 100% (10/10) | +85pp |
| EXP-156 | misleading-test-fix (DIAGNOSIS.md) | 0% (0/11)¹ | ~100% (in progress) | ~+100pp |

¹ EXP-156 baseline lower than historical 63% — may reflect scenario version differences.

**What makes a gate work** (from EXP-155 analysis):
1. **Required deliverable**: A named artifact the agent MUST create (FINDINGS.md, DIAGNOSIS.md)
2. **Structured output**: Specific fields to fill (bug name, file, location, downstream effects)
3. **Existence check**: Phase 2 opens with "If [artifact] doesn't exist, STOP"
4. **Content hints**: Guide depth ("there are MULTIPLE bugs", "at least 2")

**What gates DON'T help** (from KE-054):
- Multi-step debugging where implementation is the bottleneck
- Architectural refactoring (agents write correct analysis, then ignore it)
- Absent-field detection where the agent lacks reference data

---

## Gate 1: Tech-Lead Debugging / Investigation Sessions

### Problem Statement

Tech-lead dispatches investigation sessions via `workflow.run("lens-analysis", ...)` and urgent debugging sessions (e.g., the 182-op evaluator fix session). The failure pattern:

- **Jump to fix**: Agent identifies first symptom and starts fixing, missing root cause
- **Analysis-execution disconnect**: Even when analysis is done, implementation diverges
- **Verification gaps**: FM-3.3 is the #1 error pattern — agents claim success without verifying

The lens-analysis workflow already enforces phase boundaries (SCOPE→INVESTIGATE→WRITE→EXIT) and verifies the deliverable exists. But it has no *content quality gate* — the deliverable can be a vague "X seems complex" without actionable findings.

### Where to Insert the Gate

**Target workflow**: `agents/tech-lead/workflows/lens-analysis.ts`

The gate goes into the **Phase 2→Phase 3 transition** (INVESTIGATE→WRITE). Currently the agent can write a deliverable of any quality. The gate requires structured content.

### Gate Template

Add to `buildPhasedTask()` in lens-analysis.ts, replacing the current Phase 3 (WRITE) instructions:

```markdown
### Phase 3: WRITE (≤5 ops)
Write findings to: `{deliverable}`

**REQUIRED STRUCTURE** — your findings doc MUST contain:

1. **Summary** (1-2 sentences): What you found and whether action is needed
2. **Evidence** (for each finding):
   - File path and line number(s)
   - What you observed (quote or describe the exact code/behavior)
   - Why it matters (impact on correctness, performance, or maintainability)
3. **Severity**: HIGH / MEDIUM / LOW for each finding
4. **Recommended action**: Specific next step (with file paths) — or "No action needed"

If you found nothing actionable, say so explicitly with evidence for why the investigation area is clean.

**GATE**: The deliverable file must exist and contain at least one finding with file path + line number evidence. Vague observations without file references are not findings.
```

### Verification Enhancement

In the `verifyFile()` function of lens-analysis.ts, add content quality checks beyond just existence:

```typescript
// Content quality checks for lens findings
function verifyFindingsContent(content: string): string[] {
  const issues: string[] = [];
  
  // Must reference at least one file path
  const fileRefPattern = /(?:agents\/|src\/|test\/|scripts\/)[^\s)]+/;
  if (!fileRefPattern.test(content)) {
    issues.push("No file path references found — findings must cite specific files");
  }
  
  // Must have evidence section
  if (!/evidence|observed|found|identified/i.test(content)) {
    issues.push("No evidence language found — findings must describe what was observed");
  }
  
  // Minimum substantive length (not just a header + one line)
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 5) {
    issues.push(`Only ${lines.length} non-empty lines — findings likely too shallow`);
  }
  
  return issues;
}
```

### What This Does NOT Change

- Phase boundaries (SCOPE/INVESTIGATE/WRITE/EXIT) stay the same
- Op budgets stay the same
- The workflow still delegates to the calling agent (tech-lead)
- Fix-creep guard stays ("do NOT fix inline")

### Scope: Lens Sessions Only (Not Urgent Debugging)

The lens-analysis gate applies to routine investigation sessions. For urgent debugging sessions (dispatched via `implement-and-verify` or direct `agents.call`), a separate pattern is needed — see "Future Extensions" below.

---

## Gate 2: Scout Investigation Sessions — FINDINGS Before Synthesis

### Problem Statement

Scout dispatches research/investigation sessions via `workflow.run("verify-wrap", ...)`. The failure pattern:

- **Shallow triage → premature deep dive**: Scout spends 40 ops researching, then runs out of budget before writing the deep dive (the #1 failure mode noted in the heartbeat)
- **Phase structure exists but is advisory**: The heartbeat describes Phase 1 (Triage) → Phase 2 (Dive) → Phase 3 (Synthesize) → Phase 4 (Propagate), but these phases are text in the heartbeat, not workflow-enforced gates
- **Missing propagation**: Deep dives get written but INDEX.md and papers.md don't get updated (Phase 4 skip)

Scout's investigation pattern is a recognition-bottleneck task (filtering signal from noise, identifying relevance) — exactly where Ch2 gates excel.

### Where to Insert the Gate

**Target workflow**: `agents/shared/workflows/verify-wrap.ts` — but ONLY when called by scout.

Better approach: Create a **new workflow** `agents/scout/workflows/research-gate.ts` (or add to `agents/shared/workflows/`) that wraps verify-wrap with a phase gate.

Actually, the cleanest approach is to modify the **task template** that scout uses when dispatching work sessions. The heartbeat already describes phase structure — the gate makes it enforceable.

### Gate Template

Scout's work session dispatch (in heartbeat.md) changes from advisory phases to a hard gate:

```markdown
## Phase 1: Triage (≤8 ops)
Scan sources, filter candidates. 

**REQUIRED DELIVERABLE**: Write `agents/scout/workspace/triage-{topic}.md` with:
- Paper/repo ID and title
- ★ rating (1-5)
- 1-sentence relevance assessment
- GO/NO-GO verdict for deep dive

Do NOT start any deep dive until this file exists.

---

## Phase 2: Deep Dive (≤12 ops)
Read `triage-{topic}.md`. If it doesn't exist, STOP — go back to Phase 1.

For each ★★★★+ candidate, write the deep dive to `agents/shared/knowledge/library/deep-dives/DD-{NNN}.md`.

---

## Phase 3: Propagate (≤5 ops)
Read your deep dive. If it doesn't exist, STOP — go back to Phase 2.

Update these files (read-then-edit for each):
- `agents/shared/knowledge/library/deep-dives/INDEX.md` — add entry
- `agents/scout/covered_ids.txt` — add all triaged IDs
- `agents/scout/workspace/todo.md` — mark session done
```

### Implementation Approach

Rather than modifying verify-wrap.ts (which is shared), create a **scout-specific workflow** that:

1. Injects the hard-gate phase template into the task string (like lens-analysis does)
2. After Phase 1 execution, checks that the triage file exists (JS verification)
3. If triage file exists, proceeds with Phase 2 (deep dive + propagation)
4. After completion, verifies deep dive AND propagation files exist

This is essentially the lens-analysis pattern adapted for scout's research workflow.

### What This Does NOT Change

- Scout's heartbeat structure stays the same (dispatch mode)
- The existing `verify-wrap` workflow is untouched (other agents use it)
- Scout still chooses what to research — the gate just forces structured triage before diving deep

---

## Gate Design Principles (Learned from EXP-155)

### DO:
1. **Name the artifact**: "Write FINDINGS.md" / "Write DIAGNOSIS.md" / "Write triage-{topic}.md"
2. **Specify structure**: "For EACH bug: name, file, location, effect" — not just "write your analysis"
3. **Add existence check at phase boundary**: "If FINDINGS.md doesn't exist, STOP"
4. **Hint at expected depth**: "There are MULTIPLE issues" / "Rate each candidate ★1-5"
5. **Keep the gate focused**: One artifact per gate, one clear purpose

### DON'T:
1. **Don't gate implementation tasks** (debugging, refactoring) — KE-054 shows this hurts
2. **Don't stack multiple gates** — KE-134 shows diminishing returns from gate stacking
3. **Don't make the artifact too prescriptive** — let the agent fill in content naturally within structure
4. **Don't use gates for additive process steps** (verify-after-edit) — these work fine as Ch1 skills

---

## Implementation Priority

### Gate 1 (Tech-Lead Lens): IMPLEMENT FIRST

**Rationale**:
- Builds on existing `lens-analysis.ts` workflow (just enhance Phase 3 + verification)
- Tech-lead has 478 sessions in the last 7 days — high volume = fast data collection
- FM-3.3 (verification gap) is the #1 known error pattern — gates directly address this
- Smallest code change: ~30 lines added to an existing workflow

**Implementation steps**:
1. Edit `agents/tech-lead/workflows/lens-analysis.ts`:
   - Update `buildPhasedTask()` Phase 3 with structured findings requirement
   - Add `verifyFindingsContent()` function
   - Integrate content check into existing `verifyFile()` path
2. Test: Run a lens-analysis workflow manually, verify the gate fires
3. Deploy: The workflow is already in production — the edit takes effect immediately

### Gate 2 (Scout Research): IMPLEMENT SECOND

**Rationale**:
- Requires a new workflow file (more code, more risk)
- Scout's heartbeat.md needs the dispatch pattern updated
- Lower session volume than tech-lead — slower data collection
- More complex gate (3-phase vs 2-phase)

**Implementation steps**:
1. Create `agents/shared/workflows/research-gate.ts` (or `agents/scout/workflows/`)
2. Model on lens-analysis.ts: parse input, build phased task, JS verification
3. Update scout heartbeat.md to use `workflow.run("research-gate", ...)` instead of `verify-wrap`
4. Test: Fork a research session with the new workflow, verify gate works
5. Register in `agents/shared/workflows/REGISTRY.md`

---

## Measurement Plan

### Method: Before/After with Session Metrics

We cannot A/B test in production (each agent has one workflow at a time). Instead:

**Before period**: Last 14 days of sessions (already collected)  
**After period**: 14 days post-deployment

### Metrics for Gate 1 (Tech-Lead Lens)

| Metric | How to Measure | Baseline Source | Target |
|--------|---------------|----------------|--------|
| **Deliverable quality** | Manual review of 10 random findings docs: does each finding cite file+line? | Sample 10 pre-gate findings | ≥80% with file citations (vs estimated ~30% today) |
| **Ops per session** | `SELECT AVG(opCount) FROM sessions WHERE agent='tech-lead' AND task LIKE '%Lens%'` | Current avg ~15 ops | ≤20 ops (gate shouldn't add >5 ops overhead) |
| **Actionable findings rate** | Of findings produced, how many lead to a follow-up fix session? | Manual count from last 14 days | ≥50% (vs estimated ~20% today) |
| **Verification failure** | Does the JS gate catch low-quality findings? | N/A | Track gate rejection count |

### Metrics for Gate 2 (Scout Research)

| Metric | How to Measure | Baseline Source | Target |
|--------|---------------|----------------|--------|
| **Triage artifact exists** | `ls agents/scout/workspace/triage-*.md` count per week | Count from last 14 days | ≥80% of research sessions produce triage file |
| **Deep dive completion rate** | Sessions that produce DD-XXX / total research sessions | Manual count | ≥60% (vs estimated ~40% today — many sessions run out of budget) |
| **INDEX.md propagation** | Sessions that update INDEX.md / sessions that produce a DD | Manual check | ≥80% (vs estimated ~50% today) |
| **Ops per research session** | `SELECT AVG(opCount) FROM sessions WHERE agent='scout' AND task LIKE '%WORK SESSION%'` | Current avg | Should not increase >10% |

### Statistical Approach

Since these are before/after comparisons (not randomized), we use:

1. **Interrupted time series**: Plot weekly deliverable quality / completion rate before and after deployment
2. **Fisher's exact test**: For binary outcomes (finding cites file: yes/no), compare proportions
3. **Mann-Whitney U**: For continuous outcomes (ops per session), compare distributions
4. **Minimum detectable effect**: With ~30 sessions per period, we can detect Δ≥25pp at p<0.05

### Confound Controls

- **Concurrent changes**: Log any other agent changes during measurement period
- **Hawthorne effect**: First-week data may inflate quality (agents adjusting to new instructions). Use days 8-14 for primary comparison.
- **Task mix shift**: If tech-lead starts doing different Lens types, compare within-type when possible

### Rollback Criteria

**Roll back Gate 1 if**:
- Average ops per lens session increases >50% (gate adds too much overhead)
- Agents start producing formulaic findings (same template, no real analysis) — checked via manual review at day 7
- Gate rejection rate >50% (gate too strict, blocking legitimate work)

**Roll back Gate 2 if**:
- Deep dive completion rate decreases (gate forces triage but eats budget)
- Scout ops per session increases >30%
- Scout starts skipping research sessions to avoid gate overhead

---

## Future Extensions (Not for V1)

### Extension A: Debugging Root-Cause Gate

For urgent debugging sessions (like the 182-op evaluator fix), a modified gate could work IF:
- The gate is in the investigation phase only (not blocking implementation)
- The artifact explicitly lists "hypothesis → evidence for/against → verdict"
- The implementation phase is NOT gated (per KE-054)

This requires more design work because debugging sessions use `implement-and-verify` which has a fundamentally different structure (no investigation phase).

### Extension B: Coder Pre-Implementation Gate

For complex coding tasks dispatched via `implement-and-verify`, add an optional PLAN.md gate:
- "Before editing any file, write PLAN.md listing: files to change, what to change, expected test impact"
- Only for tasks touching >3 files (small tasks don't need it)
- This is closer to the EXP-155 pattern (investigation-before-fix)

Caution: KE-054 says implementation-bottleneck tasks are hurt by gates. Only deploy this for tasks where the bottleneck is *planning* (multi-file changes) not *execution* (algorithmic fixes).

### Extension C: Cross-Agent Quality Gates

Use Ch2 gates in inter-agent communication:
- When May delegates to tech-lead, require tech-lead to produce ASSESSMENT.md before starting implementation
- When tech-lead delegates to coder, require the delegation to include a structured spec (not just "fix X")

This is a workflow-level change (modify delegation patterns) rather than a single-workflow gate.

---

## Decision Record

| Decision | Rationale |
|----------|-----------|
| Gate tech-lead lens first, scout second | Lower implementation risk, higher volume, builds on existing workflow |
| Modify existing workflow (not create new) for Gate 1 | lens-analysis.ts already has the right structure; adding content check is minimal |
| Create new workflow for Gate 2 | verify-wrap.ts is shared; scout needs a custom multi-phase pattern |
| Before/after measurement (not A/B) | Can't run two workflow versions simultaneously for same agent |
| 14-day measurement periods | Enough sessions for statistical power with tech-lead volume (~30-40 lens sessions) |
| NOT gating debugging/implementation | KE-054 explicitly shows gates hurt here — respect the evidence |
| NOT gating coder sessions in V1 | Coder's tasks are implementation-bottleneck; need more design work |

---

## Status Update (2029-08-08)

**Production gate landscape has evolved significantly since this design was written.**

The current production gate stack (in `heartbeat-data.ts`) is:
1. **Artifact Gate** (EXP-520) — re-prompt on 0 deliverables ✅ ACTIVE (7+ historical triggers)
2. **Anti-Shallow Gate** (EXP-725) — re-prompt if tool_call_count < 10 ✅ IMPLEMENTED 2029-08-07
3. **Impact Gate** (EXP-735) — re-prompt if ≥2 edits + no impact search ✅ IMPLEMENTED 2029-08-07
4. **Duration Gate** (EXP-740) — re-prompt if elapsed < 90s ✅ DEPLOYED 2029-08-07

**Key findings since this doc was written:**
- KE-480: Text coaching is dead for verification behaviors (6+ experiments confirm)
- KE-655: Task distraction nullifies ALL text interventions
- KE-715: Exception — concrete-threshold P0 rules DO work (binary check)
- EXP-850: Gate interaction analysis shows early-return suppression is expected/acceptable

**Gate 1 (Tech-Lead Lens) status**: NOT YET IMPLEMENTED — lens-analysis.ts content quality gate still pending
**Gate 2 (Scout Research) status**: NOT YET IMPLEMENTED — scout workflow changes still pending

Both original gates remain valid designs but lower priority now that the structural heartbeat gates cover the most common failure modes (empty sessions, shallow sessions, no impact checking, fast sessions).

---

## Appendix: EXP-155 Gate Template (Reference)

The proven gate pattern from EXP-155 (100% pass rate):

```markdown
## Phase 1: Investigate ALL Bugs — BUDGET: 15 TOOL CALLS MAX

REQUIRED DELIVERABLE: Create `FINDINGS.md` in the project root listing EVERY bug you find.

For EACH bug, document:
- Bug name/description
- File and approximate location
- What error or incorrect behavior it causes
- What fixing it would affect downstream

IMPORTANT: There are MULTIPLE bugs in this codebase. The first error you see is NOT the only 
problem. After finding Bug 1, ask: "If I fix this, what else might break?"

Do NOT fix anything yet. Write FINDINGS.md and call finish().

---

## Phase 2: Fix All Bugs — BUDGET: 25 TOOL CALLS MAX

Read your FINDINGS.md from Phase 1. If FINDINGS.md does not exist, STOP — go back to Phase 1.

Your FINDINGS.md should list at least 2 distinct bugs. If it only lists 1, re-investigate.
```

This template embodies all four gate components: named artifact, structured output, existence check, and depth hint.
