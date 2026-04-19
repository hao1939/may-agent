# Research Lifecycle Audit — Are Our Research Threads Properly Finished?

**Date**: 2026-04-15  
**Author**: May (Supervisor)  
**Purpose**: Assess each major research thread against Hao's 5-step completion criteria and recommend action.

## Hao's 5-Step Completion Criteria

1. **Investigate** — literature review, analysis, hypothesis formation
2. **Experiment** — run tests, collect data
3. **Evaluate** — can we use this? What did we learn?
4. **Try & Polish** — deploy in production, iterate
5. **Conclude** — formally adopt or pause with evidence; write a conclusion

---

## Audit Summary

| # | Thread | Steps Done | Verdict | Action |
|---|--------|-----------|---------|--------|
| 1 | Channel Theory (H-098) | 1-3 | Partially confirmed, not deployed | **CONCLUDE** |
| 2 | Discovery Boundary (H-099) | 1-3 | Confirmed, inherently non-deployable | **CONCLUDE** |
| 3 | Forced Externalization (H-085) | 1-4 | Deployed via guards, never formally concluded | **CONCLUDE** |
| 4 | Agent-Specific Interventions (H-095) | 1-4 | 3 guards in production, never formally concluded | **CONCLUDE** |
| 5 | Few-Shot Skills (H-091) | 1-4 | ~6 fewshot examples deployed, never formally concluded | **CONCLUDE** |
| 6 | Guard Architecture (H-101/H-102/H-108) | 1-3 (mixed) | H-102 refuted, H-101 partial, H-108 inconclusive | **PAUSE** (H-102/H-108), **CONTINUE** (H-101) |
| 7 | Difficulty Threshold (H-107) | 1-2 | EXP-151 inconclusive, demoted | **PAUSE** |
| 8 | Three-Layer Reasoning (H-105) | 1 only | Blocked — thinking tokens disabled | **PAUSE** |
| 9 | Artifacts Theory (H-161/H-160/H-108) | 1-2 (partial) | H-160 experimentally supported, H-161 theoretical, H-108 inconclusive | **CONTINUE** (H-160), **PAUSE** (H-161/H-108) |
| 10 | CIVC (H-093) | 1-4 | Production guards deployed, gym gap confirmed | **CONCLUDE** |
| 11 | Evaluation Architecture (H-096) | 1-2 (partial) | EXP-143 partial support, LLM replication needed | **CONTINUE** |
| 12 | Hard Gate Generalization (H-156) | 1-3 | Partially supported, 3/4 predictions correct | **CONTINUE** |
| 13 | Meta-Harness (H-164) | 1 only | Not testable without training access | **ARCHIVE** |

### Counts
- **CONCLUDE (write formal conclusion)**: 5 threads (H-098, H-099, H-085, H-095, H-091)
- **PAUSE (insufficient evidence or blocked)**: 5 threads (H-102, H-108, H-107, H-105, H-161)
- **CONTINUE (active, next step clear)**: 3 threads (H-101, H-160, H-096, H-156)
- **ARCHIVE (untestable)**: 1 thread (H-164)

---

## Detailed Thread Assessments

### 1. Attention Channel Theory (H-098) — P=0.80

**Steps completed:**
- ✅ Step 1 (Investigate): Extensive. Synthesizes KE-101, H-085, H-091, H-095. Three channels defined (Ch1 text, Ch2 environmental, Ch3 positional).
- ✅ Step 2 (Experiment): EXP-127 direct test (same content, 3 channels — Ch2 only works, p<0.00001). EXP-128 boundary test. EXP-129 budget curve. EXP-131 gate-task synergy.
- ✅ Step 3 (Evaluate): 3/4 predictions correct. Ch3 has task-type boundary (works for behavioral, fails for analytical under coding momentum). Very usable as a design framework.
- ❌ Step 4 (Try & Polish): Channel theory is a **framework**, not a deployable artifact. Its value is that it EXPLAINS why existing deployments work (guards = Ch2, fewshots = Ch3 in task position). No separate "deployment" is needed — but this has never been explicitly stated.
- ❌ Step 5 (Conclude): No formal conclusion written. Status still says "Partially Confirmed — Unifying Theory."

