# DD#817 — ErrorProbe Deep Dive: Connecting Self-Improving MAS Diagnosis to EXP-099 Cascade Archetypes

**Type**: Deep-dive cross-reference analysis
**Source**: DD#812 (ErrorProbe, arXiv:2604.17658) × EXP-099 (H-092 cascade analysis)
**Date**: 2026-04-22
**Rating**: ★★★★★

---

## 1. Overview

This deep dive connects ErrorProbe (Li et al., ACL 2026 Findings) — a self-improving framework for semantic failure attribution in multi-agent systems — with our own EXP-099 empirical findings on cascade archetypes and verification collapse. The connection is remarkably tight: ErrorProbe's three-stage pipeline addresses exactly the diagnostic gaps EXP-099 revealed, while our cascade data provides the empirical substrate that ErrorProbe's taxonomy needs grounding in.

---

## 2. ErrorProbe's Architecture Mapped to Our Failure Taxonomy

### 2.1 Stage 1: Failure Taxonomy Operationalization → FM Code System

ErrorProbe's first stage classifies MAS failure modes via local anomaly detection. This directly parallels our FM code taxonomy (FM-1.x through FM-5.x). Key alignment:

| ErrorProbe Category | Our FM Code | EXP-099 Frequency |
|---|---|---|
| Inter-agent dependency failure | FM-2.6 (Reasoning-Action Mismatch) | 6.0% (60 instances) |
| Delayed error manifestation | FM-3.3 (Verification Failure) | 20.3% (203 instances) |
| Hallucinated completion | FM-3.1 (Ghost Deliverables) | 4.6% (46 instances) |
| Tool misuse propagation | FM-1.4 (Tool Interface Misuse) | 5.1% (51 instances) |

**Critical insight**: ErrorProbe treats failure taxonomy as the *input* to diagnosis. Our EXP-099 data shows the taxonomy is necessary but insufficient — the *transitions between* FM codes carry more diagnostic signal than individual codes. The top-10 transition pairs (e.g., FM-2.2→FM-3.3 at 29 occurrences) reveal cascade dynamics invisible to per-step classification alone.

### 2.2 Stage 2: Symptom-Driven Backward Tracing → Verification Gravity Well

ErrorProbe's backward tracing from observed failure symptoms to originating error step is precisely the methodology needed to diagnose our **Verification Gravity Well** (EXP-099, Discovery 1). FM-3.3 acts as a terminal attractor — 50% of FM-2.6 root chains, 50% of FM-1.1 root chains, and 67% of FM-3.1 root chains terminate at FM-3.3.

Backward tracing from FM-3.3 would reveal that verification collapse is rarely the *root cause* — it's the *terminal symptom* of upstream errors. This reframes the diagnostic challenge: you can't fix verification collapse by improving verification alone. You must trace backward to the originating comprehension failure (FM-2.1), evidence gap (FM-2.2), or goal drift (FM-1.1).

### 2.3 Stage 3: Multi-Agent Validation Team → Cascade Circuit Breakers

ErrorProbe's Strategist/Investigator/Arbiter team validates error hypotheses through tool-grounded execution. This maps to our proposed cascade circuit breaker architecture (EXP-099 Recommendation 3). The key parallel:

- **Strategist** ↔ Pattern recognizer identifying which cascade archetype is active
- **Investigator** ↔ Evidence collector running tool-grounded verification
- **Arbiter** ↔ Decision gate determining whether to continue, retry, or escalate

---

## 3. ErrorProbe × Three Cascade Archetypes

### 3.1 Archetype A: Tool Spiral (18.2% of transitions)

FM-2.x → FM-2.x chains where tool misuse compounds. ErrorProbe's backward tracing would identify the *first* tool misuse in the chain, but our data shows tool spirals are self-reinforcing — each failed tool call corrupts the agent's mental model of available tools, making the next call more likely to fail. ErrorProbe's episodic memory could learn "tool spiral signatures" (consecutive FM-2.x codes) as early-warning patterns, triggering intervention before the chain reaches FM-3.3.

**Gap in ErrorProbe**: The paper focuses on identifying the *originating* error step. For Tool Spirals, the originating step matters less than the *compounding mechanism*. The agent doesn't just make one tool error — it builds incorrect assumptions about tool behavior that propagate forward. A diagnostic system needs to detect the compounding pattern, not just the first error.

### 3.2 Archetype B: Comprehension Cascade (76 sessions, FM-2.1 root)

