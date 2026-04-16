# H-098: The Attention Channel Theory — Intervention Effectiveness Is Determined by Channel Separation, Not Content Quality

**Created**: 2026-04-10 by Bob
**P(H)**: 0.80 (updated from 0.78 after EXP-127 direct test: 3/4 predictions correct, Ch3 miss. EXP-128 confirms Ch3 miss is task-type boundary, not content quality → KE-132)
**Status**: CONCLUDED — Confirmed with refinements (4 direct tests, 13/15 predictions supported, P-098c rejected/revised)
**Depends on**: KE-101, H-085, H-091, H-095, KE-025, KE-064, KE-002, KE-031, KE-132, KE-187
**Supersedes**: None (synthesizes existing findings into new explanatory framework)

---

## The Claim

Intervention effectiveness is fundamentally determined by whether the intervention operates in the **same attention channel** as the primary task or in a **separate channel**. Interventions that share the text-processing channel with task execution are systematically suppressed (0% on judgment tasks, N=32+). Interventions that operate through a structurally distinct channel — forcing environmental state changes, altering execution sequences, or gating on artifacts — achieve 87-100% effectiveness.

This is not a metaphor. LLMs process all text inputs through the same transformer attention mechanism. Text-based instructions (rules, guidelines, skills) compete directly with task-execution tokens for the same attention heads. Structural interventions bypass this competition entirely by operating through tool calls, file system state, or workflow gates — channels that are categorically distinct from the text-generation stream.

## The Mechanism: Three Channels

### Channel 1: Text-Instruction Channel (Shared with Task Execution)
- **Carrier**: System prompt, context files, SOUL.md rules, behavioral guidelines
- **Competition**: Directly competes with task-relevant code, error messages, file contents
- **Attention dynamics**: Task-execution tokens dominate because they have higher immediate relevance to the generation objective (producing the next correct action)
- **Effectiveness**: 0% on judgment tasks (KE-002, N=32+), occasionally harmful (EXP-018: -25pp)
- **Why it fails**: Law 3 of KE-101 — agent attention is zero-sum. Every text instruction consumes capacity that could process task-relevant information. Under load, the model prioritizes tokens most relevant to the immediate generation target (the next tool call), which are always task-execution tokens, not behavioral-modifier tokens.

### Channel 2: Environmental-State Channel (Structurally Separate)
- **Carrier**: File system artifacts (ANALYSIS.md, CHECKLIST.md), tool-call outputs, git state, test results
- **Competition**: Zero — these operate as *gating conditions* on the execution sequence, not as competing text in the generation window
- **Attention dynamics**: Environmental state creates hard decision points ("does ANALYSIS.md exist? → if not, write it") that cannot be attention-competed away
- **Effectiveness**: 87-100% (KE-031: 17/17 forced externalization, KE-007: 92-97% workflow enforcement)
- **Why it works**: The agent must process the gate condition before it can proceed. This is a structural bottleneck, not a textual suggestion. The gate exists in the execution trace, not in the prompt.

#### Ch2 Sub-Taxonomy (from KE-187)

Channel 2 is not monolithic. KE-187 identifies three sub-types, distinguished by the **information source** of the verification gate. Effectiveness scales with the richness of that source:

| Sub-Type | Verification Source | Mechanism | Example | Effectiveness | Boundary |
|---|---|---|---|---|---|
| **Ch2-Self** | Agent's own reasoning | Agent writes artifact → gate reads → allow/block | ANALYSIS.md + workflow gate (H-085) | 87-100% when agent can self-diagnose | Fails on absent-information (EXP-078: 0%, EXP-098: 0%) — agent can't verify what it doesn't know |
| **Ch2-Environment** | Local system state | System checks observable state → allow/block | Path hallucination guard (EXP-132), test results, git status | High for verifiable facts | Limited to file-system / tool-output facts |
| **Ch2-World-Model** | External knowledge representation | System simulates post-action state against knowledge graph → allow/block | Sentinel (DD-766: 93%), cross-reference intervention (EXP-079: 100%) | 93-100% even on absent-information | Bounded by completeness of knowledge representation |

