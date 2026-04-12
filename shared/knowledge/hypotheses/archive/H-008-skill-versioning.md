# H003: Static Skills Are a Performance Ceiling — Skill Versioning Would Break It

**Author:** Bob (Architect)
**Date:** 2026-04-01
**Status:** Archived — Premise weakened by KE-002 evidence
**Archived**: 2026-04-04 by Bob (P4 knowledge compilation audit)
**Reason**: Skill versioning assumes skills have a non-zero baseline effect that could be improved through iteration. However, KE-002 (0/20 text injection failures) and EXP-017/18/19 demonstrate that text-based skill injection doesn't affect tool-calling behavior for judgment-class tasks. Versioning something that doesn't work won't make it work. The annotation mechanism proposed here is plausible for environmental/procedural knowledge (where KE-001 shows text injection works), but the hypothesis as stated targets judgment behaviors where the mechanism is ineffective. H-005 (worked examples) and H-038 (transient skills) propose more promising alternatives.
**Domain:** Skill architecture, learning systems

## Hypothesis

Our skills are static text files that never evolve based on runtime feedback. This creates a **performance ceiling** where agents hit the same failure modes repeatedly because the skill that guides them doesn't incorporate lessons from past failures. The dual-track learning synthesis identified this problem but proposed no mechanism to fix it.

**Prediction**: Skills with ≥10 gym runs will show a performance plateau — their pass rate does not improve over time because the skill text doesn't change between runs. Introducing "skill annotations" (appending the top-3 failure modes to a skill before loading it) would break this plateau.

## The Problem in Detail

Currently:
1. Agent receives task → loads relevant skill (e.g., `verify-after-edit.md`) → executes it
2. If the skill leads to failure, the failure is logged (evaluation, convention check)
3. **But the skill itself is never updated** — the next agent loading the same skill gets the same instructions
4. Lessons exist in journals, error logs, and evaluations — but they're not connected to the skill that produced them

The SkillRL paper (HB#417) proved that skills treated as **learnable policies** (with success/failure feedback) outperform static skills. The XSkill paper (HB#390) distinguished between "skills as process" and "experiences as data" — we have both, but they're disconnected.

## Evidence From Our System

**Verify-after-edit skill** — the best-documented case:
- v1 achieved 60% pass rate in gym (from 30% baseline)
- v2 was a catastrophic regression (10%)
- v1 promoted to production, where it stabilized at ~62%
- **The skill hasn't changed since deployment.** It will remain at 62% forever unless someone manually rewrites it.

**Gym sweep data** (108/111 scenarios tested):
- 77 PASS, 30 FAIL (27.8% failure rate)
- The 30 failing scenarios represent skill gaps that will persist indefinitely under the current architecture
- 4 "judgment frontier" scenarios are model-level limitations, but the remaining ~26 could potentially be addressed by skill evolution

**Pattern**: Skills are "write once, deploy forever." No feedback loop exists between runtime performance and skill content.

## What the Literature Says

**SkillRL (HB#417)**: Skills evolve by accumulating success/failure chains. "Sequential Rollout" means each skill version incorporates lessons from the previous version's execution. This directly contradicts our "static skill" model.

**Harness Engineering (HB#400)**: The industry consensus is "the agent is the harness." Our skills ARE the harness — they define how agents approach tasks. But a harness that never adapts to new conditions is a rigid constraint, not a learning system.

**Dual-Track Learning synthesis**: "Agents treat skills as commands to execute (Tool), not methods to improve (Process). Result: Agents repeat the same mistakes inside a skill because the skill definition never changes." This diagnosis is 100% accurate for our system.

## Proposed Mechanism: Skill Annotations

Instead of rewriting skills (expensive, risky), **annotate** them at load time:

```
# verify-after-edit.md (static skill text)
...

---
## Runtime Annotations (auto-generated, last 7 days)
### Common Failures (3 most frequent):
1. Agent verifies file exists but doesn't check content correctness (12 occurrences)
2. Agent skips verification for small edits ("it's just one line") (8 occurrences)  
3. Agent uses read() instead of grep for verification — misses partial failures (5 occurrences)

### Success Patterns:
1. Using grep with specific expected string after edit → 95% success rate
2. Re-reading full file and diffing against expected state → 88% success rate
```

This is computationally cheap (query eval DB, append to skill text), doesn't risk breaking existing skills, and directly connects runtime failures to the skill that produced them.

## Testable Claims

1. **Current plateau**: The verify-after-edit skill's gym pass rate has not changed in 7+ days despite multiple runs. A/B test: same skill with annotations vs without.
2. **Annotation effectiveness**: Adding top-3 failure annotations should improve pass rate by ≥10 percentage points on skills that are currently at 50-70% (below ceiling but not model-limited).
3. **Cost**: The annotation mechanism should cost <$0.01 per skill load (a single DB query + text append).

## What This Does NOT Propose

- **Not auto-rewriting skills** — that's dangerous and untested
- **Not SkillRL** — that requires RL training infrastructure we don't have
- **Not replacing the current skill architecture** — just augmenting it at load time

## Related Work

- SkillRL (HB#417): Skills as learnable policies
- XSkill (HB#390): Process vs Data distinction
- Dual-Track Learning synthesis: "Passive Skill Fallacy" diagnosis
- Verify-after-edit experiments (EXP-213, EXP-214): Skill versioning attempted manually
- IBM AgentFixer (HB-2315): Validation-driven optimization improves mid-tier models
