# Skill-to-Workflow Conversion Audit

**Date**: 2026-04-02 ~20:30
**Author**: Bob (Architect)
**Purpose**: Identify which declarative skills are candidates for conversion to structural workflows, ranked by expected impact. Addresses maturity audit gap #3.

---

## The Conversion Logic (H-043)

Knowledge utilization rates by form:
- **Structural** (workflows, code): U ≈ 0.9
- **Environmental** (context.md): U ≈ 0.5  
- **Declarative** (skill docs, entries): U ≈ 0.12

Converting a skill from declarative to structural is a 7.5× utilization improvement (0.12 → 0.9). But not all skills CAN be converted. The key criterion from Decision Topology theory: **a skill can be converted to a workflow if the desired behavior consists primarily of eliminable decisions (R > 0.5).**

## Already Converted (4 skills)

| Skill | Workflow | Result | R estimate |
|-------|----------|--------|------------|
| verify-before-finish | 2-phase: test → finish | 5/6→6/6 | ~0.85 |
| evidence-over-narrative | 3-phase: read → calculate → compare | 5/8→11/11 | ~0.90 |
| obstacle-pivot | 2-phase: assess → act/escalate | 0%→100% | ~0.95 |
| tool-discipline | 2-phase: discover → execute | 0%→100% | ~0.90 |

**Pattern**: All successful conversions have R > 0.8. The workflow eliminates the decision about WHETHER to do the right thing by making it the ONLY thing.

## Failed Conversion (1 skill)

| Skill | Why It Failed | R estimate |
|-------|--------------|------------|
| grep-first-reading | Agent ignores grep even in explicit workflow phases. Tool usage habit, not a decision. | R ≈ 0.2 — the "decision" is actually a generation default, not a choice point |

**Lesson**: Skills that target generation habits (what tool to use for the SAME purpose) are not convertible. Skills that target decision sequencing (what to do BEFORE doing X) are convertible.

## Conversion Candidates — Tier 1 (High R, Clear Workflow Shape)

### 1. check-state (R ≈ 0.85)
**Current form**: "Before claiming completion, verify the actual system state."
**Workflow shape**: Phase 1: Run verification commands, write state-report.md. Phase 2: Read state-report.md, proceed only if states match expectations.
**Why high R**: The verification commands are deterministic. The decision "should I verify?" is always YES. Same pattern as verify-before-finish.
**Expected impact**: High. MAST research shows 52% higher failure rate without state checks.
**Blocker**: Needs a gym scenario.

### 2. baseline-before-change (R ≈ 0.80)
**Current form**: "Run tests before making changes to establish baseline."
**Workflow shape**: Phase 1: Run all tests, capture output to baseline.md (NO code changes). Phase 2: Read baseline.md, make changes, run tests, compare.
**Why high R**: "Should I run tests first?" is always YES. Same pattern as tool-discovery.
**Expected impact**: Medium-high. Prevents "I fixed the test but broke something else" pattern.
**Blocker**: Needs a gym scenario.

### 3. state-check-before-action (R ≈ 0.80)
**Current form**: "Before modifying files, check their current state."
**Workflow shape**: Phase 1: Read target files, write current-state.md with checksums. Phase 2: Read current-state.md, make changes.
**Why high R**: Same pattern — the "should I check first?" decision is eliminable.
**Expected impact**: Medium. Prevents blind overwrites.
**Blocker**: Overlaps significantly with check-state. May be better to merge.

### 4. coder-edit-discipline (R ≈ 0.75)
**Current form**: "Use precise edits, not full-file rewrites."
**Workflow shape**: Phase 1: Read file, identify exact section to change, write edit-plan.md with old/new text. Phase 2: Read edit-plan.md, apply edits, verify.
**Why high R**: The decision "should I use edit() vs write()?" is deterministic (edit for small changes).
**Expected impact**: Medium. Prevents data loss from truncated write() calls.
**Blocker**: Harder to enforce because the essential decisions (what to change) are interleaved with the eliminable ones (how to change it).

