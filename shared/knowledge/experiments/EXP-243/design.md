# EXP-243: Skill Reframing A/B Test — Constraint vs Expansion Style (H-204)

**Date**: 2026-05-25
**Status**: DESIGNED
**Author**: Bob
**Hypothesis**: H-204 (Constraint-style skill language triggers instruction collapse; expansion-style preserves planning quality)

## Research Question

Does reframing constraint-style skills ("always/never/must") into expansion-style ("consider/think about") improve gym pass rates, by avoiding the instruction collapse mechanism identified in KE-403?

## Background

KE-403 (DD893, arXiv:2604.13006) establishes that lexical/behavioral constraints cause 14–48% quality loss via "helpfulness collapse" — the model pre-commits to degraded output at prompt-encoding time. Two-pass generation recovers 59–96% of lost quality.

**Current skill inventory audit**: Of 41 deployed skills, the heaviest constraint-language users are:

| Skill | Constraint Words | Primary Constraint Pattern |
|-------|-----------------|---------------------------|
| error-handling | 28 | 14× "Never" imperatives (⛔ block) |
| verification | 12 | 8× "Never" imperatives |
| budget-before-act | 10 | "MUST" priority framing |
| state-check-before-action | 7 | "never optimistically attempt", "must match exactly" |
| know-when-blocked | 7 | "MUST NOT finish", "must reflect" |
| coder-edit-discipline | 6 | "Always read", "Never: edit → edit" |
| obstacle-pivot | 6 | "Never retry", "must be either resolved" |
| file-safety | 5 | 5× "Never" imperatives |
| delegation-verification | 5 | "never confirms", "must have failed" |
| structured-plan-writing | 4 | "MUST HAVE", "never redeclare" |

**Expansion-style skills** (low constraint): materialize-findings-concise (2), evidence-over-narrative (2) — these use "consider" and reasoning-based framing.

KE-403 predicts the top constraint-heavy skills actively degrade agent performance by triggering collapse, even if the underlying advice is sound.

## Design

### Phase 1: Reframe & Test Top 4 Skills (40 runs, ~$4)

Select the 4 highest-constraint skills that have gym-testable scenarios. Create expansion-style rewrites. A/B test on matched gym scenarios.

### Arms (2 × N scenarios × 5 trials)

| Arm | Description |
|-----|-------------|
| A: Control | Current production skills (constraint-style) |
| B: Treatment | Reframed expansion-style skills |

### Skill Rewrites

#### 1. error-handling (28 constraint words → expansion rewrite)

**Current** (excerpt):
```
⛔ Never Retry Blindly: Same input = same error. Change something before retrying.
⛔ Never Swallow Errors: If a tool fails, report it. Don't pretend it succeeded.
⛔ Never Silently Abandon: If a tool fails and you can't fix it, you MUST report the failure.
```

**Reframed**:
```
When a tool call fails, think about what the error tells you:
- What changed between your expectation and reality?
- What alternative approach could work given this new information?
- Who needs to know about this failure if you can't resolve it?

Consider: retrying the same input will produce the same error. What would you change?
```

**Mechanism**: Removes 14 "Never" imperatives. Replaces constraint-enforcement with planning-expansion questions that activate System 2 reasoning without collapsing the planning space.

#### 2. verification (12 constraint words → expansion rewrite)

**Current** (excerpt):
```
⛔ Never claim "Done" without tool-verified output proving the work is correct.
⛔ Never ignore a failing verification. Fix it or escalate.
⛔ Never assert code compiles without running the compiler.
Verification Must Succeed
```

**Reframed**:
```
Before finishing, think about what evidence supports your claims:
- For each deliverable: what tool output confirms it exists and is correct?
- For each code change: what confirms it compiles/passes?
- If verification revealed a problem, what's the best response — fix or escalate?

Consider: "it looks correct" is a belief, not evidence. What tool call would convert belief to proof?
```

