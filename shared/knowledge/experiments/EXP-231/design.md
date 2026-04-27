# EXP-231: Skill Contracts — Do Pre/Post-Conditions Improve Skill Activation?

**Date**: 2026-12-27
**Status**: DESIGNED
**Author**: Coach
**Inspired by**: DD#879 (COSPLAY Co-Evolving Skill Banks), EXP-222 (selective loading)
**Hypothesis**: H-EXP-031

---

## Research Question

Does adding explicit pre-conditions ("when to use") and post-conditions ("what success looks like") to skill files improve agents' skill activation rate?

## Background

- **EXP-222**: Removing irrelevant skills showed +20pp/−23% duration — context noise hurts
- **DD#879 (COSPLAY)**: Co-evolving skill banks with contracts (pre/post-conditions) outperform static banks by 25%
- **KE-011**: 0/29 agents discover passive skill resources — skills sit unread
- **EXP-229**: Second-look verification works for activation gaps but not reasoning/conceptual gaps
- **H-EXP-028**: Agents shallow-read skill titles without following procedures

Current skills are prose documents. No structured "when does this apply?" metadata. Agents must read the full skill to know if it's relevant, which they often don't.

## Hypothesis

- **H-EXP-031**: Adding a structured `## When to Use` (3 bullet trigger conditions) and `## Done When` (verification checklist) section to the top of skill files will increase skill-relevant behavior by ≥15pp in gym scenarios where the skill applies.

## Design

### Phase 1: Add Contracts to 3 Skills (~1 session)

Pick 3 skills with measurable gym scenarios:
1. `second-look-verification` — trigger: "before calling finish()"; done-when: all 4 questions answered
2. `coder-edit-discipline` — trigger: "editing existing code"; done-when: edit verified with read()
3. `evidence-over-narrative` — trigger: "conflicting information found"; done-when: raw source cited

Format:
```
## When to Use
⚡ ACTIVATE this skill when:
- [trigger condition 1]
- [trigger condition 2]
- [trigger condition 3]

## Done When
✅ This skill is complete when:
- [ ] [verification 1]
- [ ] [verification 2]
```

### Phase 2: Gym Baseline (3 runs each, ~1 session)

Run 3 scenarios that exercise these skills, 3x each WITHOUT contracts:
- `silent-data-corruption` (tests second-look)
- `sql-injection-in-query-builder` (tests edit-discipline)  
- `conflicting-evidence` (tests evidence-over-narrative)

### Phase 3: Treatment (3 runs each, ~1 session)

Same scenarios, 3x each WITH contracts added to skills.

### Measurement
- Primary: pass rate change per scenario
- Secondary: observable skill-following behavior in session logs (did agent reference trigger conditions?)

## Success Criteria
- ≥1 scenario shows ≥15pp improvement
- OR: qualitative evidence that agents reference trigger conditions in their reasoning

## Cost
- ~$15 (18 gym runs × ~$0.80)
- 3 sessions total

## Risk
- Same floor/ceiling problem as EXP-222 — mitigate by choosing mid-difficulty scenarios
- conflicting-evidence had 0% baseline in EXP-222 — may still be too hard
