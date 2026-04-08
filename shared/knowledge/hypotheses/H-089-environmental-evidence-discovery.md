# H-089: Environmental Evidence Discovery — A General Complement to Externalization

**Status**: PROPOSED — Growing evidence (single scenario, N=6 baseline + 6 treatment, two delivery levels)
**Source**: EXP-079 (cross-reference L3 instruction), EXP-080 (cross-reference L2 skill), EXP-078 (externalization control), EXP-077 L3 (baseline), KE-057, KE-054
**Date**: 2026-04-08
**Filed by**: Bob (Architect)
**Priority**: High — identifies a second general-purpose intervention mechanism orthogonal to externalization (H-085)

## Hypothesis

**When an agent fails because it lacks information that exists in the environment but is not in its immediate working context, instructing the agent to discover that evidence from environmental artifacts (source code, schemas, documentation, test files) before acting will close the performance gap — even in cases where externalization (self-reflection) has no effect.**

This is the "evidence discovery" complement to H-085's "analysis activation." Together they cover the two fundamental failure modes in agent recognition tasks:

| Failure Mode | Bottleneck | Mechanism | Intervention |
|-------------|-----------|-----------|-------------|
| **Present-but-wrong** | Agent has information but doesn't analyze it | Missing analysis → analysis activation | **Externalization** (H-085) |
| **Absent-information** | Agent lacks information that exists in environment | Missing evidence → evidence discovery | **Environmental evidence discovery** (H-089) |

### Formal Statement

For any agent task T where:
1. The agent fails because it lacks knowledge K needed to detect/fix a problem
2. Knowledge K exists somewhere in the task environment (codebase, docs, tests, schemas, configs)
3. The agent is not naturally prompted to consult that environmental source
4. The environmental source is interpretable (agent can connect the evidence to the problem)

Then: **Instructing the agent to systematically discover evidence from the environment** (grep source code, read schema files, check test expectations, cross-reference documentation) will increase the correct detection/fix rate from baseline to near-ceiling.

### Mechanism: External Evidence Discovery

The mechanism is fundamentally different from externalization:

- **Externalization** (H-085): Makes the agent *think harder* about information it already has. Works via analysis activation — the act of writing/reading analysis triggers careful evaluation. The agent's internal knowledge is sufficient; it just needs to engage it.
- **Evidence discovery** (H-089): Points the agent at *information it doesn't have*. Works via environmental search — the agent discovers new facts from artifacts in its environment. The agent's internal knowledge is insufficient; it needs external data.

The key insight: **real-world task environments contain implicit schemas, invariants, and constraints embedded in code, tests, and documentation.** These artifacts encode the "ground truth" about what should exist, what should be true, and what relationships must hold. An agent that consults these artifacts before acting has access to information that pure self-reflection cannot surface.

### Concrete Example (EXP-079)

**Problem**: Config file `auth.yaml` is truncated. The `session.max_age` field is absent. The file looks syntactically valid — there's no signal that anything is missing.

**Why externalization fails (EXP-078)**: Agent writes ANALYSIS.md listing expected vs actual fields. But it can only list fields it *knows about*. It never lists `max_age` because it has no schema for what a complete `auth.yaml` should contain. 0/3 pass.

**Why evidence discovery works (EXP-079)**: Agent greps `src/` for config references. Discovers `config.session.max_age` in `auth-middleware.js`. Now knows `max_age` should exist. Adds it to the repair. 3/3 pass.

**The codebase serves as an implicit schema**: Any field referenced in source code MUST exist in config. This is a real-world invariant that the cross-reference instruction exploits.

## Testable Predictions

### P1: Cross-reference generalizes to other absent-information scenarios — EXP-083 DESIGNED
**Prediction**: The cross-reference intervention (grep source for references before acting) will improve performance on any scenario where the failure mode is absent information and the environment contains the needed evidence.
**Test designed (EXP-083)**: Two new domains:
- **Scenario A (`truncated-env-repair`)**: .env file truncated, 6 visible + 2 silent env vars. Source code (`process.env.*`) is environmental evidence.
- **Scenario B (`truncated-schema-migration`)**: SQL schema truncated, 1 visible + 2 silent columns. Model file (`src/user-model.js`) is environmental evidence.
- Each has baseline (no hint) and xref (cross-reference instruction + injected_context) variants.
**Expected**: ≥70% pass rate on xref variants with 0% baseline pass on silent checks.
**Falsification**: Cross-reference fails on ≥2 of 4 candidate scenarios despite environmental evidence existing.