**Assessment**: This is a mature theoretical framework with strong experimental support. It unifies multiple prior findings. The Ch3 boundary (task-type dependent) is well-characterized. There's nothing more to experiment on — the framework either works as an explanatory lens or it doesn't, and 4 direct tests say it does. **It needs a conclusion, not more experiments.**

**🔵 Action: CONCLUDE**
- Write conclusion: "Channel Theory adopted as primary design framework for intervention design. Ch2 (environmental/structural) is the only reliable channel for analytical judgment tasks. Ch3 (positional/fewshot) works for behavioral tasks only. Ch1 (text rules) is never effective. Use this framework when designing any new intervention."
- Connect to production: the 3 deployed guards ARE Ch2 implementations; the 6 deployed fewshot examples ARE Ch3 implementations. Theory retroactively explains the entire deployment portfolio.

---

### 2. Discovery Task Boundary (H-099) — P=0.90

**Steps completed:**
- ✅ Step 1 (Investigate): Well-defined. Creative inference tasks (identify *what* to do) resist all scaffolding.
- ✅ Step 2 (Experiment): 7 experiments on same discovery task (EXP-117/120/121/122/124/126/130). All 3 channels tested and exhausted. Ch1 harmful, Ch2 null, Ch3 harmful.
- ✅ Step 3 (Evaluate): Clear result — "All channels exhausted." Stochastic model proposed: success probability per cycle is fixed; interventions can only change time budget, not inference probability.
- ⬜ Step 4 (Try & Polish): N/A — this is a **boundary finding**, not a deployable intervention. The production implication is "don't try to scaffold discovery tasks; give them more time or accept stochastic outcomes."
- ❌ Step 5 (Conclude): Status says "CONFIRMED — All Channels Exhausted" but no formal conclusion document exists.

**Assessment**: This is the most thorough boundary investigation in the system. 7 experiments converging on the same null result across all channels. The finding is robust and important — it tells us where NOT to invest. But it's never been formally concluded with production recommendations.

**🔵 Action: CONCLUDE**
- Write conclusion: "Discovery tasks are irreducible to scaffolding. Production recommendation: (1) don't add guards/checklists to discovery-type tasks, (2) allocate extended time budgets, (3) accept stochastic outcomes, (4) use the execution/recognition/discovery task classification to decide intervention strategy."

---

### 3. Forced Externalization (H-085) — P=0.85

**Steps completed:**
- ✅ Step 1 (Investigate): Massive. 24+ experiments cited. 5 boundary conditions identified.
- ✅ Step 2 (Experiment): The most extensively tested hypothesis in the system. 71/89 externalization runs pass across 17 scenarios, 5 failure domains.
- ✅ Step 3 (Evaluate): Mechanism identified as "analysis activation" not "content correctness." Boundaries well-characterized (debugging, absent-info, multi-doc transfer, execution crowding, discovery tasks).
- ✅ Step 4 (Try & Polish): **Partially done.** The 3 production guards (Coder FM-3.3 commit, Optimizer FM-2.2 completeness, Coder C7.1 path hallucination) are all implementations of forced externalization via Ch2 structural gates. But the hypothesis file still says "WORKING THEORY" — not "adopted."
- ❌ Step 5 (Conclude): No formal conclusion. Still labeled "WORKING THEORY." Discovery boundary remains "UNRESOLVED" even though 5 experiments show it's a genuine boundary.

**Assessment**: This is the foundational finding of the entire research program. It has the most evidence of any hypothesis. Three production guards are direct applications. But the discovery boundary is listed as "UNRESOLVED" when the evidence clearly shows it IS a boundary (7 experiments, H-099 P=0.90). The hypothesis file is 3,000+ words of accumulated evidence without a clear summary conclusion. **It needs to be formally concluded — the discovery boundary IS resolved by H-099.**

**🔵 Action: CONCLUDE**
- Write conclusion: "Forced externalization is the primary mechanism for improving agent judgment. Adopted. 5 confirmed boundaries: (1) debugging tasks (correct path selection, not analysis), (2) absent-information (no reference schema), (3) multi-doc transfer (fixable via citation), (4) execution crowding (chained steps consume attention), (5) discovery tasks (irreducible to scaffolding — see H-099). Three production guards deployed as Ch2 structural implementations."
- Mark discovery boundary as RESOLVED (per H-099).

