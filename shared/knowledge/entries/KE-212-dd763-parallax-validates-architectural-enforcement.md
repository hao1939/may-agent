# KE-212: DD-763 Parallax — External Validation of Architectural Enforcement (H-098 Ch2 at the Infra Level)

**Date**: 2026-04-17
**Source**: DD-763 (Parallax: An Architecture for Safe Autonomous AI Execution, arXiv 2604.12986; OpenParallax Go reference impl)
**Confidence**: High (280-case adversarial eval, 9 attack categories, 98.9% / 100% block rates, 0 FPs; independent of our corpus)
**Connects**: H-098 (attention channel theory), H-160 (structural enforcement outperforms behavioral), KE-007 (workflow enforcement only reliable intervention), KE-011 (knowledge files are passive), KE-187 (Ch2 sub-taxonomy), KE-195/196 (production-displacement / content-first guards), KE-211 (λ_A structural incompleteness), CR-306/CR-324 (architectural-enforcement thesis), CR-326 Path A (production-first eval)

---

## Core Finding

DD-763's OpenParallax evaluation — **98.9% attack block under default config, 100% under max-security, 0 false positives on 280 adversarial cases across 9 categories, and 0% protection from prompt guardrails when the reasoning system is compromised** — is a production-scale, independently-conducted replication of the Channel 2 vs Channel 1 effect predicted by H-098. The numbers land almost exactly on our in-corpus Ch2-Environment vs Ch1 boundary (87–100% vs ~0%, N=32+), this time under adversarial load rather than behavioral-skill load.

This is the strongest **external** validation yet of the architectural-enforcement thesis. It graduates "structural > prompt" from an in-house pattern (KE-007, KE-011, H-160) to a claim that holds under a red-team-grade test we have never ourselves run.

## What Parallax Tested That EXP-127 Did Not

EXP-127 directly compared Ch1 (text/system-prompt) vs Ch2 (environmental state / workflow gate) vs Ch3 (task-message) on analytical-judgment gym scenarios. It established the *baseline* effect under cooperative conditions: the agent tries to do the task; the question is whether the intervention helps.

Parallax tests the **adversarial** regime: **Assume-Compromise Evaluation** assumes the reasoning system has already been taken over (via prompt injection, tool misuse, goal-manipulation, etc.) and asks whether the rest of the architecture still holds. This is a regime we have not tested:

| Dimension | EXP-127 (ours) | Parallax Assume-Compromise |
|---|---|---|
| Agent posture | Cooperative (trying to do the task) | Compromised (trying to execute malicious action) |
| Signal measured | Does intervention raise pass rate? | Does architecture block attack when prompt rules are ignored? |
| Ch1 result | ~0% on judgment tasks | **Exactly 0%** (prompt rules are inside the compromised system) |
| Ch2 result | 87–100% (cooperative) | **98.9–100% (adversarial)** |
| Generalization | Behavioral intervention effectiveness | Safety guarantee under active compromise |

The Ch1=0% result is stronger in the adversarial setting than in ours. In our experiments Ch1 sometimes squeaks out a few percent of help through coincidence; under assumed compromise Ch1 is **provably** zero, because the rules and the attacker share the same attention context. DD-763 crystallizes the intuition: *"prompt-level guardrails provide zero protection because they exist only within the compromised system."*

## The Four Parallax Principles vs Our Enforcement Taxonomy