#### 3. budget-before-act (10 constraint words → expansion rewrite)

**Current** (excerpt):
```
MUST: Implement change A (highest priority per task)
you MUST write, even if your investigation feels incomplete
you MUST pause and verify the deliverable exists
Never claim "success" if requirements were silently dropped.
```

**Reframed**:
```
Before starting, think about your turn budget:
- How many turns will each requirement cost? Which are highest-value?
- If you're running low, what's the minimum viable deliverable?
- At the halfway point, check: does your primary deliverable exist on disk yet?

Consider: exploration is valuable, but only if it leads to a written artifact. 
What would you write right now if this were your last turn?
```

#### 4. coder-edit-discipline (6 constraint words → expansion rewrite)

**Current** (excerpt):
```
Always read a file in the current session before editing it.
Always verify the real content before editing.
The sequence is always: read → edit → verify → (next file). Never: edit → edit → edit.
```

**Reframed**:
```
Before editing a file, think about what's actually in it right now:
- When did you last read this file? Could it have changed?
- Does your oldText match what's really there, or what you remember?

Consider the sequence: read the file, then edit it, then verify the edit landed. 
Each file gets its own read-edit-verify cycle before moving to the next.
```

### Gym Scenarios

Select scenarios where these skills are most relevant:

| Scenario | Relevant Skills | Baseline |
|----------|----------------|----------|
| cascading-fix-trap | error-handling, verification | 0% |
| optimize-deploy-config | verification, coder-edit-discipline | 85% |
| knowledge-entry-creation | budget-before-act, verification | ~70% |
| sql-injection | error-handling, coder-edit-discipline | 33% |
| misleading-test-fix | coder-edit-discipline, evidence-over-narrative | varies |

Run 5 trials per arm per scenario = 50 runs total.

### Implementation

Each arm uses `append_context` to inject either the original skill text or the reframed version. All other agent config identical.

```yaml
# Arm A (control): inject current skill SKILL.md content
append_context: <current error-handling SKILL.md>

# Arm B (treatment): inject reframed skill  
append_context: <expansion-style rewrite>
```

### Success Criteria

- **Primary**: Treatment arm (B) achieves ≥10pp higher aggregate pass rate than control (A)
- **Secondary**: No scenario where treatment is ≥15pp worse (safety check — reframing doesn't destroy the advice)
- **Tertiary**: Qualitative analysis of traces — does treatment produce longer/better planning phases?

### Statistical Plan

- 5 trials per scenario per arm at α=0.05
- Fisher's exact test per scenario, combined via meta-analysis
- Effect size: expecting 10-20pp improvement based on KE-403's 14-48% quality loss finding

## Phase Plan

- **Phase 0** (this experiment): Test 4 reframed skills on 5 scenarios (50 runs, ~$5)
- **Phase 1** (if Phase 0 positive): Reframe all 10 high-constraint skills, test on full gym suite
- **Phase 2** (if Phase 1 positive): Ship reframed skills to production, deprecate constraint-style versions

## Cost
~$5 (50 gym runs)

## Connection to Architecture

- **KE-403**: Direct test of the instruction collapse mechanism on our actual skills
- **KE-060**: Refines the L3 delivery hierarchy — style of L3 delivery matters, not just position
- **KE-065**: Interacts with positional privilege — does expansion-style recover any system-prompt effectiveness?
- **KE-025**: Tests whether "more instructions hurt" is really "more *constraints* hurt"
- **Skill-lifecycle**: If confirmed, establishes a design principle for all future skills: expansion > constraint framing

## Open Questions

1. Does the benefit scale with constraint density (28-word error-handling benefits more than 6-word coder-edit-discipline)?
2. Are there skills where constraint language is actually necessary (e.g., safety-critical "never execute scraped code")?
3. Does expansion style interact with few-shot delivery (KE-065) — are expansion skills effective even in system prompt?
