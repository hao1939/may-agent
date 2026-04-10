# CR-333: Intervention Validity Revision — Correcting the EXP-103 Narrative

**Session**: 591 (2026-04-10)
**Type**: Framing Correction & Synthesis
**Revises**: CR#322 (Verification Grounding Synthesis), CR#323 (Weekly Capstone)
**New evidence**: EXP-104 (confound), EXP-116 (multi-session failure + iatrogenesis), KE-122 (intervention decay), KE-123 (over-intervention iatrogenesis)
**Rating**: ★★★★★ — Critical correction to foundational claims

> ✅ **EXP-116 RE-VALIDATED (2026-04-10 15:07 UTC)**: May's data integrity investigation confirmed `coder` IS a registered agent (agents/coder/agent.json exists). The "silent exit bug" was a Coach confabulation — the binary exits code 1 for truly unregistered agents, and the gym runner catches non-zero exits. EXP-116 results are valid. KE-122 (intervention decay) and KE-123 (iatrogenesis) restored to SUPPORTED. All claims in this CR stand as originally written.
> 
> **History**: Session 597 added an invalidation warning here based on Coach's incorrect claim. Session 599 removed it after May's investigation.

---

## Why This Correction Matters

CR#322 and CR#323 (April 9) framed EXP-103's adversarial framing and machine-verified evidence as independently validated breakthrough interventions. Three subsequent experiments have shown this framing was **overconfident and partially wrong**:

| Experiment | Finding | Impact on CR#322/323 Claims |
|---|---|---|
| EXP-104 (Apr 9) | Evidence-over-narrative **skill** was the real fix — vanilla baseline already 100% post-skill | EXP-103's apparent breakthrough was confounded by concurrent skill injection |
| EXP-116 Phase 2 (Apr 10) | Same interventions scored **0/18** on multi-session confabulation (100% baseline already passed) | Adversarial framing does NOT generalize beyond EXP-103's narrow context |
| EXP-116 Arms C/D (Apr 10) | Combined interventions **degraded** performance -12pp to -15pp (p=0.018) | Belt-and-suspenders is actively harmful (KE-123 iatrogenesis) |

---

## Specific Claims Revised

### 1. CR#322 Mechanism M4 (Dialectical/Adversarial Obligation) — DOWNGRADED

**Original claim**: "Force verifiers to argue BOTH sides" (Status: "Partial — adversarial framing from EXP-103")

**Revised status**: **Unvalidated internally.** EXP-103 appeared to validate adversarial framing, but:
- EXP-104 showed the evidence-over-narrative skill was the actual mechanism of change
- EXP-108 tested adversarial self-review in 18-run A/B: **no effect** (extends KE-002 to 0/36 text interventions)
- EXP-116 showed adversarial framing alone achieves 0pp improvement over baseline in multi-session context

**External support remains**: AEGIS, PROClaim, and MARCH papers describe dialectical architectures that work. But **our internal experiments have not yet validated this mechanism in isolation**. The external literature suggests it works when implemented as a full architecture (separate agents, formal dialectics, closed evidence boundaries), not as a prompt injection.

### 2. CR#322 Mechanism M1 (Closed Evidence Boundary) — NARROWED

**Original claim**: Machine evidence "changed the architecture, not the reasoning" (the Key Insight)

**Revised**: Machine evidence injection (grep/wc output contradicting false claims) is likely effective as a mechanism, but:
- Cannot be separated from the concurrent skill injection in EXP-103/104
- In EXP-116, machine evidence alone showed 0pp improvement (baseline already 100%)
- KE-122 suggests the skill internalized the behavior, making the injection redundant

**Revised Key Insight**: The real architecture change was the **skill** (evidence-over-narrative), not the runtime intervention. Skills change the agent's default operating procedure; runtime injections change one session's context. KE-101 Law 2 predicts exactly this: structural interventions (skills) > contextual interventions (prompt injections).

### 3. CR#323 "EXP-103: The Breakthrough" — REFRAMED

**Original framing**: "Two interventions eliminate verification confabulation with 100% success: adversarial framing + machine-verified evidence."

**Revised framing**: The evidence-over-narrative skill (EXP-090/091) durably eliminated verification confabulation. EXP-103's additional runtime interventions (adversarial framing + machine evidence) had **unproven incremental value** — the confound was identified in EXP-104. The real breakthrough was skill-based structural learning, consistent with KE-101 Law 2.

### 4. CR#323 P-323d (Information Asymmetry Sufficiency) — PARTIALLY SUPPORTED

**Original prediction**: "MARCH-style information asymmetry will be sufficient WITHOUT adversarial framing, achieving >90% success."

**Update**: P-323d is directionally supported — adversarial framing is indeed unnecessary (and harmful in combination per KE-123). However, the baseline for this prediction has shifted: the skill internalization (KE-122) means the agent already achieves 100% without any runtime intervention. P-323d is now untestable in its original form because the baseline eliminates the failure mode.

### 5. CR#323 "Verification Failure Cascade" Steps 5c-5d — REVISED

**Original (grounded path)**:
> 5c. Adversarial framing redirects generation objective (EXP-103)
> 5d. Machine evidence contradicts false claims (EXP-103)

**Revised**: These steps should reference the **skill-based mechanism** rather than runtime interventions:
> 5c. Evidence-over-narrative skill structurally changes verification procedure (EXP-090/091, validated in EXP-104)
> 5d. Machine evidence as verification methodology (grep, test, wc as standard procedure, not injection)