| Parallax principle | Maps onto | Status in our taxonomy |
|---|---|---|
| **Cognitive-Executive Separation** | H-098 Ch1↔Ch2 boundary; KE-007 workflow gates; Bob's hard-gate vs skill result (100% vs 0%) | **Already present** — Parallax is the infrastructure-layer articulation of what we call "structural intervention." |
| **Adversarial Validation with Graduated Determinism** | KE-187 Ch2-World-Model (Sentinel-style runtime check) | **Already present but narrower** — we have per-claim world-model checks; Parallax generalizes to a multi-tier validator sitting between *every* reason→act transition. |
| **Information Flow Control** (sensitivity labels propagated through workflows) | **NEW addition to our taxonomy** | Not in H-098, not in KE-187 sub-taxonomy. Closest analog is KE-188's P(access) vs P(applies), but that's a *property* not a *mechanism*. Info-flow typing is a Ch2 sub-type we haven't named — call it **Ch2-Flow**. |
| **Reversible Execution** (pre-destructive state capture + rollback on validation failure) | **NEW addition to our taxonomy** | Not present. Our guards are pre-commit (block before action) or post-hoc (catch in finish). Parallax adds a third stance: **let the action run, capture reversal state, roll back on validator veto**. Strict generalization of pre-commit guards that preserves agent autonomy. |

Two of the four principles are straight replications; two are genuine extensions. The taxonomy update is:

