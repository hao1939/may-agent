# EXP-116 Design Review — Bob (Architect)

**Date**: 2026-04-10
**Reviewer**: Bob
**Status**: REVIEW — SIGNIFICANT REVISIONS NEEDED
**Recommendation**: DO NOT PROCEED as designed. Fix confounds, update evidence claims, simplify.

---

## Executive Summary

EXP-116 is an ambitious and well-structured experiment design, but it has **three critical problems** and several moderate issues that need resolution before execution:

1. **The EXP-103 evidence base is confounded** — the design treats EXP-103 as proving adversarial framing works, but EXP-104 revealed that the evidence-over-narrative skill was already deployed, meaning all EXP-103 subjects were pre-treated. The "+75-89pp" effect size is uninterpretable.

2. **KE reference errors** — Section 12 cites "KE-094" and "KE-095" as "Adversarial Framing Bypass" and "Machine-Verified Evidence" but these are actually KE-099 and KE-100. KE-094 is Commit Guard Structural Enforcement and KE-095 is Behavioral Failure Prediction. This misattribution undermines the traceability of the design.

3. **EXP-108 Phase 2 null result ignored** — the design doesn't account for KE-119's finding that adversarial self-review produces "review without action" — agents perform the critique ritual but don't change behavior. This directly threatens H1.

---

## Critical Issues

### C1: EXP-103 Confound Makes Effect Size Claims Unreliable

**The problem**: Throughout the design (Sections 1, 2.3, 3.3, Appendix A), EXP-103's 100% pass rate and "+75-89pp effect size" are cited as the foundational evidence. However:

- **EXP-104 (Context-Stripped Verification)** revealed the confound: the evidence-over-narrative skill from EXP-090/091 was already deployed in all agents used for EXP-103. Baseline agents in EXP-103 already had anti-confabulation training.
- **EXP-104 baseline was 100%** — agents with the skill already didn't confabulate at all (vs the expected 11-25% from EXP-102).
- This means EXP-103's baselines (11-25%) may reflect something OTHER than normal confabulation — possibly scenario-specific difficulty, not the confabulation mechanism.
- The treatment effect (+75-89pp) is therefore measured against an anomalous baseline, not against the real production confabulation rate.

**What this means for EXP-116**: We don't actually know if adversarial framing adds anything on top of the already-deployed skill. The treatment may be redundant.

**Required fix**: 
- Acknowledge the confound explicitly in the design
- Run a proper baseline: skilled agents WITHOUT adversarial framing on the same scenarios, to measure the MARGINAL effect of framing above the skill
- Alternatively, test on scenarios where the skill alone doesn't reach ceiling (if any exist)

### C2: KE Reference Errors (KE-094/095 vs KE-099/100)

**The problem**: Section 12 ("Connection to Knowledge Base") states:

> - **KE-094** (Adversarial Framing Bypass): The mechanism this guard deploys
> - **KE-095** (Machine-Verified Evidence): The secondary mechanism for belt-and-suspenders

But the actual knowledge entries are:
- **KE-094**: Commit Guard — Structural Enforcement (structural code guard design)
- **KE-095**: Behavioral Failure Prediction / FM-2.1 Heterogeneous Not Strategic
- **KE-099**: Adversarial Framing Bypass for Verification Confabulation
- **KE-100**: Machine-Verified Evidence Injection for Verification Confabulation

This is not a cosmetic issue — citing wrong knowledge entries breaks traceability and suggests the author didn't verify the references against the actual knowledge base. It also means someone implementing Phase 3 would read the wrong KE entries.

**Required fix**: Replace KE-094→KE-099 and KE-095→KE-100 throughout.

### C3: EXP-108 Phase 2 Null Result Threatens H1

**The problem**: EXP-108 Phase 2 was an 18-run A/B test (N=9 per arm) of adversarial self-review. Result: **null** — Control 77.8% vs Treatment 72.2%, Δ=−5.6pp (p=0.99). The treatment actually performed WORSE, though not significantly.

KE-119 synthesized this as **"review without action"** — agents perform the critique ceremony but don't generate new evidence or change behavior. The adversarial prompt creates the appearance of review without the substance.

EXP-116's H1 depends on adversarial framing changing agent behavior. But EXP-108 Phase 2 showed that asking agents to critique inherited work doesn't improve outcomes. The key question EXP-116 doesn't address: **why would EXP-116's adversarial framing work when EXP-108's adversarial self-review didn't?**

Possible answer: EXP-116 combines framing with machine evidence (Component 2) and a beforeToolCall guard (enforcing file reads). But then the adversarial framing alone (Arm A) may be predicted to fail, and the actual active ingredient is the guard enforcement — which is a structural intervention, not a framing intervention.

**Required fix**: 
- Add explicit discussion of EXP-108 Phase 2 null result and why EXP-116 is expected to overcome it
- Predict that Arm A (framing only) may show null result consistent with EXP-108
- If the prediction is that Arm D (combined + guard) is the real treatment, then Arm A becomes a replication of EXP-108's null result, which is fine scientifically but should be framed that way

---

## Moderate Issues

### M1: Baseline Reuse May Not Be Valid