### 5. deliverable-integrity (R ≈ 0.80)
**Current form**: "Ensure finish() claims match actual session output."
**Workflow shape**: Phase 1: List all files modified, list all claims in draft finish(). Phase 2: Cross-reference list, remove unverified claims, add missing files.
**Why high R**: "Does my claim match my work?" is verifiable.
**Expected impact**: High for system trust. Prevents hallucinated deliverables.
**Blocker**: The two-phase structure may be too expensive for every session.

## Conversion Candidates — Tier 2 (Medium R, Less Clear Shape)

### 6. classify-then-act (R ≈ 0.55)
**Current form**: "Classify the task before jumping in."
**Workflow shape**: Phase 1: Write classification.md (task type, R estimate, approach). Phase 2: Execute based on classification.
**Problem**: The classification itself is an essential decision (judgment required). The workflow can force the STEP but not the QUALITY.
**Verdict**: Convertible but with lower expected improvement than Tier 1.

### 7. scope-discipline (R ≈ 0.45)
**Current form**: "Finish what you started, don't expand scope."
**Workflow shape**: Phase 1: Write scope.md with explicit boundaries. Phase 2: After each action, check against scope.md.
**Problem**: "Is this in scope?" is a judgment call (essential decision). The workflow adds a checkpoint but the decision quality depends on agent judgment.
**Verdict**: Soft workflow (gate, not full enforcement).

### 8. search-strategy-escalation (R ≈ 0.50)
**Current form**: "3-phase search discipline: targeted → broader → ask."
**Workflow shape**: Already has natural phases! Phase 1: Targeted search. Phase 2: Broader search if Phase 1 fails. Phase 3: Escalate.
**Problem**: "Has my search failed?" is subjective.
**Verdict**: Partially convertible — the escalation triggers can be structural (attempt count, timeout).

## Not Convertible (R < 0.3)

| Skill | Why Not | R |
|-------|---------|---|
| brainstorm-before-build | Brainstorming IS essential decisions. Can't workflow-ify creativity. | ~0.15 |
| plan-once-amend | Planning is essential. The "amend vs start over" decision is judgment. | ~0.20 |
| materialize-intermediate-findings | "What findings are worth materializing?" is judgment. | ~0.25 |
| progressive-work-persistence | "What to checkpoint when?" is judgment. | ~0.20 |
| grep-first-reading | Proven not convertible. Tool habit, not decision. | ~0.20 |

## Not Applicable (meta-skills, agent-specific, or process skills)

These skills describe processes, not behaviors that can be captured in a per-task workflow:
- agent-coordination, agent-growth, agent-gym, skill-lifecycle, knowledge-sharing
- handoff, delegation-verification, l3-delegation-metrics
- patterns, request-triage-memoization, web-scraping
- evaluator-scoring (already structural — it IS the scoring code)

## Recommended Conversion Priority

| Priority | Skill | Estimated Effort | Expected Impact |
|----------|-------|-----------------|-----------------|
| 1 | check-state | Low (same pattern as EXP-013) | High (52% failure reduction) |
| 2 | deliverable-integrity | Medium | High (trust metric) |
| 3 | baseline-before-change | Low (same pattern as EXP-015) | Medium-high |
| 4 | coder-edit-discipline | Medium | Medium |
| 5 | classify-then-act | Medium | Medium (but tests mid-R) |

**Note**: #5 is especially interesting because it would test mid-R workflow effectiveness — the biggest gap in our Decision Topology data (see maturity audit §3.1). Converting classify-then-act and testing it could serve double duty as an EXP-012-like experiment.

---

## How to Convert a Skill

Based on the 4 successful conversions, the pattern is:

1. **Identify the eliminable decisions** in the skill
2. **Design Phase 1** to force those decisions (assessment, discovery, verification)
3. **Block the default behavior** in Phase 1 (e.g., "do NOT run tests yet", "do NOT make changes yet")
4. **Design Phase 2** to act on Phase 1 output (read the plan, execute)
5. **Create a gym scenario** that exercises the skill failure mode
6. **A/B test**: baseline (no workflow) vs treatment (workflow)

The blocking instruction in Phase 1 is critical. Without "do NOT [habitual action]", the agent jumps ahead and the workflow collapses.

---

*This audit is a living document. Update after each conversion attempt.*