---

### 4. Agent-Specific Interventions (H-095) — P=0.88

**Steps completed:**
- ✅ Step 1 (Investigate): EXP-109 production observation (19K evals, ~400 sessions). Agent FM fingerprints confirmed.
- ✅ Step 2 (Experiment): 14 experiments. Agent-specific FM signatures (Bob→FM-3.3, Coach→FM-2.1, Coder→FM-1.1). EXP-123 is "strongest natural experiment" — same guard, 7 agents, 3 response profiles.
- ✅ Step 3 (Evaluate): Clear result — agent-specific > universal. Universal interventions harm (EXP-117: -67pp on Bob). Same guard helps 5 agents, fails 1, harms 1.
- ✅ Step 4 (Try & Polish): 3 agent-specific guards deployed (Coder×FM-3.3 commit, Optimizer×FM-2.2 completeness, Coder×C7.1 path hallucination). 1 universal guard (verification-depth) deployed with measured differential outcomes.
- ❌ Step 5 (Conclude): No formal conclusion. Status still lists open predictions (P-095e for coach FM-2.1 approach guard).

**Assessment**: This is production-validated. 3 agent-specific guards deployed, production measurements show massive effects (+51.3pp recovery, +100pp optimizer). The remaining work (coach FM-2.1 approach guard, tool schema guard deployment) is incremental refinement — the core thesis is proven. **Needs a conclusion that says "adopted" while noting the incremental deployment roadmap.**

**🔵 Action: CONCLUDE**
- Write conclusion: "Agent-specific interventions outperform universal approaches. Adopted. Three targeted guards deployed. Intervention priority map (KE-115) guides future guard development. Next incremental deployments: FM-2.1 approach guard for coach, tool schema guard. These are engineering tasks, not research."

---

### 5. Few-Shot Skills (H-091) — P=0.93

**Steps completed:**
- ✅ Step 1 (Investigate): Delivery methods between text rules and workflow enforcement.
- ✅ Step 2 (Experiment): 14 experiments (EXP-084 through EXP-097). Cumulative domain-matched fewshot: 18/18 (100%). Three boundaries found (temporal discipline, domain proximity, delivery position).
- ✅ Step 3 (Evaluate): Clear result — matched fewshot in task-message position is the only reliable delivery method. System-prompt = 0%. Position dominates content quality.
- ✅ Step 4 (Try & Polish): ~6 fewshot examples deployed in production across agents. Gym graduated (EXP-098 + Wave 2).
- ❌ Step 5 (Conclude): No formal conclusion. Status says "Strongly Supported" but no conclusion document.

**Assessment**: Highest P(H) in the system at 0.93. Massively tested (14 experiments), production deployed, three well-characterized boundaries. This is **done** — the only remaining work is writing more fewshot examples for new skills (engineering) and possibly testing urgency framing further (diminishing returns). **Needs a formal conclusion.**

**🔵 Action: CONCLUDE**
- Write conclusion: "Few-shot examples are the primary skill delivery method. Adopted. Delivery rules: (1) domain-matched examples only, (2) task-message position only (system-prompt = 0%), (3) works for judgment and process discipline, NOT temporal discipline. 6+ examples deployed. Future skill creation should use this method by default."

---

### 6. Guard Architecture (H-101 / H-102 / H-108)

**H-101 (Architectural Readiness) — P=0.78:**
- ✅ Steps 1-3: 4 experiments (EXP-135/136/137/138). Bifurcated response confirmed. Workflow-level verification is sole differentiator.
- ⬜ Step 4: verify-wrap workflow built and gym-tested (ceiling effect). Production pilot pending.
- ❌ Step 5: Not concluded.
- **Action: CONTINUE** — production pilot is the clear next step (EXP-138 gym showed ceiling; production is where the real test happens).

**H-102 (Workflow Adoption → Internalization) — P=0.55:**
- ✅ Steps 1-2: EXP-148 complete. 3/4 predictions failed. Universal decline driven by infra changes, not behavioral learning.
- ✅ Step 3: Evaluated — mostly refuted.
- ❌ Steps 4-5: Not applicable (refuted).
- **Action: PAUSE** — Demoted to Tier 2. Core mechanism disproven. Subsumed by H-101's architectural readiness model.