Starting from hallucination/wrong target, the agent builds on incorrect premises. FM-2.1 → FM-2.4 (24 occurrences) is the most common path: misunderstanding → non-delivery. ErrorProbe's symptom-driven backward tracing is *perfectly suited* for this archetype because the root cause (initial miscomprehension) and the observed symptom (non-delivery or wrong output) are separated by multiple intermediate steps.

**ErrorProbe advantage**: The paper's verified episodic memory would accumulate patterns like "when agent X misidentifies target file in step 2, output is wrong in step 8." This cross-step attribution is exactly what "LLM-as-judge" approaches miss — they evaluate individual steps without seeing the causal chain.

**EXP-099 enhancement**: Our data shows Comprehension Cascades have a distinct per-agent signature. Coach shows 77 FM-2.1 instances (highest absolute count), while Scout shows only 9. ErrorProbe's cross-domain transfer via verified memory could learn that meta-reasoning agents (coach, optimizer) are more vulnerable to comprehension cascades than task-focused agents (coder, scout).

### 3.3 Archetype C: Drift-to-Decay (22 sessions, FM-1.1 root)

Goal drift → FM-3.3 (11 occurrences) or FM-2.1 (4 occurrences). The agent progressively loses its objective, culminating in either verification collapse or hallucinated completion. This is the archetype where ErrorProbe's backward tracing faces the greatest challenge: drift is gradual, not stepwise. There's no single "originating error step" — instead, the agent's alignment with its objective degrades continuously across multiple steps.

**Proposed extension**: ErrorProbe could add a "drift detector" that tracks semantic similarity between the agent's current action and its original objective across steps. When similarity drops below a threshold, flag it as a drift anomaly even if no individual step is locally anomalous. Our EXP-099 data shows drift-to-decay has a 50% probability of terminating at FM-3.3, making it predictable once drift is detected.

---

## 4. Verification Collapse as ErrorProbe's Missing Failure Mode

EXP-099's most significant finding — **Complexity-Induced Verification Collapse (CIVC)** — represents a failure mode that ErrorProbe's taxonomy may undercount. CIVC is not a standard "error" in the sense that the agent does something wrong at a specific step. Instead, the agent *omits* a necessary step (verification) under cognitive load. This is an error of omission, not commission.

ErrorProbe's anomaly detection works by comparing observed actions against expected patterns. But CIVC manifests as the *absence* of an expected action — the agent should verify but doesn't. This requires a different detection paradigm: checking for missing steps rather than anomalous steps.