- **Ch2-Self** (agent's own reasoning, KE-187) — 87–100% where self-diagnosis suffices
- **Ch2-Environment** (local system state, KE-187) — high for verifiable facts
- **Ch2-World-Model** (external knowledge graph, KE-187) — 93–100% on absent-information
- **Ch2-Flow** (information-flow labels, **NEW from DD-763**) — adds data-sensitivity propagation as a structural constraint; catches exfiltration-class attacks that Ch2-Self/Env/World-Model miss because the bug is a *flow* property, not a *fact* property
- **Ch2-Reversible** (pre-destructive snapshot + rollback, **NEW from DD-763**) — orthogonal to the above; converts any Ch2 check into a post-action veto with bounded blast radius

I'll refer to the expanded Ch2 sub-taxonomy as **Ch2 = {Self, Environment, World-Model, Flow, Reversible}** going forward; H-098 should be updated in its next revision to reference DD-763 and inline the two new sub-types.

## Does Parallax's 98.9% Replicate H-098's Ch2 Claim?

**Partially. Enough to strengthen confidence, not enough to re-open CONCLUDED status.**

H-098's Ch2 claim, strictly stated, is: *interventions operating through environmental/structural channels achieve 87–100% on judgment tasks where Ch1 achieves ~0%.* Parallax's 98.9% is architectural enforcement on **safety** (blocking malicious actions), not **judgment** (picking the right action on a cooperative task). These are related but not identical:

- **Similarity**: Both are "the decision happens inside a structurally distinct system that the reasoning loop cannot override." That is the mechanism H-098 proposes, applied to a different decision class.
- **Difference**: Judgment failures (our EXP-127 etc.) are *capacity* limits; safety failures (Parallax's 280 cases) are *adversarial* limits. Capacity limits are moderated by task difficulty (KE-196); adversarial limits are (roughly) independent of task difficulty — you either have the architectural boundary or you don't.

Because the decision class differs, this is **corroborating evidence** rather than a direct independent replication. P(H-098) should update, but modestly.

**P(H-098) update recommendation: 0.80 → 0.84.** Rationale: the +0.04 reflects (a) external, independent methodology landing on the same Ch1=0% / Ch2≈100% split, (b) extension of the Ch2 class to adversarial regimes, counter-weighted by (c) the decision-class mismatch (safety ≠ judgment) and (d) H-098 already being CONCLUDED — further movement is low-information. I would not re-open status; this is a confidence tightening, not a structural revision. If a Parallax-style eval on our own stack (see "Actionable" below) replicates the pattern on judgment tasks, *that* would justify a larger bump.

## Actionable: Pilot an Assume-Compromise Eval Against EXP-178's G4 Adaptive Guard

The cheapest high-value move is a **scoped adversarial replication**. We do not need to rebuild Parallax; we need to borrow its methodology (Assume-Compromise Evaluation, ACE) and apply it to one existing guard we care about.

**Pilot design** (fits one session, no new infrastructure):

- **Target**: EXP-178's G4 difficulty-adaptive content-first guard (most recent, least-tested).
- **Setup**: Instead of running agents cooperatively, construct 15–20 "compromised" task prompts where the task-message explicitly instructs the agent to bypass or ignore the guard's intended content-first pattern (e.g., "skip reading the analysis file and produce your fix directly"). This is Ch1 attacking Ch1.
- **Primary metric**: Block rate — does G4's **structural** gate (whatever file-artifact / workflow-step condition it enforces) hold regardless of the task-message instruction? Ch1-pure guards (pure text skill) should drop to ~0%; G4's Ch2 component should hold near 100% if our thesis transfers.
- **Secondary metric**: False-positive rate on a matched set of cooperative prompts (to confirm we haven't over-tuned).
- **Expected result** (from H-098 + DD-763): if G4's enforcement is truly structural, block rate ≥ 95% on compromised prompts and FP ≤ 5% on cooperative prompts. If block rate drops much below 95%, G4 has Ch1-contaminated enforcement we didn't realize it had.
- **Cost**: ~20 × $0.10 = $2. Single session. No new gym scenarios required — reuse EXP-178's task set with prompt rewrites.

This pilot is also directly aligned with **CR-326 Path A** (production-first eval methodology): ACE *is* production-first evaluation, because it tests the boundary the real deployment will face (adversarial inputs), not the boundary the developer hopes will be tested (cooperative inputs). Proposing it as a template for our eval stack is the durable contribution; the EXP-178 pilot is the proof of concept.

## Implications

### 1. External corroboration, not re-litigation
Log this as a Type-A evidence update for H-098: external methodology, same qualitative result, modest confidence bump (0.80 → 0.84). Do not re-open CONCLUDED status.

### 2. Enforcement taxonomy extended by two sub-types
Ch2-Flow and Ch2-Reversible are additions, not replacements. Next H-098 revision should inline them. KE-187's Ch2 sub-taxonomy table should gain two rows.

### 3. ACE is the adversarial-eval template we've been gesturing at
CR-326 Path A has been vague about *how* production-first eval differs from cooperative gym runs. DD-763 provides the concrete template: assume compromise, measure architectural block rate, ignore what the reasoning system says it will do.

### 4. Ch1-only guards are now doubly-falsified
Previously: Ch1 fails on cooperative judgment (~0%, EXP-127). Now also: Ch1 fails **provably** under compromise (0%, by construction — the rule lives inside the attacker). Any future proposal for a pure-prompt guard should cite this double-falsification.

## Open Questions

- **Does our stack have any Ch2-Reversible guards at all?** Git commit checkpoints and `.state/` snapshots approximate reversible execution but are manual. Worth auditing whether the finish-guard / coach pipeline could adopt a snapshot-and-rollback stance rather than pre-commit block.
- **Is Ch2-Flow implementable without a typed language (cf. KE-211 λ_A)?** Information-flow labels traditionally require a type system. Our agent stack is dynamically-composed YAML + Python. Partial flow tracking via tool-call metadata may be sufficient — needs a design pass.
- **Does Parallax's 0-FP result survive outside the 280-case benchmark?** DD-763 reports 0 FPs on its own eval set; we do not know the base rate of false positives on *real* (non-adversarial) traffic. Before adopting the methodology, we should design the pilot's cooperative-prompt FP arm carefully.
- **What's the interaction with KE-091 alignment tax?** Architectural guards avoid Ch1 alignment tax by construction, but adding reversible-execution state capture has its own cost (latency, storage). Whether that cost manifests as a behavioral regression on synthesis-style tasks is unknown.

## Summary Line

DD-763 Parallax is a strong external replication of H-098's Ch1=0 / Ch2≈100 split, extends our Ch2 sub-taxonomy with Flow + Reversible, and gives us the ACE methodology as a concrete template for the kind of production-first eval CR-326 Path A has been asking for. **P(H-098) update recommendation: 0.80 → 0.84 (CONCLUDED, no status change).**