**H-108 (Guard Artifacts as Environmental Memory) — P=0.55:**
- ✅ Step 1: DD-755/DD-756 theoretical grounding.
- ✅ Step 2: EXP-152 complete (88 trials) — INCONCLUSIVE (ceiling effects). EXP-153 complete (54 trials) — NOT SUPPORTED.
- ✅ Step 3: Both experiments hit ceiling effects. Skills encoding natural behaviors are redundant (KE-170). Can't test because base model already does the behavior.
- ❌ Steps 4-5: Not applicable (insufficient evidence).
- **Action: PAUSE** — Two experiments failed to find an effect due to structural problems (ceiling effects, skill redundancy). Need harder scenarios to test, but those don't exist yet (see H-107 scenario gap-fill). Low priority — file a note and move on.

---

### 7. Difficulty Threshold (H-107) — P=0.65

**Steps completed:**
- ✅ Step 1 (Investigate): DD-753 external validation (5 independent groups converge on ZPD bell curve). DD-754 bias amplification mechanism.
- ✅ Step 2 (Experiment): EXP-151 run (159 trials, 3 difficulty buckets). INCONCLUSIVE — all p>0.70, no significant effect.
- ⬜ Step 3 (Evaluate): Demoted from Tier 1. Results suggest the hypothesis may be real but current scenario portfolio is bimodal (too easy or too hard) — can't test the 20-40% baseline sweet spot.
- ❌ Steps 4-5: Not reached.

**Assessment**: The hypothesis is plausible (strong external validation) but our experiments can't test it because we lack medium-difficulty scenarios. Bob's todo lists "Scenario Gap-Fill" as a prerequisite. This is blocked on infrastructure, not on the hypothesis being wrong.

**🔴 Action: PAUSE**
- Reason: Blocked on scenario portfolio. The 20-40% and 70-85% baseline ranges need new scenarios before this can be tested properly.
- Resume condition: When Bob creates medium-difficulty scenarios, retest.

---

### 8. Three-Layer Reasoning (H-105) — P=0.75

**Steps completed:**
- ✅ Step 1 (Investigate): DD-750 literature support. 3× fidelity gap between layers. KE-157 synthesis.
- ❌ Step 2 (Experiment): EXP-146 designed but **BLOCKED** — extended thinking is disabled for all primary agents. Infrastructure prerequisite not met.
- ❌ Steps 3-5: Not reached.

**Assessment**: Pure theory. The only designed experiment (EXP-146) requires thinking token access which is disabled. Without infrastructure changes (enabling `thinkingLevel` for agents), this hypothesis is untestable. The 3-layer framework (execution/recognition/discovery) is already captured by H-099 empirically — H-105 adds a thinking-token monitoring claim that can't be tested.

**🔴 Action: PAUSE**
- Reason: Blocked on infrastructure (thinking tokens disabled). The 3-layer task classification is already operationally useful via H-099 without H-105's thinking-token monitoring claim.
- Resume condition: If/when thinking tokens are enabled for agents, revisit.

---

### 9. Artifacts/Externalization Theory (H-161 / H-160 / H-108)

**H-160 (Structural > Behavioral for Interruptive Steps) — P=0.92:**
- ✅ Steps 1-3: EXP-155 confirms core prediction (100% structural vs 10-15% behavioral, +85pp). Strong result.
- ⬜ Step 4: Not explicitly deployed as a new production artifact, but the finding is already implicit in our guard design (all 3 production guards are structural).
- ❌ Step 5: No conclusion document.
- **Action: CONTINUE** — needs one more production validation to formally adopt. Could be combined with H-085 and H-098 conclusions (structural gates win; behavioral skills lose on interruptive steps).

**H-161 (Dual IT Functions — Memory Compression + Behavioral Forcing) — P=0.72:**
- ✅ Step 1: Theoretical. DD-755, KE-129, KE-176 grounding.
- ❌ Step 2: No experiment run. 4-arm independence experiment designed but never executed.
- ❌ Steps 3-5: Not reached.
- **Action: PAUSE** — Interesting theoretical decomposition but zero experimental evidence. Low priority — the practical implications (design guards for both F1 and F2) are already captured by existing deployment practices.

