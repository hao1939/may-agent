# KE-111: Production Evaluation Architecture — From Gym Termination to Observational Science

**Created**: 2026-04-10 (Bob, Session ~420)  
**Status**: ACTIVE  
**Confidence**: ★★★★★  
**Sources**: DD-713 (★★★★★), DD-714 (★★★★★), DD-715 (★★★★★), DD-716 (★★★★½), CR-327 (★★★★★)  
**Builds on**: KE-109 (gym-production gap), KE-110 (gym termination), KE-104 (verification architecture), KE-105 (orchestration stack)

---

## Summary

Four production-first evaluation papers (DD-713 through DD-716) and their synthesis (CR-327) provide the complete theoretical and methodological foundation for the post-gym-graduation pivot. Production evaluation is not a fallback from gym saturation — it is the **correct methodology** for externalized agent systems where capability lives in infrastructure (harness), not model weights. A 5-layer production evaluation architecture maps directly onto our existing verification stack (KE-104/KE-105) and extends it with trajectory capture, longitudinal analysis, and comparative benchmarking.

---

## Question 1: What Production Evaluation Capabilities Does Our Gym Lack?

| Capability | Paper | What It Provides | Gym Status |
|-----------|-------|-----------------|------------|
| Multi-dimensional scoring | DD-713 | 4-pillar assessment (LLM/Memory/Tool/Environment) | ❌ Binary pass/fail only |
| Trajectory-aware grading | DD-714 | Process evaluation catches 44% more safety issues | ❌ Final-output checking only |
| Reliability measurement | DD-714 | Pass^k (worst of k) vs Pass@k (best of k) | ❌ Single-trial only |
| Longitudinal analysis | DD-715 | 23-day behavioral trend tracking | ❌ Isolated scenarios |
| Emergent behavior detection | DD-715 | Self-diagnosis, failure taxonomy creation | ❌ Cannot test emergence |
| Full-harness testing | DD-716 | Tests memory + skills + protocols + harness together | ❌ Model + minimal harness |
| Non-determinism quantification | DD-713 | Behavioral distribution tracking | ❌ Point outcomes only |

**Key insight**: Our gym tests the model with a minimal harness. Production tests the full externalized cognitive system. The 10-14× FM-3.3 gap (KE-107) is not about task difficulty — it's about **infrastructure completeness**. Gym evaluation systematically under-tests the system we actually deploy.

---

## Question 2: How Does CR-327's 5-Layer Stack Map to Our Verification Architecture?

| CR-327 Layer | Function | Maps to (Our Architecture) | Status |
|-------------|----------|---------------------------|--------|
| L1: Trajectory Capture | Record all agent actions via triple evidence channels | KE-104 M1 (evidence grounding) + activity.jsonl | **Partial** — have logs, lack environment snapshots |
| L2: Multi-Dimensional Scoring | Evaluate Completion/Safety/Robustness/Harness utilization | KE-104 UVA tiers + KE-105 L3 budget allocation | **Partial** — have completion scoring, lack safety/robustness dimensions |
| L3: Behavioral Pattern Detection | Identify production failure patterns in trajectories | KE-108 step-level credit + CR-320 behavioral failure stack | **Theory only** — no automated production trajectory analysis |
| L4: Longitudinal Analysis | Track behavioral trends across sessions over time | No equivalent | **Gap** — need session-over-session behavioral dashboards |
| L5: Comparative Benchmarking | Compare production vs gym baselines, quantify gap | KE-109 5-dimension gap model | **Informal** — we note 10-14× discrepancy but don't systematically measure |

**Architecture extension path**: KE-104 (what to verify) + KE-105 (how to orchestrate) + **KE-111** (where to observe) = complete verification-to-production pipeline. Layers 1-3 extend existing infrastructure; Layers 4-5 are genuinely new capabilities.

---

## Question 3: Concrete Next Steps for Path A (Production Observation)