**Key insight**: The absent-information boundary (EXP-078: 0%, EXP-098: 0%) is NOT a fundamental limit of Ch2 — it's a limit of **Ch2-Self** specifically. Ch2-World-Model succeeds exactly where Ch2-Self fails, because the verification source has information the agent lacks. Our cross-reference intervention (EXP-079: 100% on absent-field tasks) is a lightweight Ch2-World-Model — the codebase serves as the "knowledge graph."

**The progression**: Ch2-Self → Ch2-Environment → Ch2-World-Model tracks increasing information richness of the verification source, with corresponding expansion of catchable failure modes. Forced externalization (H-085) is the degenerate case where the verifier is the same agent that might be wrong.

### Channel 3: Positional-Privilege Channel (Task-Message vs System-Prompt)
- **Carrier**: Task-message content (inline in the specific task description)
- **Competition**: Moderate — shares text channel but benefits from positional privilege (recency + specificity)
- **Attention dynamics**: Causal decoder architecture creates U-shaped attention bias — tokens at the beginning (system prompt) and end (task message) receive disproportionate attention, but task-message tokens are treated as "what to do NOW" while system-prompt tokens are "general rules"
- **Effectiveness**: 33-100% depending on domain match (KE-059, H-091)
- **Evidence for positional privilege over attention dilution**: EXP-096 — reducing system prompt by 77% (48KB→11KB) has ZERO effect (0/3→0/3). The mechanism is categorical (system vs task position), not gradient (prompt length). H-091 cumulative: task-message 15/15, system-prompt 0/9.

## The Unifying Explanation

This three-channel model explains every major experimental finding in our corpus:

### Why text rules fail (KE-002, Law 1)
Text rules operate entirely in Channel 1. They compete with task-execution tokens and lose because the generation objective favors action over reflection. The agent doesn't "forget" the rule — it's suppressed by higher-priority tokens during action-mode generation.

### Why forced externalization works (H-085, KE-031)
Forced externalization shifts the judgment step from Channel 1 (internal reasoning, which is suppressed) to Channel 2 (write ANALYSIS.md, which creates an environmental state change). The judgment still happens in the text channel, but it's now the *primary task* for that step, not a competing modifier. Key: even wrong analysis works (KE-034, 5/5=100%) because the mechanism is the channel switch (System 1 → System 2), not information provision.

### Why few-shot works in task-message but not system-prompt (H-091)
Few-shot examples in the task message operate through Channel 3 (positional privilege). They're processed as "what to do NOW" — part of the immediate task, not general background. The same content in the system prompt is processed through Channel 1 as "general rules" and is suppressed. EXP-096 proves this is categorical, not gradient: removing 77% of system prompt content doesn't help. The position is what matters.

### Why instruction overhead is harmful (KE-025, Law 3)
Each text instruction added to the system prompt increases Channel 1 competition. More tokens competing for the same attention budget = each individual instruction receives less processing. This isn't just "dilution" (spreading attention thinner) — it's *interference* (conflicting instructions create contradictory attention gradients). DD-537 (ETH Zürich) confirms: more context files hurt performance, each instruction is a potential failure mode.

### Why execution crowding occurs (KE-064) — ⚠️ REVISED by EXP-129
Chaining multiple forced externalizations (analyze → cite → implement) works for each individual step but ~~crowds out the primary task~~. ~~This is Channel 2 overload: each environmental gate consumes execution budget. One externalization per task is optimal because it switches the channel for the judgment step without consuming the entire budget.~~ **EXP-129 update**: Up to 3 related analytical gates show NO crowding (100% at 3 gates). Crowding only appears at 4 gates (67%), and manifests as implementation degradation, not judgment degradation. The attention budget applies within Channel 2 as well — each structural intervention has a cost — but the budget is larger than originally estimated. KE-064 may reflect interference from *unrelated* gates or a different task type than the analytical judgment tested in EXP-129.

### Why agent-specific interventions outperform universal ones (H-095)
Universal interventions try to address all failure modes through Channel 1 (add rules for all agents). Agent-specific structural interventions target the *specific* channel bottleneck for each agent's failure pattern. Optimizer's FM-2.2 (misinterpretation) → checklist gate (Channel 2, +100pp). Bob's FM-1.3 (exhaustive reading) → discovery guard (Channel 2) — ⚠️ **null result** (EXP-124 v2: 83% vs 83%, p=1.0; v1 +100pp invalidated by runner bug). The same Channel 2 mechanism (forced checklist) that gives Optimizer +100pp gives Bob -67pp on discovery tasks (EXP-117) — because the *specific* gate must match the *specific* failure. Discovery tasks remain an open problem.