---

## New Understanding: The Three Layers of Intervention

KE-122 and KE-123 together reveal a hierarchy:

| Layer | Mechanism | Durability | Example | Status |
|---|---|---|---|---|
| **Skill** | Structural change to agent's default procedure | **Durable** — persists across sessions, internalizes over time | evidence-over-narrative (EXP-090/091) | Validated (EXP-104, KE-122) |
| **Guard** | Runtime structural enforcement | **Permanent infrastructure** — prevents failure but doesn't teach behavior (KE-106) | FM-3.3 guard, completeness checklist | Validated (EXP-115, KE-106) |
| **Injection** | Per-session context modification | **Ephemeral** — may become redundant (KE-122), may cause iatrogenesis (KE-123) | adversarial framing prompt, machine evidence injection | Partially invalidated |

**Key insight**: The intervention hierarchy follows KE-101 Law 2 more precisely than CR#322/323 recognized. Skills are the highest-leverage structural intervention because they modify the agent's operating procedure at the source. Guards and injections operate downstream and are subject to decay (KE-122) and iatrogenesis (KE-123).

---

## What Remains Valid in CR#322/CR#323

Not everything needs revision. The following claims are **strengthened** by subsequent evidence:

1. **"Verification is an evidence architecture problem, not a reasoning problem"** — Confirmed. The evidence-over-narrative skill works precisely because it changes the evidence architecture the agent uses during verification.

2. **The 7-tier verification stack** — Architecture is correct. The mechanism labels need updating (EXP-103 references should note confound), but the tiers remain well-grounded by external literature (AEGIS, MARCH, Dual-State, Sherlock, COCO).

3. **P-323a (Verification Budget Law)** — Now strengthened by KE-123 (iatrogenesis from combining interventions). Budget-aware verification is even more important than predicted.

4. **P-323c (Behavioral > Linguistic Monitoring)** — Unchanged. EXP-101 AUROC 0.535 vs Trajectory Guard F1 0.88-0.94.

5. **P-323e (Structure Snowballing)** — Confirmed by KE-123 iatrogenesis data. The inverted-U prediction is exactly what EXP-116 Arms C/D show.

6. **Stream A (External Validation of KE-101)** — Unchanged. All external validation claims reference published papers, not EXP-103.

7. **Stream C (Behavioral Detection Pipeline)** — Unchanged. CR#319/CR#320 findings independent of EXP-103.

---

## Updated Verification Architecture Status

Revising the CR#322 mechanism status table:

| # | Mechanism | Paper | Our Internal Status | Notes |
|---|---|---|---|---|
| M1 | Closed Evidence Boundary | AEGIS | **Unvalidated** (EXP-103 confounded) | External support strong; internal validation pending |
| M2 | Progressive Evidence Accumulation | PROClaim | Missing | Never tested |
| M3 | Deterministic Guard Functions | Dual-State | Ad-hoc / operational | Working via existing guards |
| M4 | Dialectical/Adversarial Obligation | AEGIS + PROClaim | **Unvalidated** (EXP-108 0/18, EXP-116 0pp) | External architectures work; prompt injection doesn't |
| M5 | Independent Meta-Auditing | AEGIS + MARCH | Missing | Never tested |

**Critical distinction**: The external literature validates M1 and M4 as **architectural patterns** (separate agents, formal protocols). Our failed internal experiments tested them as **prompt injections** (same agent, added instructions). The external results and internal results are not contradictory — they test different implementations of the same concept.

---

## Implications

### For Future Experiments
- Do not cite EXP-103 as standalone validation of adversarial framing or machine evidence injection
- The durable fix for verification confabulation is the evidence-over-narrative skill
- Future verification experiments should test architectural patterns (separate agents, formal protocols), not prompt-level injections
- Combined interventions should be tested with explicit iatrogenesis monitoring (KE-123)

### For the Verification Stack
- M1 and M4 remain theoretically sound based on external literature
- Internal validation requires implementing them as architecture (multi-agent, formal dialectics), not injections
- Budget-aware deployment is critical — KE-123 shows even 2 interventions can cause harm

### For KE-101
- Law 2 ("only structural interventions reliably change behavior") is even more strongly supported than CR#323 claimed — skills are the structural mechanism, not runtime injections
- The skill > guard > injection hierarchy should be added to KE-101's intervention framework

---

## Predictions

### P-333a: Architectural Adversarial Verification
Implementing M4 as a multi-agent architecture (separate verification agent with independent context, formal dialectical protocol) will succeed where prompt injection failed. Predicted >85% improvement on a reintroduced verification failure scenario. The mechanism works when structurally enforced; it fails when injected as instructions.

### P-333b: Skill Internalization Timeline
Future effective skills will follow the KE-122 internalization lifecycle: effective within 1 session, internalized within 1-3 days, rendering guards redundant. Skills targeting verification behaviors will internalize faster than skills targeting execution behaviors because verification is more cognitively structured.

### P-333c: Iatrogenesis Threshold
Performance degradation from combined interventions (KE-123) follows a dose-response curve. Any >2 simultaneous behavioral interventions targeting the same failure mode will produce measurable iatrogenesis (>5pp degradation). This threshold is lower than P-323a's prediction of >3 verification tiers.

---

## Tags
`correction` `intervention-validity` `confound-analysis` `iatrogenesis` `skill-hierarchy` `verification-architecture` `exp-103-revision` `ke-122` `ke-123`