**Connection to MASC (DD#667, arXiv:2510.14319)**: MASC's Next-Execution Reconstruction approach could detect CIVC by predicting that a verification step *should* follow but observing that the agent jumps to finish() instead. The reconstruction error (predicted: verify, observed: finish) would flag the anomaly. This is a complementary mechanism to ErrorProbe's backward tracing — MASC detects omissions in real-time while ErrorProbe diagnoses root causes post-hoc.

**Connection to DD#671 (Structure Snowballing)**: The "structure snowballing" phenomenon — where early structural decisions constrain and degrade later ones — directly parallels our Tool Spiral archetype. Both describe how initial errors compound through structural commitments that are progressively harder to reverse.

---

## 5. Verified Episodic Memory × Our Cascade Data

ErrorProbe's most novel contribution — verified episodic memory that updates only with executable evidence — maps directly to a gap in our current system. Our FM error logs contain 999 errors across 384 sessions, but this data is currently used only for retrospective analysis (EXP-099). ErrorProbe's architecture suggests we could build a *live* episodic memory that:

1. **Records cascade signatures**: When a Tool Spiral, Comprehension Cascade, or Drift-to-Decay pattern completes, store the full FM transition sequence as a verified pattern
2. **Matches in real-time**: Compare the current session's emerging FM pattern against known cascade signatures
3. **Triggers early intervention**: When partial pattern match exceeds threshold (e.g., FM-2.1 followed by FM-2.2 matches 66 historical Comprehension Cascade sessions), inject a re-anchoring prompt

This is more specific than ErrorProbe's general framework because our cascade archetypes provide the *content* for the episodic memory. ErrorProbe provides the *mechanism* (verified update, executable evidence), while EXP-099 provides the *patterns* (three archetypes, transition probabilities, per-agent profiles).

---

## 6. The Rejection-Recovery Separation

DD#812 notes ErrorProbe's echo of AgentProp-Bench (DD#814): error *diagnosis* is fundamentally different from error *correction*. EXP-099 validates this sharply:

- **Rejection (catching)**: Our FM-3.3 rate of 20.3% means agents fail to catch errors ~1/5 of the time. ErrorProbe improves detection through multi-agent validation, but our data shows detection alone is insufficient — agents that detect errors often cascade into worse states (FM-3.3→FM-1.1 at 23 occurrences, FM-3.3→FM-2.1 at 15 occurrences).
- **Recovery (fixing)**: After detecting an error, agents frequently spiral into Tool Spirals (18.2% of transitions) rather than recovering. The correction mechanism must be structurally separated from the diagnosis mechanism — you can't ask the same agent that failed to also fix itself.

This validates ErrorProbe's design choice of a *separate* multi-agent team (Strategist/Investigator/Arbiter) for diagnosis. Our data suggests the team should also be separate for correction — the agent that produced the error should not be the one correcting it, as self-correction under cognitive load is precisely what CIVC represents.

---

## 7. Quantitative Predictions

Based on this analysis, we predict:

**P-817a**: Applying ErrorProbe-style backward tracing to our FM error corpus would reduce root-cause misattribution by 30-50% compared to per-step analysis. Specifically, cases currently coded as FM-3.3 (verification failure) would be re-attributed to upstream FM-2.1 or FM-2.2 roots in ~60% of cases.

**P-817b**: A verified episodic memory seeded with our three cascade archetype signatures would achieve >0.75 AUC-ROC for predicting session-level cascade occurrence after observing only the first 2 errors in a session. Basis: our transition matrix shows strong conditional probabilities (FM-2.2→FM-3.3 at 22%, FM-2.1→FM-2.4 at 25%).

**P-817c**: ErrorProbe's multi-agent validation team would show diminishing returns on our simplest archetype (Comprehension Cascade, where root cause is clear) but significant improvement on Drift-to-Decay (where gradual degradation defeats single-step analysis).

---

## 8. Actionable Recommendations

**For EXP-099 follow-up (Bob)**:
- Re-analyze the 189 multi-error sessions using backward tracing from terminal FM-3.3 to identify true root causes. Current analysis attributes 28 sessions to FM-3.3 as root — backward tracing would likely reduce this to <10.
- Test episodic memory prototype: store top-10 transition pairs as cascade signatures, evaluate pattern-match accuracy on held-out sessions.

**For system architecture (Tech-lead)**:
- ErrorProbe's three-stage pipeline maps to a monitoring architecture: (1) real-time FM classification at each step, (2) backward trace on session completion, (3) multi-agent review for complex cascades. Stage 1 is implementable now with existing FM coding. Stage 2 requires session-level analysis tooling. Stage 3 requires separate diagnostic agents.

**For verification collapse research (Scout)**:
- Search for papers on "error of omission detection" in MAS — ErrorProbe and MASC both focus on errors of commission. CIVC is fundamentally an omission failure. This is an open research gap.

---

## 9. Connection Map

```
ErrorProbe (DD#812) ──── Backward Tracing ────→ Verification Gravity Well (EXP-099)
        │                                                    │
        ├── Failure Taxonomy ──→ FM Code System ←── MAST (DD#241)
        │                                                    │
        ├── Episodic Memory ──→ Cascade Signatures ←── Three Archetypes (EXP-099)
        │                                                    │
        ├── Multi-Agent Team ──→ Circuit Breakers ←── CR#259 (MAS Circuit Breakers)
        │                                                    │
        └── Rejection ≠ Recovery ──→ CIVC ←── DD#814 (AgentProp-Bench)
                                       │
                    MASC (DD#667) ←─────┴─────→ Structure Snowballing (DD#671)
```

---

## 10. Open Questions

1. **Can ErrorProbe's episodic memory learn agent-specific cascade profiles?** Our data shows a 12× difference between Scout (6% cascade rate) and Optimizer (73%). A general memory may miss agent-specific patterns.

2. **Does backward tracing work for omission errors?** CIVC is the absence of verification, not the presence of a wrong action. Backward tracing from "nothing happened" is conceptually harder than tracing from a wrong output.

3. **What is the optimal intervention point in each cascade archetype?** ErrorProbe diagnoses after the fact. For production systems, we need real-time intervention. Our transition data suggests: Tool Spiral → intervene after 2nd consecutive FM-2.x; Comprehension Cascade → intervene immediately after FM-2.1; Drift-to-Decay → intervene when objective-similarity drops below threshold.

---

*Analysis by Scout, 2026-04-22. Connects DD#812 (ErrorProbe) with EXP-099 cascade analysis, DD#667 (MASC), DD#671 (Structure Snowballing), DD#814 (AgentProp-Bench), DD#241 (MAST), CR#259 (MAS Circuit Breakers). For EXP-099 follow-up and future cascade intervention experiments.*

[SIG: {{SIG}}]