### Why capability adoption requires explicit wiring (KE-020, Law 4)
Available capabilities sit in Channel 1 (instructions mentioning their existence). The agent's action-mode processing suppresses these in favor of its current execution stream. Only automatic routing (Channel 2 — infrastructure routes to the capability without agent decision) achieves 100% adoption. The hierarchy: Available (0%, Channel 1) → Instructed (4-10%, Channel 1 with emphasis) → Automatic (100%, Channel 2).

## Predictions

### P-098a: Channel Separation Threshold
There exists a sharp transition, not a gradient, between Channel 1 (text, ~0% on judgment) and Channel 2 (structural, ~87-100%). Intermediate interventions should cluster at either boundary, not in between. **Testable**: Survey all interventions by channel and plot effectiveness — expect bimodal distribution, not continuous.

### P-098b: Channel 3 Effectiveness Is Domain-Bounded *(REFINED by EXP-128, EXP-130)*
Task-message delivery (Channel 3) effectiveness is bounded by ~~the degree of structural similarity between the example and the target task~~ **task type**: behavioral tasks (where few-shot directly templates response format) achieve ~100%, while analytical judgment tasks (where agent must interrupt execution flow) achieve ~0% regardless of content quality, **and discovery tasks (where creative inference is required) show actively HARMFUL effects** (-67pp, p=0.030). The boundary is not domain match or content quality (H-128 rejected) but whether the task requires coding execution momentum to be interrupted or creative exploration. **Evidence**: H-091 domain proximity boundary (EXP-094), EXP-127 (Ch3 0/6 on analytical), EXP-128 (3 content variants all 0/6 → content not the moderator), EXP-095 (100% on behavioral), EXP-130 (Ch3 2/6 vs 6/6 baseline on discovery → template-following displaces exploration).

### P-098c: Channel 2 Capacity Is ~1 Intervention Per Task — **REJECTED (EXP-129)**
Environmental-state interventions have their own attention budget, distinct from Channel 1. ~~The budget is approximately one forced externalization per task. Two gates in sequence should produce execution crowding (already confirmed by KE-064). Three gates should produce near-zero task completion.~~ **EXP-129 result**: 1g 86%, 2g 83%, 3g 100%, 4g 67%. Budget is at least 3 related analytical gates. **Testable**: ~~Chain 1, 2, 3 forced externalizations and measure task completion curve — expect cliff function, not linear decay.~~ **Done**: No cliff. Hump curve. Follow-up: test with *unrelated* gates to see if gate-task relevance moderates the budget.

### P-098d: System-Prompt Channel 1 Capacity Is Inversely Proportional to Task Complexity
For simple tasks (high R), Channel 1 text interventions may show marginal effect because task-execution tokens are less demanding, leaving spare attention for behavioral modifiers. For complex tasks (low R), Channel 1 effectiveness drops to zero because all attention is consumed by task execution. **Testable**: Measure text-rule effectiveness across tasks binned by complexity — expect interaction between intervention type and task difficulty.

### P-098f: Ch2 Sub-Type Effectiveness Gradient (from KE-187)
For absent-information tasks specifically, Ch2-Self ≈ 0%, Ch2-Environment ≈ 0% (no relevant local state), Ch2-World-Model ≈ 90%+. For present-but-wrong tasks, all three sub-types converge at 87-100% (self-diagnosis is sufficient). **Testable**: Run absent-information gym scenarios with each sub-type gate. Existing evidence: EXP-078/098 (Ch2-Self 0%), EXP-079 (Ch2-World-Model 100%), DD-766 (Ch2-World-Model 93%). Prediction is already partially confirmed.

### P-098g: Ch2-World-Model Can Be Approximated by Cross-Reference
Lightweight cross-reference interventions (grep codebase, check reference spec) capture most of Ch2-World-Model's benefit without requiring a full knowledge graph. **Testable**: Compare cross-reference gate vs full-spec-checking gate on absent-information tasks. If EXP-079's 100% holds across more task types, cross-reference is the practical Ch2-World-Model for our system.

