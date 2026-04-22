# H-181: Relational Bug Blindness — LLM Agents Systematically Fail on Ordering/Relational Bugs

**Created**: 2026-04-19 by Bob
**Status**: CONFIRMED (core claim validated across 3 experiments)
**Confidence**: ★★★★ (replicated across EXP-177 N=40, EXP-194 classification, EXP-195 N=30)
**P(H)**: **0.85**
**Source**: EXP-177 S1 diagnostic finding (39/40 fail on exactly `pipeline-order-fixed`), S2 negative transfer
**Updated**: 2026-04-22 — incorporated EXP-194 (bug-type classification) and EXP-195 (skill intervention) results
**Connects**: H-098 (Attention Channel Theory — Ch1/Ch2 distinction), H-099 (Discovery Task Boundary), H-085 (Forced Externalization boundaries), H-166 (Recognition Threshold — refuted, but root finding feeds this)

---

## Hypothesis

LLM agents have a **systematic blind spot for relational/ordering bugs** (where the fix requires changing relationships between components) compared to **value bugs** (where the fix is changing a specific value, operator, or constant). This asymmetry arises because:

1. **Value bugs have local, greppable signatures.** A wrong operator (`>` vs `>=`), wrong constant, or wrong variable name produces a surface-level mismatch detectable by pattern matching against test failures, error messages, or specification text. These are **Ch1-detectable** in H-098's framework — the agent can find them via text-level attention to error signals.

2. **Ordering/relational bugs require understanding execution flow and inter-component dependencies.** The individual components are each correct in isolation; only their *relationship* (call order, data flow sequence, dependency graph) is wrong. There is no single line of code that is "wrong" — the bug is in the arrangement. This requires **Ch2 reasoning** (structural understanding of the system as a whole).

3. **Hints about relational bugs don't help because agents can't operationalize relational information.** Even when told "the ordering is wrong," the agent lacks the mental model of execution flow needed to determine *which* ordering change to make. The hint provides a Ch1 signal ("ordering is wrong") but the fix requires Ch2 reasoning ("understand the pipeline, identify the correct sequence, reorder the calls").

## Core Claim

**Relational complexity — not task difficulty per se — is the primary predictor of agent failure on bug-fixing tasks.** A scenario with one relational bug will be harder than a scenario with three value bugs, because the failure mode is qualitatively different (structural reasoning vs. pattern matching).

## Evidence

### Direct evidence (EXP-177)

**S1 cascading-fix-trap-v2 (N=40, clean environments):**
- 40/40 trials find and fix the threshold bug (`>` vs `>=`) — a classic value bug
- 1/40 trials find and fix the pipeline ordering bug (`penalize` must come before `normalize`) — a relational bug
- **Pass rate for value bug: 100%. Pass rate for relational bug: 2.5%.** The asymmetry is extreme.
- 39/40 failures are on exactly ONE check (`pipeline-order-fixed`), passing all other 8 checks

**Hints about the ordering bug don't help (EXP-177 S1 hint arms):**
- LEXICAL hint ("Pipeline ordering is wrong"): 1/10 (10%)
- PARAPHRASE hint ("stages run in the wrong sequence"): 0/10 (0%)
- The agent reads the hint but cannot translate "ordering is wrong" into a concrete code change
- This is NOT an information problem — the information is provided explicitly and still doesn't help

**S2 sql-injection-in-query-builder negative transfer (N=40):**
- BASE: 60% pass rate
- LEXICAL hint: 10% pass rate (−50pp)
- Hints cause **fixation** on described bugs, reducing exploration of the solution space
- The hint narrows the agent's attention to the described problem, crowding out the flexible search needed for solutions

### EXP-194: Bug-Type Classification (P-181a confirmed)

Retrospective classification of gym scenarios confirmed that relational-bug scenarios have systematically lower base rates than value-bug scenarios. P-181a validated at $0 cost.

### EXP-195: Skill Intervention Study (N=30)

- **Baseline**: 10% (1/10) — baseline shifted from 0% (EXP-177), likely model improvement
- **Generic skill checklist** (file or inline): 0/6 — no improvement from abstract relational reasoning guidance
- **Direct hint** ("applyPenalties and normalize may be in wrong order"): 40% (4/10) — +30pp over baseline
- **Key insight**: The bottleneck is **bug discovery, not bug fixing**. Agents can fix ordering bugs when told about them (40%) but can't find them independently (10%). Generic reasoning skills don't bridge this gap — only near-explicit hints work.
- Fisher's exact p=0.152 (not significant at α=0.05 but practically meaningful at 30pp)

### Connecting evidence

**H-098 (Attention Channel Theory):** The value/relational distinction maps directly onto Ch1/Ch2. Value bugs produce Ch1-detectable signals (error messages pointing to specific lines, grep-findable patterns). Relational bugs require Ch2 structural reasoning (understanding execution flow, dependency ordering). H-098 predicts Ch1 interventions (text hints) won't help Ch2 problems — exactly what EXP-177 shows.

**H-099 (Discovery Task Boundary):** The ordering bug may sit at the discovery layer — the agent needs to *discover* that ordering matters, not just *recognize* a pattern. H-099 shows discovery tasks resist all interventions, which is consistent with hints failing on ordering bugs.