### EXP-109 Design: Production Observation Study
1. **Sample**: 50 production sessions (stratified by agent, task type, session length)
2. **Scoring protocol**: Apply DD-714's three-dimension scoring (Completion + Safety + Robustness) to each session's full trajectory
3. **Metrics**: 
   - Pass^3 reliability estimate (from sessions with similar tasks)
   - Multi-dimensional scores per DD-713's 4 pillars
   - Behavioral pattern clustering per CR-327 Layer 3
4. **Environment capture**: Snapshot file system state before/after each session (Layer 1 gap)
5. **Expected finding**: 30-50% of "successful" sessions have process quality issues invisible to pass/fail (P-327a)

### Infrastructure Changes
- **Immediate**: Add environment snapshot capture (pre/post session file state)
- **Near-term**: Build behavioral dashboards tracking skill application rates, guard trigger rates, verification thoroughness trends per session
- **Medium-term**: Implement trajectory rubric scoring as automated production metric
- **Long-term**: A/B protocol for gym-vs-production comparison on matched tasks

---

## The Externalization Thesis (from DD-716)

The deepest insight from this cluster: **capability migration from weights → context → harness** explains our entire architectural evolution:

- **Early sessions** (Days 1-10): Relied on prompting and context injection
- **Middle period** (Days 10-20): Added skills and guards (externalized expertise and constraints)
- **Current** (Days 20+): Full harness with memory, skills, protocols, federation

DD-716's framework (21 authors, 54 pages) provides theoretical grounding from cognitive science: infrastructure matters because it **transforms hard cognitive burdens into forms the model can solve more reliably**. This is KE-101 Law 1 ("structure > content") stated as a general principle.

**Implication for evaluation**: If capability lives in the harness, evaluation must test the harness. Gym tests a subset → gym metrics are structurally misleading. This isn't a calibration problem; it's a category error.

---

## Springdrift Validation (from DD-715)

Springdrift (23-day persistent agent deployment) validates our methodology:
- Single-instance, single-operator → exactly our situation
- Presents observational analysis as legitimate research → our 400+ sessions are publishable data
- "Artificial Retainer" concept → describes what our agents are
- Emergent behaviors (self-diagnosis, failure taxonomy) → suggests we should look for similar production-specific behaviors

**Our dataset** (400+ sessions, 100+ experiments, 700+ deep dives, 320+ cross-references) exceeds Springdrift by ~20× in scale. If their 23-day observation is a research contribution, our dataset is a major production agent study.

---

## Predictions

- **P-111a**: Trajectory-aware grading of 50 production sessions will reveal ≥30% have process quality issues invisible to current pass/fail evaluation (testable: EXP-109)
- **P-111b**: Production behavioral patterns will cluster into 3-5 distinct archetypes distinguishable from gym patterns (testable: k-means on production trajectory features)
- **P-111c**: Pass^3 reliability metric will show ≥20% lower scores than Pass@3 for production tasks (testable: 3 trials × 20 tasks)
- **P-111d**: Adding environment snapshot capture will identify ≥2 new failure modes invisible to current logging (testable: 30-day capture period)

---

## Cross-References

| Entry | Connection |
|-------|-----------|
| KE-109 | Gym-production gap is structural; KE-111 provides the production-side evaluation architecture |
| KE-110 | Gym termination is the trigger; KE-111 is the response — what comes after gym graduation |
| KE-104 | Verification evidence grounding; KE-111 L1-L2 extend this to production context |
| KE-105 | Verification orchestration; KE-111 adds production-specific layers (L4 longitudinal, L5 comparative) |
| KE-106 | Guards as permanent infrastructure; DD-716 confirms externalization is permanent, not transitional |
| KE-101 | Law 1 validated by DD-716 externalization thesis; Law 2 validated by DD-714 trajectory findings |
| CR-326 | 5-dimension gap model; CR-327 provides the evaluation architecture to measure across all 5 |
| DD-713 | 4-pillar production assessment → Layer 2 multi-dimensional scoring |
| DD-714 | Trajectory-aware grading, Pass^k → Layers 1-2 methodology |
| DD-715 | Springdrift 23-day deployment → validates observational methodology (Layer 4) |
| DD-716 | Externalization framework → theoretical foundation for entire architecture |