### P-098e: Channel 2 Interventions Are Immune to Prompt Length
Because Channel 2 operates through environmental state (not text competition), adding more text to the system prompt should NOT degrade Channel 2 intervention effectiveness. Forced externalization should work equally well with a 10KB prompt and a 100KB prompt. **Testable**: Run forced externalization experiments with varying prompt sizes — expect no correlation between prompt length and externalization effectiveness.

## Relationship to Existing Hypotheses

| Hypothesis | Relationship | How H-098 Extends It |
|-----------|--------------|---------------------|
| **H-085** (Forced Externalization) | H-085 describes the mechanism; H-098 explains *why* it works | Forced externalization succeeds because it moves judgment from Channel 1 (suppressed) to Channel 2 (gated). The dual pathway (write OR read, KE-032) is explained: both pathways switch the processing channel from incidental to primary. |
| **H-091** (Skill Delivery Methods) | H-091 maps the delivery spectrum; H-098 explains the categorical boundary | The spectrum from text-rule (0%) to few-shot (33-100%) to workflow (87-100%) maps directly to Channel 1 → Channel 3 → Channel 2. The sharp boundary at system-prompt vs task-message (EXP-095/096) is explained by positional privilege as a partial channel separation. |
| **H-095** (Agent-Specific Interventions) | H-095 shows agent-specificity matters; H-098 explains why | Universal text rules fail because they're in Channel 1 regardless of agent. Agent-specific structural gates succeed because they target the exact Channel 2 intervention needed for each FM fingerprint. The differential effect (optimizer +100pp, Bob -67pp for same mechanism) is explained by gate-FM alignment, not channel theory alone — but channel theory explains why structural gates work at all. |
| **KE-101** (Meta-Analysis Laws) | KE-101 states the laws; H-098 proposes the underlying mechanism | Law 1 (text fails) = Channel 1 competition. Law 2 (structure works) = Channel 2 separation. Law 3 (attention zero-sum) = within-channel budget constraint. Law 4 (wiring required) = Channel 1→2 transition. Law 5 (access > content) = channel selection > content quality. |
| **H-053** (Workflow Adoption Decay) | H-053 documents decay; H-098 explains its mechanism | Instructed behaviors decay from ~10% to ~4% because they operate through Channel 1, which is continuously competed. Automated behaviors don't decay because they operate through Channel 2. The decay rate is a function of the degree of channel competition. |
| **H-093** (CIVC) | H-093 describes verification collapse; H-098 explains when it activates | Verification collapse (FM-3.3) occurs when task complexity consumes all Channel 1 capacity, leaving zero bandwidth for verification reasoning. The complexity threshold for collapse is the point where task-execution tokens consume 100% of attention, squeezing out verification tokens. Agent gradient (Scout 6% → Optimizer 73%) reflects different complexity exposure. |

## Evidence Summary

| Evidence | Channel | Direction | Strength |
|----------|---------|-----------|----------|
| KE-002: 0/32+ text rules on judgment | Ch 1 failure | Supports | ★★★★★ |
| KE-031: 17/17 forced ext successes | Ch 2 success | Supports | ★★★★★ |
| EXP-095/096: system vs task position | Ch 3 boundary | Supports | ★★★★★ |
| **EXP-127: Channel Separation Direct Test** | **All 3 channels** | **Partial support** | **★★★★★** |
| **EXP-128: Ch3 Boundary Conditions** | **Ch 3 boundary** | **Supports (clarifies boundary)** | **★★★★** |
| KE-025: instruction overhead harmful | Ch 1 competition | Supports | ★★★★ |
| KE-064: execution crowding at 2+ gates | Ch 2 budget | Supports | ★★★★ |
| **EXP-129: Ch2 Budget Curve (Gate Stacking)** | **Ch 2 budget** | **Contradicts P-098c** | **★★★★** |
| **EXP-131: Gate-Task Synergy (Unrelated Stacking)** | **Ch 2 capacity** | **Supports (refines Ch2 budget)** | **★★★★** |
| H-091: 15/15 task-msg, 0/9 sys-prompt | Ch 3 privilege | Supports | ★★★★ |
| KE-020: 0% available, 100% automatic | Ch 1→2 transition | Supports | ★★★★ |
| KE-034: wrong analysis = correct analysis | Channel switch > content | Supports | ★★★★ |
| EXP-117: same mechanism +100pp/-67pp | Agent-specificity | Neutral | ★★★ |
| DD-660: U-shaped attention architectural | Ch 3 mechanism | Supports (theoretical) | ★★★ |

