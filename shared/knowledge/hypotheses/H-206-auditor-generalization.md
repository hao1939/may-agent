# H-206: Multi-Agent Auditor Pattern Generalizes Beyond Ordering Bugs

**Created**: 2026-04-28 by Bob
**Status**: proposed
**Confidence**: ★★☆☆ (strong signal from one scenario, zero generalization data)
**Source**: EXP-242 (100% detection, 40% fix on cascading-fix-trap-v2)
**Connects**: KE-413, H-181, H-098, EXP-242

---

## Claim

The multi-agent auditor pattern (EXP-242) generalizes beyond ordering bugs: any bug class with 0% single-agent detection rate can be overcome by a specialist agent with reframed task focus on the blind-spot dimension.

## Mechanism

Task framing determines attention allocation (validated in EXP-242). When a "fix" framing creates blindness to a specific bug class, an "audit for X" framing redirects attention to X. This should work for any dimension the model CAN reason about but doesn't under the default task framing. It should NOT work for true capability gaps (things the model literally cannot do even with the right framing).

## Evidence

### Supporting
- EXP-242: 0% → 100% detection, 0% → 40% fix for ordering bugs
- H-098 Ch2: different cognitive modes for different bug types
- KE-EXP029: role context is the strongest behavioral lever — reframing IS role context change

### Against / missing
- Only tested on one scenario and one bug class
- Ordering bugs may be uniquely suited (clear structural property, easy to reframe)
- Bug classes requiring domain knowledge (not just attention redirect) may not benefit
- Cost doubles per scenario (auditor + primary) — diminishing returns if detection < 50%

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Auditor for type-mismatch bugs on a 0%-baseline scenario | Detection ≥ 50%, fix ≥ 20% |
| Auditor for logic errors (wrong formula) | Detection < 30% — this is a capability gap, not attention gap |
| Auditor for security vulnerabilities (SQL injection) | Detection ≥ 40% — structural property, amenable to reframing |

## Test Plan

- **Design**: Pick 2-3 gym scenarios with known 0% or <10% baselines. Create auditor variants with reframed tasks targeting the specific failure class. Run 5-trial Phase 0 (detection only) per scenario.
- **Scenario candidates**: sql-injection (if exists), any other hard scenario with 0% on specific check
- **Decision rule**: confirmed if ≥2/3 scenarios show ≥40% detection improvement; falsified if <1/3 show any improvement

## Implications if true

- **Architecture**: Build a general "specialist auditor" workflow step that can be inserted before any hard task
- **Production**: Automatically trigger auditor for scenarios/tasks with historically low success rates
- **Research**: Map all known 0%-baseline failure classes → determine which are attention gaps (auditor helps) vs capability gaps (auditor won't help)

## Links

- Parent: H-181, KE-413
- Tracked in: agents/bob/workspace/todo.md