**H-085 (Forced Externalization):** The analysis-action gap (EXP-071: 6/6 correct analysis, 0/6 pipeline reorder) is a prior manifestation of this same blind spot. Agents can *analyze* that ordering is wrong but can't *operationalize* the fix.

**H-166 (Recognition Threshold — REFUTED):** H-166's refutation is what revealed this finding. The 10/10 moderate-hint result was a small-N artifact; at N=40, hints don't cross any threshold. The real story isn't about thresholds — it's about a qualitative difference in bug types.

## Predictions

### P-181a: Value-bug scenarios have higher base rates than relational-bug scenarios ✅ CONFIRMED (EXP-194)
Across the gym portfolio, scenarios where the primary bug is a value error (wrong operator, wrong constant, wrong variable) will have systematically higher base rates than scenarios where the primary bug is relational (wrong ordering, wrong dependency, wrong data flow). This is testable by classifying existing scenarios and comparing base rates.

**Falsification**: If relational-bug scenarios show ≥50% base rates comparable to value-bug scenarios, the blind spot claim is wrong.

### P-181b: Structural interventions help ordering bugs more than text hints ⚠️ PARTIALLY TESTED (EXP-195)
A tool or intervention that **makes execution order visible** (e.g., a trace showing function call sequence, a visualization of the pipeline, or a structural gate requiring the agent to diagram execution flow before editing) will improve ordering-bug pass rates more than any text-based hint. Text hints provide Ch1 information about a Ch2 problem; structural interventions provide Ch2 scaffolding.

**EXP-195 update**: General text skills (0/6) failed, but near-explicit direct hints (40%) worked. This is a *dosage* effect within text, not yet a text-vs-structural comparison. The structural intervention (P-181b proper) remains untested. EXP-198 designed to test a *procedural* discovery skill as an intermediate step.

**Falsification**: If text hints at higher doses (e.g., step-by-step reordering instructions) achieve ≥80% on ordering bugs, the structural-vs-text distinction is wrong and it's just a dosage problem.

### P-181c: The discovery boundary (H-099) is specifically about relational complexity
H-099's "discovery tasks resist all interventions" will be explained by relational complexity: discovery tasks are hard precisely because they require identifying relational structure (what connects to what, what depends on what), not just detecting surface anomalies. Scenarios that are "discovery-hard" will correlate with relational bug density.

**Falsification**: If discovery-hard scenarios are equally likely to have value bugs as relational bugs, the complexity-type explanation is wrong.

### P-181d: Negative transfer from hints is specific to mismatched bug types
The S2 negative transfer (60%→10% with LEXICAL hint) occurs because the hint describes a specific mechanism, causing the agent to fixate on that mechanism rather than exploring broadly. This predicts: hints that match the actual bug type will help (or be neutral), while hints that mismatch (describing a value-fix approach for a relational problem, or vice versa) will hurt.

**Falsification**: If matched hints also cause negative transfer, the mechanism is general hint-fixation, not type-mismatch.

## Experimental Design (sketch)

**EXP-18X: Bug-Type Classification Study**
1. Classify all gym scenarios by primary bug type (value vs. relational vs. mixed)
2. Compare base rates across categories
3. If P-181a holds, design structural intervention (execution-trace tool) for relational-bug scenarios
4. Test structural intervention vs. text hint on relational-bug scenarios (P-181b)

**Cost estimate**: Classification is free (retrospective). Intervention test ~$5-8 (2 arms × 2-3 scenarios × 10 trials).

## Connections

| Hypothesis | Relationship |
|-----------|-------------|
| **H-098** | Parent theory — H-181 is a specific instance of Ch1/Ch2 channel mismatch applied to bug types |
| **H-099** | H-181 proposes relational complexity as the mechanism behind H-099's discovery boundary |
| **H-085** | H-181 explains the analysis-action gap (EXP-071) as a relational-bug operationalization failure |
| **H-166** | H-181 emerges from H-166's refutation — the real finding was bug-type asymmetry, not threshold effects |
| **H-165** | Production-provision interference may be amplified on relational bugs (cognitive displacement hits harder when the task requires structural reasoning) |

## Open Questions

1. **Is the ordering bug truly "relational" or just "hard"?** The cascading-fix-trap-v2 ordering bug might be hard for reasons other than its relational nature (e.g., the correct order is non-obvious, the tests don't give clear signals about ordering). Need to test on simpler relational bugs to distinguish.

2. **Can agents solve ordering bugs with enough scaffolding?** The 1/40 success suggests it's not impossible — just very unlikely per attempt. Is this a stochastic discovery event (per H-099's model) or a systematic blind spot that no amount of time will overcome?

3. **Does the value/relational distinction hold for non-bug-fixing tasks?** E.g., in feature development, is adding a new pipeline stage (relational — must be inserted in correct order) harder than modifying an existing stage's logic (value)?

---

*Filed by Bob (Architect) — 2026-04-19*
*Derived from EXP-177 diagnostic finding (39/40 pipeline-order-fixed failure)*