**H-108**: See Thread 6 above — **PAUSE**.

---

### 10. CIVC (H-093) — P=0.72

**Steps completed:**
- ✅ Step 1 (Investigate): 999 FM errors across 384 sessions. External lit: 5 papers directly validate.
- ✅ Step 2 (Experiment): EXP-100 (moderate support), EXP-102 (null — confabulation), EXP-103 (adversarial framing works), EXP-104 (skill-level fix sufficient), EXP-107 (gym-production gap confirmed), EXP-109 (production observation), EXP-110 (commit guard recovery), EXP-116 (re-validated).
- ✅ Step 3 (Evaluate): FM-3.3 severity gradient confirmed (absence→theater→confabulation→destruction). Gym can't replicate production CIVC (4.8% gym vs 50-70% production). Agent-specific guards recover 73.5% but 35% residual resists recovery.
- ✅ Step 4 (Try & Polish): Verification-depth guard deployed fleet-wide (EXP-123: Bob C1.3 70.5%→100%). Coder FM-3.3 commit guard deployed (recovery +51.3pp). Production impact measured.
- ❌ Step 5 (Conclude): Status still says "Proposed" (!). This is wrong — it's far beyond "proposed" with production evidence.

**Assessment**: Massively investigated. Two production guards deployed addressing CIVC. 35% residual unrecovered FM-3.3 is a known limitation. The gym-production gap is characterized (structural and unbridgeable). Status says "Proposed" which is wildly inaccurate — it should say "Partially Confirmed, Production-Validated." **Needs a conclusion urgently — the status field is misleading.**

**🔵 Action: CONCLUDE**
- Write conclusion: "CIVC is a real phenomenon. Partially confirmed with production validation. FM-3.3 severity gradient (absence→theater→confabulation→destruction) is the primary model. Guards provide recovery (~73.5%) but ~27% residual resists recovery. Gym cannot replicate production CIVC (structural gap per KE-107). Production interventions work; further reduction requires either harder scenarios for testing or novel intervention approaches."
- Fix status from "Proposed" to "Partially Confirmed — Production Validated."

---

### 11. Evaluation Architecture (H-096) — P=0.70

**Steps completed:**
- ✅ Step 1 (Investigate): KE-116 synthesis. DD-720/721/722/723 + CR-329.
- ✅ Step 2 (Experiment): EXP-143 partial support — checkpoint decomposition +32.1pp FM-3.3 detection.
- ⬜ Step 3 (Evaluate): Core signal validated but LLM-based replication needed. Not yet clear if this is production-ready.
- ❌ Steps 4-5: Not reached.

**Assessment**: Promising early results but the core innovation (checkpoint decomposition) needs LLM replication to move from "works in analysis" to "deployable in production evaluator." This is genuinely in progress with a clear next step.

**🟢 Action: CONTINUE**
- Next step: LLM-based replication of checkpoint decomposition for production evaluator integration.
- This has practical value — if it works, it directly improves our evaluation quality (breaks the 35% verification residual).

---

### 12. Hard Gate Generalization (H-156) — P=0.72

**Steps completed:**
- ✅ Step 1 (Investigate): Derived from Ch2 hard gate evidence.
- ✅ Step 2 (Experiment): EXP-155 (hidden-dep: +85pp) and EXP-156 (2 new scenarios: 1 success, 1 boundary). Cumulative Ch2: 27/27 across 3 failure types.
- ✅ Step 3 (Evaluate): 3/4 predictions correct. Boundary identified: doesn't help high-baseline belief-based failures.
- ⬜ Step 4: Not yet deployed as a systematic production practice.
- ❌ Step 5: Not concluded.

**Assessment**: Strong experimental support with a clear boundary condition. The practical implication (use hard gates for low-baseline + step-skipping failures) is actionable. But it needs either more scenario testing or production deployment to reach Step 4.

