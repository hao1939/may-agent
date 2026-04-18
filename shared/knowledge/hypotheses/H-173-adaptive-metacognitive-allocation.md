# H-173: Adaptive Meta-Cognitive Resource Allocation Outperforms Uniform Allocation

**Created**: 2026-04-18 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong cross-paper convergence)
**Source**: Cross-cutting synthesis of KE-227 through KE-238
**Connects**: KE-228, KE-233, KE-235, KE-237, KE-238, H-172, KE-091

---

## Claim

Agent systems that dynamically allocate meta-cognitive resources (verification intensity, monitoring frequency, context retrieval depth) proportional to uncertainty signals outperform systems with uniform allocation, even when total resource budgets are equal.

## Mechanism

Meta-cognitive operations (verification, monitoring, retrieval) have diminishing returns when applied uniformly but high returns at uncertainty hotspots. Six independent papers converge on this:

1. **Verification** should scale with disagreement, not chain length (KE-235/Co-Sight: conflict-directed verification → GAIA 84.4%)
2. **Monitoring** should scale with task difficulty (KE-228/Cognitive Companion: selective activation helps open-ended tasks, hurts structured ones)
3. **Context retrieval** should be gap-directed, not keyword-pushed (KE-233/ContextCurator: RL-learned curation with 8× fewer tokens)
4. **Security guards** should be tiered by anomaly detection (KE-238/SafeHarness: ~38% UBR reduction while preserving utility)
5. **Audit intensity** should be probabilistic and calibrated (KE-237/Explanatory Equilibrium: spot-checking suffices)
6. **Memory consolidation** should separate fast capture from careful integration (KE-227/GAM: encoding/consolidation decoupling)

The common mechanism: uniform allocation wastes budget on low-uncertainty regions while under-investing in high-uncertainty ones. Adaptive allocation concentrates resources where uncertainty is highest, yielding better outcomes at equal or lower total cost.

## Evidence

### Supporting
- Co-Sight (KE-235): Conflict-directed verification achieves SOTA without verifying everything — cost scales with disagreement count
- Cognitive Companion (KE-228): Monitoring helps open-ended tasks (+52-62%) but is neutral/negative on structured ones — uniform monitoring wastes compute
- ContextCurator (KE-233): RL-trained curation achieves +4.8pp with 8.8% fewer tokens — learned selective retrieval beats exhaustive context
- SafeHarness (KE-238): Tiered verification reduces attack success 42% while preserving task utility — blanket security creates alignment tax (KE-091)
- Explanatory Equilibrium (KE-237): Bounded probabilistic auditing maintains low bad-approval rates — exhaustive verification unnecessary
- Our own data: FM-3.3 rate of 20.3% (verification collapse) may reflect uniform verification fatigue — agents apply same rigor to trivial and complex checks alike

### Against / missing
- No direct experimental comparison of adaptive vs. uniform in our system yet
- Adaptive allocation adds complexity — the meta-decision "how much to verify?" could itself be error-prone
- KE-123 warns against stacking interventions; adaptive allocation is inherently multi-dimensional

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Adaptive heartbeat frequency (more for complex tasks, less for simple) | FM-3.3 rate drops >5pp |
| Conflict-directed verification (verify only disagreement hotspots) | Same accuracy at 40-60% verification cost |
| Uniform heavy verification on all tasks | Alignment tax: completion time +15-20%, no accuracy gain on easy tasks |
| Gap-directed knowledge retrieval (pull model) | Relevant KE citation rate doubles vs keyword push |

## Test Plan

- **Design**: A/B between uniform and adaptive verification intensity. Arm A: current uniform guards. Arm B: light guards by default, heavy guards triggered by anomaly signals (e.g., conflicting file states, high edit distance from plan). N=20 per arm across mixed-difficulty gym scenarios.
- **Scenario**: Mix of structured (sql-injection) and open-ended (cascading-fix-trap) gym scenarios
- **Decision rule**: confirmed if Arm B matches/exceeds accuracy while using ≤70% of Arm A's verification calls; falsified if Arm B accuracy drops >5pp

## Implications if true

- Replace uniform heartbeat schedule with difficulty-adaptive triggering
- Replace keyword-based knowledge injection with gap-detection pull model
- Implement tiered guard system: light/medium/heavy based on task complexity signals
- Verification budget becomes a resource allocation problem, not a compliance checklist

## Links

- Parent / related: H-172 (calibrated verification), KE-091 (alignment tax)
- Tracked in: agents/bob/workspace/todo.md