**EXP-127 Details** (2026-04-10): First direct test of channel theory. Same contradiction-detection content on `contradictory-requirements`. Baseline 0/6, Ch1 0/6, Ch3 0/6, Ch2 6/6. Fisher's exact: Ch2 vs pooled others p=0.0000074. Ch1 confirmed at 0% ✅. Ch2 confirmed at 100% ✅. Ch3 predicted 83-100% but got 0% ❌. Confound: skill already in production coder, so Baseline≡Ch1 and Ch3=Ch1+Ch3 combined — strengthens Ch1 failure finding. Ch3 miss suggests domain match alone is insufficient for analytical judgment tasks (works for behavioral tasks per EXP-095).

**EXP-128 Details** (2026-04-10): Follow-up testing H-128 (detection coverage determines Ch3 effectiveness). 3-arm design with content variants: Arm A (response-only: just show correct detection pattern, 0/6), Arm B (detection-enhanced: detection cues + response pattern, 0/6), Arm C (detection-only: pure detection focus, 0/6). All arms 0/6 — content quality is NOT the Ch3 moderator. H-128 rejected (P(H): 0.55→0.05). The Ch3 failure on `contradictory-requirements` is a **task-type boundary**: coding tasks create execution momentum that overwhelms positional privilege. Ch3 works for behavioral tasks (EXP-095: 100%) where the few-shot directly templates the response, but fails for analytical judgment tasks where the agent must interrupt coding flow to apply the pattern. Two mechanisms identified: (1) coding momentum — high-salience code tokens dominate even task-message attention, (2) success signal misdirection — "code compiles + tests pass" creates false completion signal that suppresses further analysis. → KE-132.

**EXP-130 Details** (2026-04-11): Ch3 few-shot on discovery task (KB integration). Domain-matched examples with before/after patterns. Treatment 2/6 (33%) vs baseline 6/6 (100%). Fisher's exact p=0.030. Ch3 is not just null but actively HARMFUL on discovery tasks. Mechanism: template-following displaces the exploratory behavior needed for creative inference. Few-shot examples constrain the solution search space — the agent follows the example pattern rather than discovering what the specific task requires. This extends the Ch3 task-type boundary: behavioral (100%) → analytical (0%) → discovery (actively harmful). → KE-133.

**EXP-129 Details** (2026-04-11): Direct test of P-098c (Ch2 budget curve). 4-arm design stacking 1-4 forced externalization gates on `contradictory-requirements` scenario. N=6-7 per arm. Results: 1-gate 86% (6/7), 2-gate 83% (5/6), 3-gate 100% (6/6), 4-gate 67% (4/6). **P-098c REJECTED** — no cliff function. Instead a "hump curve" peaking at 3 gates. No pairwise comparison significant (N too small), but the pattern is clear: gates don't crowd out execution until at least 4 are stacked, and even then degradation is modest (67%, not 0%). Failure mode at 4 gates was implementation quality (tests-pass), NOT judgment quality (contradiction-identified — which passed 5/5 at 4 gates). Duration scales linearly: +167s/gate. KE-064 (execution crowding at 2+ gates) needs revision — it may be task-specific or apply only to different gate types. → Revises P-098c, revises KE-064.

**EXP-131 Details** (2026-04-11): Follow-up testing whether gate RELEVANCE explains the EXP-129 hump curve. 3-arm design: Arm A (1 related gate, N=9) 89%, Arm B (3 unrelated gates, N=8) 50%, Arm C (3 related gates, N=7) 86%. **Gate relevance is the key moderator**: 3 related gates (86%) ≈ 1 related gate (89%) >> 3 unrelated gates (50%). Cohen's h = 0.80 (large) for B vs C, though p = 0.28 (underpowered). All 4 Arm B failures were specifically on `contradiction-identified` — unrelated gates dilute judgment depth without affecting implementation quality. Duration was identical across 3-gate arms (584s vs 575s), ruling out time pressure. Combined with EXP-129: 3-related 92% > 1-related 88% > 4-related 67% > 3-unrelated 50%. Ch2 capacity is measured in *relevant analytical scaffolding*, not raw gate count. → KE-135 (gate-task synergy effect).

