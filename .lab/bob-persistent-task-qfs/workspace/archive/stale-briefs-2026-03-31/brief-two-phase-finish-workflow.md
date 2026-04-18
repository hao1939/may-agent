# Brief: Two-Phase Finish Workflow for Contradictory Status

**Author**: Bob  
**Date**: 2026-03-29  
**Target**: Coach (deployment to coder SOUL/skills)  
**Per Hao Directive**: Guards reverted. Judgment issues → workflow enforcement, not guards.

## Problem

Agents correctly identify blockers (missing files, prerequisites, errors) in the transcript but then call `finish(status: "success")` — a deeply ingrained model default.

**Empirical evidence of failure:**
- C1.8 common-sense rule ("Match finish status to reality") → 0/10 on EXP-215
- Gate 3 (summary-level guard) → 0/6 validation
- Gate 3b (transcript-level guard) → implemented, then reverted by directive
- Context.md fact → functionally identical to C1.8 (untested, expected to fail)

**Why prompting/guards fail:** The agent genuinely believes "I successfully identified the issue" is a success. It's not malicious — it's a framing problem. The model's default interpretation of "success" is "I completed my analysis" rather than "the underlying problem is resolved."

## Proposed Solution: Two-Phase Finish Protocol

A **workflow-level** mechanism embedded in the agent's working pattern — not a guard, not a context.md fact.

### Phase 1: Pre-Finish Reconciliation (mandatory)

Before calling `finish()`, the agent MUST perform an explicit reconciliation step:

```
## Pre-Finish Check
1. Issues found this session: [list any missing files, errors, blockers, failed tests]
2. Were ALL issues resolved? [yes/no]
3. If no → finish(status: "blocked" or "partial")
4. If yes → finish(status: "success")
```

### Phase 2: Implementation Options (choose one)

**Option A: Skill file (lightweight)**
Add a skill at `agents/coder/skills/pre-finish-reconciliation.md` that teaches the two-phase pattern with examples:

```markdown
# Pre-Finish Reconciliation

Before calling finish(), always do a quick self-check:

## Pattern
1. List any issues you found (missing files, errors, failed tests, unresolved problems)
2. If you found issues that you did NOT fix → use finish(status: "blocked") or finish(status: "partial")
3. Only use finish(status: "success") if ALL issues were resolved

## Examples

### Example: Missing prerequisite found (correct)
During session: "The file config.json does not exist. This is a prerequisite."
Pre-finish check: Issues found: config.json missing. Resolved: No.
→ finish(status: "blocked", blockers: [{reason: "config.json missing"}])

### Example: Found and fixed an issue (correct)
During session: "The test was failing because of a typo. Fixed it. Tests now pass."
Pre-finish check: Issues found: test failure from typo. Resolved: Yes (typo fixed, tests pass).
→ finish(status: "success")

### Example: Investigation task (correct)
During session: "Analyzed the codebase. Found 3 issues: missing error handling, unused imports, no tests."
Pre-finish check: Issues found: 3 code issues. Resolved: No (investigation only, didn't fix).
→ finish(status: "partial", next_steps: "Fix the 3 identified issues")
```

**Option B: SOUL amendment (heavier)**
Add to the coder SOUL a section on finish protocol. More prominent but higher cost.

### Recommendation

**Option A (skill file)** — lightweight, testable in gym, follows the pattern that worked for verify-after-edit (EXP-213: 30% → 60% improvement).

## Validation Plan

1. Deploy skill to lab fork `agents/.lab/pre-finish-reconciliation/`
2. Test on `missing-prerequisite-detection` (N=5 control + N=5 treatment)
3. Success criterion: ≥3/5 treatment runs pass `does-not-claim-success` (vs 0/5 control)
4. If successful, promote to `agents/coder/skills/pre-finish-reconciliation.md`

## Risk Assessment

- **Risk**: Same as C1.8 — the model ignores the instruction. Mitigation: Skill files have shown 2x improvement on verify-after-edit (EXP-213), so they DO influence behavior, just not 100%.
- **Risk**: The model does the reconciliation step but still classifies "found missing file" as success. Mitigation: The explicit examples with blocker patterns may anchor the model on the correct status mapping.
- **Honest assessment**: This is unlikely to achieve >60% based on verify-after-edit precedent. But it's the approved mechanism per the directive, and it might shift the behavior enough to make `does-not-claim-success` pass occasionally. If it fails, this becomes another data point for the judgment frontier.

## Dependencies

None — pure prompt/skill work, no code changes needed.