Section 4.1 proposes using "EXP-102/103 baseline data (N=2 × 2 scenarios, re-run +2)" for the baseline arm. But:
- EXP-102/103 data was collected with the evidence-over-narrative skill deployed (the confound)
- The skill has been deployed for days now and may have other interaction effects
- Fresh baselines with explicit skill-state documentation are needed

**Fix**: All 30 runs should be fresh. Document whether skill is deployed/active for each run. Consider a 2×2 design: skill present/absent × framing present/absent.

### M2: "Depends on" Section Lists Wrong KE Numbers

The header says "Depends on: EXP-103, EXP-102, KE-093, KE-094, KE-095" — same KE numbering error as Section 12.

**Fix**: Should be KE-093, KE-099, KE-100.

### M3: Clean-Handoff Scenario (H2) Needs Tighter Criteria

Section 6 tests whether adversarial framing causes overhead on correct inherited work. But the success criteria are vague: "Total duration not >50% longer than baseline." That's extremely generous — a 50% overhead on every clean handoff would be massive at production scale.

**Fix**: Tighten to ≤20% duration overhead AND no introduced regressions.

### M4: N=6 Per Arm Is Low for 5 Arms

With 5 arms × 6 runs = 30 total runs, each arm has only N=6 (3 per scenario × 2 scenarios, or 6 on one scenario). Given the high variance observed in EXP-108 (77.8% vs 72.2% with N=9 was not significant), N=6 may lack power to detect meaningful differences between arms.

**Fix**: Either increase to N=9 per arm (45 total, ~$13.50), or combine arms to increase per-comparison N. Alternatively, accept low power and treat this as a pilot.

### M5: Production Deployment Plan Jumps Ahead

Sections 5 and 7 go into detailed production implementation (TypeScript interfaces, manager.ts integration points, per-agent rollout tiers). This is premature — Phase 2 gym results should be analyzed before engineering Phase 3. 

This isn't wrong, exactly — it's forward planning. But it creates risk of commitment bias: having designed the production system in detail, there's pressure to build it even if Phase 2 shows modest or null results.

**Fix**: Label Sections 5 and 7 explicitly as "contingent on Phase 2 results meeting success criteria."

---

## Minor Issues

### m1: Section 3.3 Framing Reduced from EXP-103
The production framing (Section 3.3) is deliberately shorter than EXP-103's proven framing (Appendix A). The rationale is reasonable (context budget), but this means we're testing a MODIFIED intervention, not the proven one. Arm A should use the original EXP-103 framing, with a separate arm testing the shortened version if desired.

### m2: Missing Connection to H-093 (CIVC)
H-093 (Complexity-Induced Verification Collapse) is referenced in the KE dependencies but not discussed mechanistically. The question is: if confabulation is complexity-induced (H-093), does adversarial framing INCREASE complexity (adding more instructions) and potentially WORSEN the problem? EXP-100 showed forced checkpoints HARM high-complexity tasks.

### m3: Heartbeat Exclusion May Miss the Most Important Case
Section 3.2 excludes heartbeat sessions, but Coach's heartbeats are the primary multi-session work pattern (Section 2.2 notes this). The exclusion should be revisited — at minimum, test WITH heartbeats in the gym.

---

## What's Good

Despite the issues, EXP-116 has several strengths worth preserving:

1. **Problem analysis (Section 2)** is excellent — the cascade problem description and injection point analysis are precise and well-grounded.
2. **Hybrid architecture (Section 3.1)** is the right approach — context injection + enforcement is better than either alone.
3. **Machine-verified evidence (Section 3.4)** is the most promising component — it addresses the mechanism directly (agents need ground truth, not just instructions to look for it).
4. **False positive testing (Section 6)** is good experimental discipline rarely seen in our designs.
5. **Cost estimate** is reasonable and well-scoped.

---

## Recommended Revision Path

1. **Fix KE references** (KE-094→KE-099, KE-095→KE-100) — immediate, mechanical fix
2. **Add EXP-104 confound discussion** — acknowledge the baseline issue, revise effect size claims to "suggestive but confounded"
3. **Add EXP-108 Phase 2 discussion** — explicitly address why framing-alone might fail, predict Arm A null
4. **Redesign baseline arm** — fresh runs with skill state documented
5. **Consider skill-absent condition** — if possible, test with skill temporarily removed to get a clean signal
6. **Tighten H2 criteria** — 20% duration overhead cap, not 50%
7. **Increase N or acknowledge power limitation** — N=9 minimum, or label as pilot
8. **Mark production sections as contingent** — Sections 5 and 7 are Phase 3 planning, contingent on Phase 2 success

If these revisions are made, the experiment becomes well-grounded and worth running. The core idea — structural enforcement of inherited-work verification — is sound. The execution just needs to be honest about what we actually know and don't know from prior experiments.

---

## Bottom Line

**The most promising component of EXP-116 is the machine-verified evidence injection + beforeToolCall guard (Arm D)**, not the adversarial framing alone. EXP-108's null result strongly suggests framing alone won't work. The guard enforcement (structural intervention) is the active ingredient. I'd recommend either:

(a) Simplify to a 3-arm test: baseline vs machine-evidence-only vs evidence+guard, dropping the framing-only arm as a predicted null (or keeping it as a negative control).

(b) Run as designed but with explicit predictions that Arm A ≈ baseline (replicating EXP-108's null) and Arm D is the real treatment.

Either way, fix the confound acknowledgment and KE references before proceeding.