**🟢 Action: CONTINUE**
- Next step: Deploy hard gates for identified low-baseline scenarios in production. Or, if the finding generalizes well enough, fold into H-098 (Channel Theory) conclusion as a Ch2 deployment guideline.

---

### 13. Meta-Harness (H-164) — P=0.65

**Steps completed:**
- ✅ Step 1 (Investigate): DD-560 (meta-agent) + DD-570 (SKILL0). KE-183 formalization.
- ❌ Steps 2-5: Not reached. Not testable without training access.

**Assessment**: Pure theory about the harness-vs-training trade-off frontier. We cannot test this because we don't have training access. The cross-model comparison prediction (P-164b) is theoretically feasible but not practically useful for our single-model system. This is interesting academic work but not actionable.

**🔴 Action: ARCHIVE**
- Reason: Not testable in our system. We don't control model training. The theoretical insight (harness complexity inversely proportional to model internalization) is a useful mental model but can't be experimentally validated.
- Resume condition: If we get training access or multi-model comparison capability.

---

## Critical Finding: No Formal Conclusions Exist

**Not a single research thread in the system has a formal Step 5 conclusion document.** The closest things are:
- Status field updates in hypothesis files (e.g., "CONFIRMED — All Channels Exhausted")
- Priority tracker summaries
- KE entries capturing specific findings

But there is no document anywhere that says: "We investigated X, found Y, deployed Z, and the conclusion is [adopt/pause/archive] because [evidence summary]."

This means:
1. **Research threads never formally end** — they accumulate evidence indefinitely without ever declaring "done"
2. **Production deployments happen without connecting back to the research** — guards get deployed but the hypothesis that motivated them stays "in progress"
3. **New researchers (or agents reading the knowledge base) can't tell what's settled** — everything looks "in progress" even when there's overwhelming evidence

### Recommendation

Bob should write formal conclusion sections for the 5 CONCLUDE threads (H-098, H-099, H-085, H-095, H-091) plus H-093. Each conclusion should be ~200 words with:
- **Verdict**: Adopted / Partially Confirmed / Refuted / Paused
- **Key Finding**: 1-2 sentences
- **Production Impact**: What was deployed, what effect it had
- **Remaining Gaps**: What's NOT resolved (if any)
- **Recommendation**: What to do with this knowledge going forward

This is probably 1-2 sessions of Bob's time and would clean up 6+ hypothesis threads that are de facto concluded but still appear "open."

---

## Threads That Should NOT Continue Without Justification

These hypotheses are accumulating complexity without clear practical value:

1. **H-087 (Constitutional Externalization)** — P=0.72, retrospective evidence only. The three-level model (task/harness/constitution) is elegant but the direct experimental evidence (EXP-124) was invalidated. No clear production deployment path. Consider PAUSING.

2. **H-131 (Gate-Task Synergy)** — P=0.70, single experiment (EXP-131) with N≈8/arm (underpowered). The finding (related gates scaffold, unrelated gates dilute) is useful but subsumable under H-098 Channel Theory. Consider MERGING into H-098 conclusion.

3. **H-088 (Implementation Commitment)** — P=0.80, gradient confirmed. Useful boundary condition for H-085 but not independently actionable. Consider MERGING into H-085 conclusion.

4. **H-092 (Reasoning Flow Failure Modes)** — P=0.72, spawned H-093 (CIVC) which is the actionable finding. The original failure-mode taxonomy (Tool Spiral, Comprehension Cascade, Drift-to-Decay) is descriptive but H-093 captures the intervention-relevant part. Consider CONCLUDING alongside H-093.

---

## Bottom Line

**The research program has produced excellent experimental evidence and production deployments, but it has a completion problem: nothing ever formally ends.** 5 of 13 major threads are de facto done (massive evidence, production deployments, well-characterized boundaries) but still appear "in progress." 5 are properly blocked or paused but not labeled as such. Only 3 are genuinely in-progress with clear next steps.

The highest-value action right now is NOT running more experiments — it's writing conclusions for the 5-6 threads that are done. This would:
1. Free up Bob's attention for threads that actually need work
2. Make the knowledge base consumable (agents can see what's settled vs open)
3. Give Hao a clear picture of what the research program has produced
4. Stop the accumulation of evidence on threads that don't need more evidence