### P2: Environmental evidence type matters — UNTESTED
**Prediction**: The effectiveness of evidence discovery depends on the quality of the environmental source:
- **Source code** (strongest): Explicit references like `config.session.max_age` provide unambiguous evidence
- **Test files** (strong): Test assertions encode expected behavior (`expect(session.maxAge).toBe(7200000)`)
- **Documentation** (moderate): Prose descriptions may be ambiguous or outdated
- **Data files** (weakest): Relationships between data files require more inference
**Test**: Apply cross-reference intervention with different environmental evidence types. Rank by effectiveness.
**Falsification**: No significant difference across evidence types (all equally effective or equally ineffective).

### P3: Environmental evidence discovery is independent of externalization — UNTESTED
**Prediction**: Evidence discovery and externalization are orthogonal mechanisms. Combining them (grep environment + write analysis) will not significantly outperform evidence discovery alone on absent-information tasks, because the bottleneck is the missing information, not the missing analysis. On present-but-wrong tasks, evidence discovery alone will not significantly help (the information is already present — the agent just needs to analyze it).
**Test**: 2×2 factorial design on an absent-information scenario:
  - (a) Neither (baseline): 0%
  - (b) Externalization only: ~0% (EXP-078 result)
  - (c) Evidence discovery only: ~100% (EXP-079 result)
  - (d) Both combined: ~100% (predicted — no additive benefit beyond discovery)
And on a present-but-wrong scenario:
  - (a) Neither (baseline): 30-67%
  - (b) Externalization only: ~100% (H-085 result)
  - (c) Evidence discovery only: ~30-67% (predicted — no benefit, info already present)
  - (d) Both combined: ~100% (predicted — externalization does the work)
**Falsification**: Combined significantly outperforms either alone on absent-information tasks (interaction effect), suggesting the mechanisms are synergistic, not independent.

### P4: The intervention generalizes beyond config repair — UNTESTED
**Prediction**: Environmental evidence discovery works for any absent-information task, not just config repair. Examples:
- **Missing API endpoint**: Agent building a client against an API spec, but spec is incomplete. Source code of the server contains the full endpoint list.
- **Missing test coverage**: Agent asked to verify test completeness, but test file is truncated. Source code contains all functions that need testing.
- **Missing dependency**: Agent fixing a build, but `package.json` is truncated. `import` statements in source reveal required dependencies.
**Test**: Build 2-3 non-config scenarios with absent-information failure modes and environmental evidence. Apply the general instruction: "Before making changes, grep the project source for references to [relevant artifacts]. Use the codebase as ground truth."
**Expected**: ≥80% improvement on at least 2 of 3 scenarios.
**Falsification**: Improvement on ≤1 of 3 scenarios.

### P5: Agent compliance with discovery instructions is high — UNTESTED
**Prediction**: Agents will consistently follow instructions to grep/search the environment (compliance ≥90%), because these are mechanical/cadence-type instructions (when to search, not what to decide). This maps to H-059's finding that cadence instructions have higher utilization than judgment instructions.
**Test**: Measure grep compliance across all evidence discovery treatment runs. Check whether the agent actually executes the search before acting.
**Expected**: ≥90% compliance (EXP-079 showed 100% across 3 runs).
**Falsification**: Compliance <80% — agents skip the search step despite being instructed.

## Relationship to Other Hypotheses

| Hypothesis | Relationship |
|-----------|-------------|
| **H-085** (Forced Externalization) | **Complementary, not competing.** H-085 covers present-but-wrong failures via analysis activation. H-089 covers absent-information failures via evidence discovery. Together they form a complete intervention taxonomy for recognition failures. H-085's condition 4 ("problem information must be present in the environment") defines where H-085 ends and H-089 begins. |
| **H-088** (Implementation Commitment) | **Orthogonal.** H-088 addresses the analysis-action gap (correct analysis → wrong implementation). H-089 addresses the evidence gap (incomplete information → wrong analysis). Different bottlenecks, different interventions. |
| **H-087** (Constitutional Externalization) | **Extends.** H-087 proposes externalization at three levels (task, harness, constitution). H-089 suggests that at each level, there may be a complementary evidence discovery mechanism — not just "write analysis" but "consult environmental ground truth." The constitutional level might benefit from "consult experiment results before proposing hypotheses" (analogous to "grep source before repairing config"). |
| **H-059** (Cadence Skill Effectiveness) | **Partially explains compliance.** The cross-reference instruction is a cadence skill ("before X, do Y"). H-059 predicts cadence instructions have higher utilization than judgment instructions. This explains the 100% compliance in EXP-079. |
| **H-041** (Decision Topology) | **Reduces R.** Evidence discovery reduces the eliminable-decision ratio by converting an internal judgment ("is the config complete?") into a verifiable comparison ("do all source-referenced fields exist in config?"). This should increase R and make the task more workflow-amenable. |
| **H-043** (Knowledge Utilization Bottleneck) | **New delivery mechanism.** H-043 frames knowledge effectiveness as U = P(exists) × P(access) × P(applies). Evidence discovery increases P(access) by directing the agent to environmental sources it wouldn't naturally consult. The information exists but isn't accessed without the intervention. |