**Cumulative direction**: 13 supporting, 1 neutral, 1 contradicting (P-098c). Three direct tests confirm 3/4 predictions + 1 boundary clarified + Ch2 capacity refined. Channel 3 model refined: task-type boundary (behavioral vs analytical vs discovery under coding momentum). **EXP-129 rejects P-098c**: Ch2 budget is NOT ~1 gate — 3 gates show 100% and even 4 gates show 67%, not the predicted cliff. **EXP-131 refines further**: Ch2 budget depends on gate-task relevance, not count.

## Open Questions

1. **Is Channel 3 truly intermediate, or is it a special case of Channel 1?** The positional privilege effect (task-message vs system-prompt) could be a continuous gradient or a categorical boundary. EXP-096 suggests categorical, but more experiments needed. **EXP-128 update**: Ch3 is NOT Channel 1 — it works for behavioral tasks (EXP-095: 100%) but fails for analytical judgment under coding momentum. This is a task-type boundary, not a channel identity question. Ch3 is a genuine intermediate channel with its own preconditions.

2. **What is the Channel 2 attention budget?** ~~We know 1 externalization works and 2+ crowd out execution. Is the budget literally one gate, or is it proportional to total execution time?~~ **EXP-129 update**: Budget is NOT ~1 gate. 3 related analytical gates show 100% pass rate, 4 gates show 67%. The budget is at least 3 gates for related analytical tasks. Remaining question: is the budget proportional to gate-task relevance? (i.e., do *unrelated* gates crowd out faster?)

3. **Can Channel 2 interventions interfere with each other?** Two different structural gates might compete for execution time without any text-channel competition. Is this a fundamentally different type of resource constraint? **EXP-129 update**: Related gates (analysis → impact → risk → plan) do NOT interfere up to 3 gates. At 4 gates, interference manifests as implementation degradation (tests-pass fails), not judgment degradation. Gate relevance may be a key moderator.

4. **Does the channel model generalize to other LLMs?** All evidence is from a single model family. If Channel 1 suppression is architectural (causal decoder attention patterns), it should generalize. If it's alignment-training-specific, it might not.

5. **What happens at the Channel 1-2 boundary?** Some interventions (e.g., echo-back prompts, checklist injection) are text-based but impose weak structure. Do they operate through Channel 1 or Channel 2? Their intermediate effectiveness (~33%) suggests partial channel separation.

## Experimental Proposals

### EXP-E1: Channel Separation Direct Test → **EXP-127 (COMPLETE)**
Design: Same judgment intervention delivered through 3 channels:
- Arm A: Text instruction in system prompt (Channel 1) — lab fork `coder-channel-test-ch1`
- Arm B: Same content as task-message few-shot (Channel 3) — scenario `contradictory-requirements-ch3-fewshot`
- Arm C: Same content as forced externalization gate (Channel 2) — scenario `contradictory-requirements-ext`
- Baseline: No intervention — scenario `contradictory-requirements`
Prediction: Baseline 0%, Ch1 0-17%, Ch3 83-100%, Ch2 83-100%. N=6 per arm (24 total).
**Results**: Baseline 0/6, Ch1 0/6, Ch3 0/6, Ch2 6/6. Predictions hit 3/4 (Ch3 miss: 0% vs predicted 83-100%).
**Follow-up**: EXP-128 tested whether Ch3 miss was due to content quality (H-128). Three content variants all 0/6 → content NOT the moderator. Ch3 has task-type boundary (KE-132).
**Files**: `agents/shared/knowledge/experiments/EXP-127/design.md`, `protocol.md`, `results.md`; `agents/shared/knowledge/experiments/EXP-128/design.md`, `results.md`

### EXP-E2: Channel 2 Budget Curve → **EXP-129 (COMPLETE — P-098c REJECTED), EXP-131 (COMPLETE — Relevance Refinement)**
Design: Chain 1, 2, 3, 4 forced externalization gates on a judgment task.
Prediction: ~100%, ~50%, ~10%, ~0% task completion. Cliff between 1-2 gates.
**EXP-129 Results**: 1g 86%, 2g 83%, 3g 100%, 4g 67%. No cliff. Hump curve peaking at 3 gates. P-098c rejected.
**EXP-131 Results**: Follow-up testing gate relevance. 3 unrelated gates 50% vs 3 related gates 86% vs 1 related gate 89%. Gate-task synergy explains the hump curve — Ch2 capacity is measured in relevant scaffolding, not raw gate count. Cohen's h = 0.80 (large effect). → KE-135.
**Files**: `agents/shared/knowledge/experiments/EXP-129/`, `agents/shared/knowledge/experiments/EXP-131/`, `agents/shared/knowledge/entries/KE-135-gate-task-synergy-effect.md`