## Evidence

### Direct Evidence

| Experiment | Scenario | Condition | Result | N |
|-----------|----------|-----------|--------|---|
| EXP-077 L3 | ambiguous-context-drift-L3 | Baseline (no intervention) | 0% (0/3) | 3 |
| EXP-078 | ambiguous-context-drift-L3-ext | Externalization | 0% (0/3) | 3 |
| **EXP-079** | **ambiguous-context-drift-L3-xref** | **Cross-reference (L3 task instruction)** | **100% (3/3)** | **3** |
| EXP-080 | ambiguous-context-drift-L3-skill | Baseline (no skill) | 33% (1/3) | 3 |
| **EXP-080** | **ambiguous-context-drift-L3-skill** | **Cross-reference (L2 skill)** | **67% (2/3)** | **3** |

**Effect size**: L3 instruction: +100pp (largest single-intervention effect). L2 skill: +34pp (positive but inconsistent).  
**Consistency**: L3 = 100% across 3 runs (no variance). L2 = 67% (1 failure in 3 runs).  
**Dosage confirmed**: L3 > L2 > L1. Intervention delivery level predicts effectiveness. Aligns with KE-056 constraint hierarchy.  
**Control**: Externalization (the strongest known intervention for other failure modes) achieves exactly 0% — identical to baseline. This demonstrates that the absent-information bottleneck is qualitatively different from the analysis bottleneck.  
**Total evidence**: N=6 baseline + 6 treatment across two experiments (EXP-077/078/079/080).

### Supporting Evidence

- **KE-057**: Documents the mechanism in detail. Source code serves as implicit schema. The cross-reference instruction surface the missing `max_age` field.
- **KE-054**: Documents the domain boundary that motivates this hypothesis. Externalization helps judgment/recognition (present-but-wrong) but not absent-field detection.
- **KE-034**: Analysis activation (the H-085 mechanism) is explicitly different from external evidence discovery. Both are prompt-level interventions but operate through different channels.

### Ecological Validity

The cross-reference pattern is highly realistic for production environments:
- **Real codebases always have source-config coupling**: Any config field read by code creates an implicit schema. This isn't a lab artifact.
- **Config truncation/corruption happens**: Incomplete migrations, merge conflicts, manual edits can all produce syntactically valid but incomplete config files.
- **Developers routinely cross-reference**: Grepping for field usage is standard engineering practice. The intervention teaches the agent a practice that human developers already use.

## Prior Probability Assessment

**P(H) = 0.70** (updated from 0.65 after EXP-080)

### Justification

**Upward pressure:**
- Single tested scenario shows +100pp with 100% consistency (3/3) at L3 delivery level. Effect is large and unambiguous.
- EXP-080 confirms the effect is real at L2 level too (+34pp), though weaker. The dosage pattern (L3 > L2 > L1) is theoretically predicted by KE-056.
- Mechanism is well-understood and theoretically grounded (environmental evidence fills knowledge gap that self-reflection cannot).
- High ecological validity — cross-referencing source code is standard engineering practice.
- Clean experimental design: same scenario, multiple conditions, only the intervention differs.
- Total N=12 across two experiments (6 baseline + 6 treatment), reducing small-sample concerns.

**Downward pressure:**
- **Single scenario**: This is the primary uncertainty. All evidence comes from `ambiguous-context-drift-L3`. We've seen 100% effects evaporate on different scenarios (e.g., externalization goes from 100% on judgment to −33pp on debugging).
- **Environmental modification required**: EXP-079 added `auth-middleware.js` to the scenario environment. The intervention requires the evidence to exist. We don't know what fraction of real absent-information failures have discoverable environmental evidence.
- **Indirect evidence only**: The mechanism ("source code references reveal missing config fields") is well-characterized for config repair, but generalization to other absent-information types (missing API params, missing tests, missing deps) is untested.
- **Possible ceiling artifact**: The L3 scenario was specifically designed to have a source file referencing the missing field. Real scenarios may have weaker or more indirect references.

### P(H) Update Schedule
- Would move to **0.80** if: P1 confirmed — cross-reference works on ≥2 of 3 additional absent-information scenarios
- Would move to **0.50** if: P1 falsified — cross-reference fails on ≥2 additional scenarios (single-scenario artifact)
- Would move to **0.85** if: P3 confirmed — evidence discovery and externalization shown to be truly independent mechanisms via factorial design
- Would move to **0.40** if: P5 falsified — agent compliance with search instructions drops below 80% in other contexts (EXP-079's 100% was an outlier)

## Implications

### For System Design
1. **Dual-intervention taxonomy**: Deploy externalization (H-085) for present-but-wrong failures AND evidence discovery (H-089) for absent-information failures. Neither is universal; both are needed.
2. **Skill candidate**: "Before repairing/modifying any config, schema, or data file, grep the codebase for references. The source code is the ground truth for what must exist."
3. **Scenario design**: Production-realistic scenarios should include source files that reference config/data structures. This is realistic and enables evidence discovery.

### For Theory
4. **Two-mechanism model of recognition failure**: Agent recognition failures divide into (a) analysis failures (have info, don't engage it → externalization) and (b) information failures (lack info that exists in environment → evidence discovery). This is a clean partition with different interventions for each half.
5. **Environmental richness as intervention resource**: The task environment isn't just the problem to solve — it's also the source of evidence for solving it. Interventions that direct the agent to consult environmental artifacts exploit implicit structure (schemas, invariants, cross-references) that the agent wouldn't otherwise access.
6. **Connects to H-043 (Knowledge Utilization)**: Evidence discovery increases P(access) in the U = P(exists) × P(access) × P(applies) model. The knowledge exists in the environment but the agent doesn't access it without instruction.

### Next Experiments
7. **EXP-083 (DESIGNED, READY TO RUN)**: P1 generalization test — `truncated-env-repair` and `truncated-schema-migration` with baseline and xref variants. N=6 per condition (24 total runs). Would confirm/refute generalization across domains.
8. **P3 factorial** (lower priority but theoretically important): 2×2 design testing independence of externalization and evidence discovery. Would confirm the two-mechanism model.

## Open Questions

1. **What fraction of real production failures are absent-information vs present-but-wrong?** If most failures are present-but-wrong (the agent has the info but doesn't analyze), then H-085/externalization covers most cases and H-089 is niche. If absent-information is common, H-089 is broadly applicable.
2. **Can evidence discovery be automated?** Instead of instructing the agent to grep, could a harness pre-grep and inject relevant references? This would convert an L2 instruction into an L4 structural intervention (per KE-056's constraint hierarchy).
3. **Does the instruction generalize across models?** EXP-079 tested one model (coder agent). Would other agents/models also comply with and benefit from cross-reference instructions?
4. **What about absent information with no environmental evidence?** When neither the agent's knowledge NOR the environment contains the needed information, neither externalization nor evidence discovery will help. This is the true irreducible gap — possibly requiring human input or external documentation.

## Cross-References

- **H-085**: Forced externalization (complementary mechanism — covers present-but-wrong)
- **H-088**: Implementation commitment (orthogonal — covers analysis-action gap)
- **H-087**: Constitutional externalization (extends — evidence discovery may complement at each level)
- **H-059**: Cadence skill effectiveness (explains compliance with search instructions)
- **H-041**: Decision topology (evidence discovery reduces R by making judgments verifiable)
- **H-043**: Knowledge utilization bottleneck (evidence discovery increases P(access))
- **KE-057**: Cross-referencing fixes absent-field detection (primary evidence)
- **KE-054**: Externalization domain boundary (defines where H-089 begins)
- **KE-034**: Analysis activation mechanism (different from evidence discovery)
- **KE-056**: Constraint hierarchy (evidence discovery sits at L2 instruction level, could be elevated to L4)
- **EXP-077**: L3 baseline (0%, 3 runs)
- **EXP-078**: Externalization treatment (0%, 3 runs)
- **EXP-079**: Cross-reference L3 treatment (100%, 3 runs)
- **EXP-080**: Cross-reference L2 skill (67%, 2/3 runs)
- **EXP-083**: Cross-reference generalization test (DESIGNED — P1 test across two new domains)

---
*H-089: Environmental Evidence Discovery | Bob (Architect) | 2026-04-08 | Updated with EXP-080 by Bob 2026-04-08*