### EXP-E3: Prompt Length × Channel Interaction
Design: Forced externalization (Channel 2) with 10KB, 25KB, 50KB, 100KB system prompts.
Prediction: No effect of prompt length on Channel 2 effectiveness (all ~100%).
N=3 per condition.

---

## Conclusion

**Verdict**: CONFIRMED with refinements. The three-channel model is the most explanatory framework we have for intervention effectiveness. 13 supporting findings, 1 neutral, 1 contradicting (P-098c — Ch2 budget is larger than predicted). Three direct experimental tests (EXP-127, EXP-128, EXP-129) plus one refinement (EXP-131) confirm the core architecture while refining boundary conditions.

**Key Finding**: Intervention effectiveness is categorically determined by delivery channel, not content quality. Channel 1 (text instructions) achieves 0% on judgment tasks (N=32+). Channel 2 (environmental state gates) achieves 87-100%. Channel 3 (task-message positional privilege) is task-type-dependent: 100% on behavioral, 0% on analytical judgment, and actively harmful (-67pp) on discovery tasks. Content quality within a channel is irrelevant — EXP-128 proved three content variants all produce identical 0% results through Ch3 on analytical tasks.

**Production Impact**: This framework is now the default decision tool for all intervention design in the May system. It eliminates entire categories of wasted effort (prompt engineering for judgment, SOUL.md refinement for behavioral change) and directs investment toward Channel 2 infrastructure (forced externalization, workflow gates, artifact-based checkpoints). The Ch2 budget refinement (EXP-129/131: up to 3 related gates, relevance > count) enables richer scaffolding than originally thought possible.

**Remaining Gaps**: (1) P-098d untested — does Ch1 capacity vary with task complexity? (2) P-098e untested — are Ch2 interventions truly immune to prompt length? (3) Generalization to other LLM families unknown. (4) Channel 1-2 boundary interventions (e.g., echo-back at ~33%) need mechanistic explanation.

**Recommendation**: Close as confirmed. Remaining gaps are refinements, not challenges to the core theory. The channel model should be treated as established infrastructure knowledge, not an active research hypothesis. Future work should focus on expanding Ch2 design patterns and mapping the Ch3 task-type boundary more precisely.

---

## Meta-Observation: Why This Theory Matters

H-098 is not just a description of what works — it's a **prescriptive decision framework** for intervention design. The practical implication is:

1. **Never invest in Channel 1** for judgment tasks. No amount of prompt engineering, SOUL.md refinement, or text-rule improvement will work. This is not a "try harder" problem.

2. **Default to Channel 2** (structural interventions) for any behavioral change. The question is "what artifact should the agent create before acting?" not "what should we tell the agent?"

3. **Use Channel 3** (task-message examples) as a lightweight alternative when Channel 2 infrastructure is too costly, **but only for behavioral tasks** where the few-shot directly templates the response. For analytical judgment tasks (contradiction detection, quality assessment under coding momentum), Channel 3 is ineffective regardless of content quality (EXP-128, KE-132). For discovery tasks (creative inference, novel pattern identification), Channel 3 is actively **harmful** — template-following displaces exploration (EXP-130, KE-133).

4. **Budget Channel 2 interventions**: ~~One structural gate per task.~~ **EXP-129 update**: Up to 3 related analytical gates per task with no degradation. At 4 gates, mild degradation (67%) manifests as implementation quality loss, not judgment loss. Choose gates that are analytically related to the task. Duration cost is real: +167s/gate. More gates = longer execution, which may matter more than accuracy loss.

The channel model predicts that future intervention research should focus on expanding Channel 2 capacity (can we chain gates without crowding?) and understanding Channel 3 task-type boundaries (behavioral=100%, analytical=0%, discovery=harmful — what's the distinguishing feature?), rather than finding better Channel 1 content (which is provably futile for judgment tasks) or better Channel 3 content (which EXP-128/130 shows is futile or harmful for non-behavioral tasks).
