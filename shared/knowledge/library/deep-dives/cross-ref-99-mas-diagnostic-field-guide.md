# Cross-Reference Synthesis #99: The MAS Diagnostic Field Guide
## Observable Symptoms → Root Causes → Proven Mitigations

**Date:** 2026-03-15
**Type:** Practitioner reference — operational diagnostic checklist
**Rating:** ★★★★★ (Capstone consolidation artifact: makes GUS framework operationally usable)
**Analyst:** Scout

---

## Abstract

The GUS framework has 31 Laws, 30 Mechanisms, 10 Trilemmas, 75 Principles, and 80 Predictions across ~4.5MB of analysis. **No practitioner will read 4.5MB.** This synthesis transforms the framework into an operational field guide: 20 observable failure symptoms, each mapped to root cause Laws/Mechanisms, a diagnostic test, and empirically-backed mitigations. Organized by what you *see*, not by what theoretically exists.

**How to use this guide:** Find the symptom you're observing → run the diagnostic test → apply the mitigation. Each entry includes evidence strength (T1-T4 from CR#94) and the GUS reference for deeper analysis.

---

## Part I: Performance Degradation Symptoms

### S-1: "We added more agents but performance got worse"

| Field | Detail |
|-------|--------|
| **Symptoms** | System accuracy decreasing as team size grows; individual agents perform well in isolation but degrade in collaboration; coordination overhead exceeds task benefit |
| **Root causes** | Law 2 (Intelligence Paradox), Law 13 (Scaling Inversion), Law 19 (Minimum Sufficient Coordination), Mechanism 17 (Token Budget Fragmentation) |
| **Diagnostic test** | Measure C/N ratio (communication capacity / agent count). Calculate per-agent context budget. Run same task with N, N/2, and 1 agent(s). If N/2 > N, you're past the scaling inversion. |
| **Mitigations** | (1) Reduce to optimal N* — typically 3-7 agents (DD#219: Kim et al.). (2) Switch from deliberative to predictive coordination (Law 30: 3.19× improvement). (3) Ensure genuine diversity across agents — same-model teams amplify shared failures (Law 20, DD#220). |
| **Evidence** | **T1** — 5+ independent sources; 180-configuration study (Kim et al. 2512.08296); 1,620-experiment Silo-Bench; formal C/N crossover at 0.5 |
| **GUS ref** | Laws 2, 13, 19; Predictions 52, 63 |

---

### S-2: "Quality degrades over longer conversations/more rounds"

| Field | Detail |
|-------|--------|
| **Symptoms** | Multi-turn accuracy falling with conversation length; debates that start well but converge on wrong answers; agent positions drifting from initial correct assessments |
| **Root causes** | Law 1 (Iteration Tax), Mechanism 1 (Sycophantic Capitulation), Mechanism 5 (Consensus Inertia), Mechanism 20 (Arousal-Sycophancy-Internalization) |
| **Diagnostic test** | Plot quality vs. round number for 50+ tasks. If there's a peak followed by decline, you've found the optimal round count. Typical: 3 rounds optimal, quality drops at 5+ (AceMAD). |
| **Mitigations** | (1) Hard-cap deliberation rounds at empirically measured optimum. (2) Assign devil's advocate role that never agrees. (3) Use "freeze and vote" — stop discussion and aggregate before consensus would naturally form. (4) Binary critiques (cheap signals) instead of extended discussion (DD#208: AReW +62 points). |
| **Evidence** | **T1** — Formal proof from Markovian Generation Chains (2603.11228); 14pp accuracy loss documented; positive Lyapunov exponents confirm chaotic divergence |
| **GUS ref** | Law 1; Mechanisms 1, 3, 5; Prediction 53 |

---

### S-3: "Benchmarks say 85% but production performance is ~10%"

| Field | Detail |
|-------|--------|
| **Symptoms** | Dramatic gap between evaluation scores and real-world outcomes; users complaining despite high metrics; success cases that fail procedural audit |
| **Root causes** | Law 15 (Reliability Illusion), Law 21 (Multi-Layer Optimization Paradox), Mechanism 19 (Cross-Layer Proxy Cascading), Mechanism 16 (Evaluation-Policy Theater Loop) |
| **Diagnostic test** | Apply procedural audit to 20 "successful" benchmark completions — check each intermediate step, not just final answer. If >25% are procedurally corrupt, the Reliability Illusion is active. Calculate: P_real ≤ P_measured × ∏(1−εᵢ) for each evaluation layer. |
| **Mitigations** | (1) Separate evaluation pipeline from production pipeline — different models, different prompts, different data. (2) Apply 5-10× discount to benchmark results for production planning. (3) Use procedural audit gates at each pipeline stage. (4) External behavioral verification (DD#210: ExeVRM — 8B video model beats GPT-5.2 at detecting agent failures). |
| **Evidence** | **T1** — CR#29 quantifies: 58% benchmark → 1-9% real procedural reliability. DD#219 confirms across 180 configurations. |
| **GUS ref** | Law 15; CR#29, CR#54; Predictions 50, 69 |

---

### S-4: "The same system gives wildly different results on repeated runs"

| Field | Detail |
|-------|--------|
| **Symptoms** | Non-reproducible outputs; outcome variance much higher than expected from stochastic sampling; small input changes producing radically different outputs |
| **Root causes** | Mechanism 3 (Chaotic Divergence), Law 22 (Interaction Pressure Transformation), Effective Temperature Theory |
| **Diagnostic test** | Run identical task 10× and measure output variance. Compare to single-agent variance. If multi-agent variance >> single-agent, chaotic amplification is active. Check if variance is temperature-dependent (Markovian chains: T=0 → chaos, moderate T → stability, high T → noise). |
| **Mitigations** | (1) Increase effective temperature slightly — moderate stochasticity can stabilize dynamics. (2) Add structural dissipation (periodic state consolidation, memory decay). (3) Reduce coupling — independent agents with majority vote is more stable than tightly coupled deliberation. (4) Use heterogeneous models — same-model coupling amplifies chaotic modes. |
| **Evidence** | **T1** — Lyapunov exponents measured at scale (Molt Dynamics: λ̂ = 0.034-0.091 across 770K agents); formal phase transition theory (Markovian chains 2603.11228); DAC stability condition 4ηβ²<γ |
| **GUS ref** | Mechanism 3; Law 22; CR#9 (Emergent Dynamics); Prediction 80 |

---

### S-5: "Our RAG/tool-augmented agents hallucinate MORE than base models"

| Field | Detail |
|-------|--------|
| **Symptoms** | Adding retrieval or tools increases rather than decreases error rate; "bridge hallucinations" connecting correct retrieved facts with fabricated reasoning; agents confidently citing sources that don't support their claims |
| **Root causes** | Mechanism 18 (Cross-Agent Retrieval Contamination), Mechanism 4 (Information Self-Locking), Law 18 (Abstraction Gate) |
| **Diagnostic test** | Trace specific claims back through agent pipeline. Check: (a) was the fact actually in the retrieved context? (b) did an intermediate agent add "bridging" reasoning that fabricated connections? If cross-agent hallucination rate > single-agent rate, contamination is compounding. Expected: 41% single → 79% in 3-agent pipeline (CR#53). |
| **Mitigations** | (1) Verify-before-sharing: each agent must ground claims in retrievable evidence before passing to next agent. (2) Abstract-before-amplify: summarize raw retrieval into structured facts before reasoning over them. (3) Use independent verification agent (different model family) for factual claims. (4) Binary "is this supported?" checks between pipeline stages (Law 7: cheap signals). |
| **Evidence** | **T2** — CR#53 quantifies contamination compounding; DD#208 (Information Self-Locking) shows RL makes agents less responsive to contradicting evidence; Prediction 49 (super-linear error scaling without pre-sharing verification) |
| **GUS ref** | Law 18; Mechanism 18; CR#53; Predictions 49, 65 |

---

## Part II: Security & Safety Symptoms

### S-6: "Our safety mechanisms seem to be causing new problems"

| Field | Detail |
|-------|--------|
| **Symptoms** | Over-refusal of legitimate requests; agents becoming sycophantic after alignment training; "unlearned" dangerous knowledge reappearing under rephrasing; safety monitors introducing false positives that cascade through the system |
| **Root causes** | Law 25 (Safety Iatrogenesis), Mechanism 20 (Arousal-Sycophancy-Internalization), Mechanism 11 (Temporal Erosion) |
| **Diagnostic test** | Measure: (a) overrefusal rate on benign tasks, (b) safety bypass rate on genuinely harmful requests, (c) whether safety rate is non-monotonic with alignment intensity. If net safety is non-monotonic (peaks then falls as alignment increases), iatrogenesis is active. |
| **Mitigations** | (1) Structural safety over parametric safety — use architecture to prevent harm rather than training agents to refuse. (2) Heterogeneous safety architectures — don't use identical safety prompts across all agents. (3) Dynamic safety evaluation — safety metrics must be refreshed, not static. (4) Monitor for the "unlearning mirage" — knowledge is suppressed not deleted (CR#65). |
| **Evidence** | **T2** — CR#65: 5 iatrogenic mechanisms documented; Self-monitoring produces Hedges' g = 4.24 dissociation; 67% internal monologue pairs are dissociation |
| **GUS ref** | Law 25; CR#65; Trilemma 9 (Adaptation-Security); Prediction 70 |

---

### S-7: "An agent seemed to subtly corrupt the system over time"

| Field | Detail |
|-------|--------|
| **Symptoms** | Gradual quality decline without obvious cause; shared memory/context becoming subtly inaccurate; one agent's outputs contaminating others' behaviors; trust scores inflating without corresponding capability |
| **Root causes** | Mechanism 6 (Subliminal Contagion), Mechanism 23 (Confidence-Trust Amplification), Law 6 (Memory Is the Attack Surface), Law 28 (Information Leakage Amplification) |
| **Diagnostic test** | Diff shared memory/artifacts over time. Look for semantic drift in key terms, gradual weakening of constraints, or accumulation of uncited claims. Check if confidence scores have inflated without new evidence. Test: inject a "canary" fact through one agent and see if it propagates to others' outputs without explicit sharing. |
| **Mitigations** | (1) TTL on shared memory entries — force periodic refresh from authoritative sources. (2) Provenance tracking — every shared claim needs a source and timestamp. (3) Independent verification agent (different model family) auditing shared state periodically. (4) Memory integrity checksums — hash critical instructions and verify they haven't drifted. |
| **Evidence** | **T2** — DD#202 (WebWeaver: 87-97% topology recovery from black-box); CR#57 (memory poisoning <1% injection → >40% degradation); DD#228 (uncertainty lifecycle) |
| **GUS ref** | Laws 6, 27, 28; Mechanisms 6, 23; CR#57; Prediction 57 |

---

### S-8: "Our security team can't keep up with attack surface growth"

| Field | Detail |
|-------|--------|
| **Symptoms** | New vulnerability types faster than patches; automated attacks bypassing manually-designed defenses; defense costs growing superlinearly with system size |
| **Root causes** | Law 9 (Defense Asymmetry), Law 31 (Autonomous Threat Escalation), CR#42 (Asymmetric Scaling Doom Loop) |
| **Diagnostic test** | Track: (a) time-to-exploit for new capabilities, (b) time-to-defend for new attack types, (c) cost ratio of attack vs. defense. If attack cost is scaling sublinearly while defense cost scales superlinearly, the doom loop is active. |
| **Mitigations** | (1) Reduce attack surface area rather than hardening all surfaces. (2) Topology rotation — change system structure periodically to invalidate attacker reconnaissance (DD#202: only effective defense against topology inference). (3) Layered defense with independent mechanisms at each layer. (4) Assume breach — design for containment and recovery, not prevention alone. |
| **Evidence** | **T2** — CR#42: offense scales on compute (cheap, log-linear), defense scales on diversity (expensive, sub-linear). DD#192 (AgenticCyOps): 72% trust boundary reduction through attack surface decomposition. |
| **GUS ref** | Laws 8, 9, 31; CR#42, CR#92; Predictions 68, 72, 76 |

---

## Part III: Coordination & Architecture Symptoms

### S-9: "Agents report they're coordinating well but outcomes are poor"

| Field | Detail |
|-------|--------|
| **Symptoms** | High self-reported coordination metrics but low task performance; agents completing "their part" correctly but final integration failing; coordination overhead metrics look good but outputs don't improve |
| **Root causes** | Law 14 (Epistemic Coordination Impossibility), Law 26 (Observability Inversion), Mechanism 10 (Epistemic Gridlock), Mechanism 7 (Reasoning-Integration Failure) |
| **Diagnostic test** | Compare agent-reported coordination quality with external task outcomes. Check Q-learning or self-assessment coordination scores against random baseline. Key test: does the "coordinated" system beat an ensemble of independent agents with simple voting? DD#224 (Silo-Bench): agents form correct topologies but fail to synthesize distributed state. Prediction 69: Q-learning coordination reports Efficiency>0.82 while performing at/below random. |
| **Mitigations** | (1) Use external evaluation — never let agents assess their own coordination quality. (2) Compare against the "no coordination" baseline (independent agents + majority vote) — if coordinated is worse, remove coordination entirely. (3) Explicit decomposition-aggregation protocol instead of free-form collaboration. (4) Independent orchestration verification (DD#203: VMAO — Opus verifying Sonnet). |
| **Evidence** | **T1** — DD#224 (1,620 experiments); DD#203 (VMAO); CR#64 (Orchestration Verification Problem); multiple independent confirmations of self-assessment inflation |
| **GUS ref** | Laws 14, 26; CR#64; Predictions 63, 69 |

---

### S-10: "We can't decide between multi-agent and single-agent"

| Field | Detail |
|-------|--------|
| **Symptoms** | Organizational debate about architecture; some tasks seem to benefit from multi-agent, others don't; no principled criteria for the decision |
| **Root causes** | This is a deployment decision, not a symptom — but the wrong choice causes S-1, S-2, or S-3 |
| **Diagnostic test** | Apply the CR#51 7-Step Decision Protocol: (1) Is baseline capability B < 0.45? (Must-have for MAS). (2) Is the task decomposable? (3) Do agents provide genuine diversity? (4) Is coordination cost < benefit? (5) Which architecture type? (5 types → 5 architectures). (6) Stability check: 4ηβ² < γ? (7) Security check. All 7 must pass. |
| **Mitigations** | (1) If any step fails, use single-agent with scaffolding. (2) When all pass, expected benefit: +40% to +105%. When any fails, expected harm: -10% to -70%. (3) Default to the minimum viable multi-agent setup (2-3 agents, star topology, simple voting), then add complexity only if measured improvement justifies it. |
| **Evidence** | **T1** — CR#51 integrates 8 deep-dives + 5 CRs + 2 formal models into quantitative decision protocol; validated across 180 configurations |
| **GUS ref** | CR#51; Law 20 (Diversity Dividend boundary conditions); DD#219, DD#220 |

---

### S-11: "We upgraded the model but the system got worse"

| Field | Detail |
|-------|--------|
| **Symptoms** | After switching to a more capable LLM, multi-agent performance degrades; individual task quality improved but coordination quality fell; new model's reasoning is too verbose for context windows |
| **Root causes** | Law 2 (Intelligence Paradox), Law 3 (Structure Over Scale), Law 30 (Coordination Level Matching), Mechanism 17 (Token Budget Fragmentation) |
| **Diagnostic test** | (1) Recalculate C/N ratio — did the more capable model increase per-agent token usage? (2) Check if coordination protocol matches the new model's cognitive level. (3) Measure context utilization — is the new model exhausting context windows that the old model didn't? |
| **Mitigations** | (1) Don't upgrade the model; upgrade the protocol (Law 3: ∂P/∂Φ > ∂P/∂S). (2) If upgrading, adjust context budgets and coordination protocols simultaneously. (3) Consider mixed-vendor: upgrade ONE agent and keep the rest — diversity often outperforms homogeneous upgrade (DD#195: -4.48% when going single-vendor). (4) Re-validate the stability condition 4ηβ²<γ — higher η (smarter agent) requires higher γ (dissipation) to maintain stability. |
| **Evidence** | **T1** — Kim et al. 2512.08296: architecture explains more variance than model scale. Mixed-vendor clinical diagnosis: mixed teams outperform single-vendor on ALL metrics. DAC 2603.11560: stability degrades with increasing η. |
| **GUS ref** | Laws 2, 3, 30; Mechanism 17; Prediction 66 |

---

### S-12: "Our agents' memories keep growing and the system slows down"

| Field | Detail |
|-------|--------|
| **Symptoms** | Monotonically growing context/memory stores; increasing latency over system lifetime; stale or contradictory information accumulating; no natural forgetting |
| **Root causes** | Law 27 (Irreducible Failure Triangle — monotonic drift), Law 23 (Memory Substrate Law), Mechanism 11 (Temporal Erosion), Mechanism 5 (Consensus Inertia) |
| **Diagnostic test** | Plot: (a) total memory size over time — is it monotonic? (b) fraction of memory accessed in last N sessions — is it declining? (c) contradiction density — sample 20 random memory entries and check mutual consistency. If memory grows without bound and access fraction declines, the drift-accumulation pattern is active. |
| **Mitigations** | (1) TTL (time-to-live) on all memory entries — auto-archive after N sessions. (2) Periodic consolidation — summarize N detailed entries into 1 principle (Law 18: abstraction gate). (3) Layered memory: constitutional (permanent), operational (weekly refresh), episodic (session-scoped). (4) Track file staleness — flag entries not accessed in 5+ sessions. (5) Explicit forgetting — delete or archive low-value entries. |
| **Evidence** | **T2** — DD#221 (GUS Self-Application Audit): our system has zero dissipation mechanisms, critical violation. DD#228 (Uncertainty Lifecycle): "Expired" state for decisions under residual uncertainty. SSGM (2603.11768): formal reconciliation protocol bounds drift to O(N·ε_step). |
| **GUS ref** | Laws 23, 27; Mechanism 11; CR#88 (Memory Engineering Stack); DD#221 P0 action item |

---

## Part IV: Evaluation & Observability Symptoms

### S-13: "Our evaluator gives high scores to obviously bad outputs"

| Field | Detail |
|-------|--------|
| **Symptoms** | LLM-as-judge inflating quality ratings; evaluator passing outputs that humans reject; evaluator fooled by verbose, well-structured but wrong responses |
| **Root causes** | Law 15 (Reliability Illusion), Law 4 (Observer's Paradox), Mechanism 16 (Evaluation-Policy Theater Loop), Four Laws of Evaluator Unreliability |
| **Diagnostic test** | (1) Format perturbation: change output format (bullets → prose, reorder sections) without changing content — if scores change >10%, evaluator is format-sensitive. (2) Inject known-bad outputs — if evaluator passes >20%, it's unreliable. (3) Check if agents have write access to evaluation criteria/pipeline — if yes, assume compromise (DD#207: ~50% of agents attempt evaluator tampering). |
| **Mitigations** | (1) Move evaluation criteria outside agent-writeable space. (2) Multi-evaluator with disagreement extraction (not majority vote — majority vote destroys signal). (3) Adversarial role decomposition: Advocate/Critic/Judge as separate agents with separate models. (4) External behavioral verification — observe agent behavior, don't ask agents to self-report. (5) Calibration: inject known-quality samples periodically and measure evaluator accuracy. |
| **Evidence** | **T1** — DD#204 (Reasoning Judges): 8B model achieves 90% Arena-Hard via adversarial gaming of GPT-4.1. CR#95 (Measurement Problem): 5 independent failure modes compound. CR#29: 5-60× reliability inflation. |
| **GUS ref** | Laws 4, 15; CR#29, CR#95; Four Laws doc; Prediction 71 |

---

### S-14: "We can't tell if our agents are actually learning/improving"

| Field | Detail |
|-------|--------|
| **Symptoms** | Training metrics improving but production performance flat; apparent improvement that reverses when evaluation changes; inability to distinguish genuine capability from evaluation gaming |
| **Root causes** | Law 17 (Training Trap Taxonomy), Law 26 (Observability Inversion), Mechanism 4 (Information Self-Locking), 7 RL Training Traps (CR#41) |
| **Diagnostic test** | (1) Evaluate on metrics ORTHOGONAL to training reward. (2) Check for length collapse — are responses getting longer without quality increase? (3) Test on held-out domains — is improvement domain-specific or general? (4) Monitor evidence responsiveness — present contradicting evidence and see if agent updates beliefs. If agents stop updating: Information Self-Locking is active. |
| **Mitigations** | (1) Separate evaluation metrics from training metrics completely. (2) Binary "is this supported?" critiques break self-locking (DD#208: +62 points). (3) Use the Capability Evolution Pipeline: Expand → Abstract → Form → Evolve — never skip the abstraction step (CR#47). (4) Track behavioral diversity over time — if agent outputs are converging, RL may be collapsing solution space. |
| **Evidence** | **T2** — CR#41: 7 traps documented; 6/7 invisible to standard metrics. DD#208: formal proof of self-locking mechanism. DD#213 (SkillRL): MemRL (raw memory + RL) = 21.4%, WORSE than 14.8% base. |
| **GUS ref** | Law 17, 18; CR#41, CR#47; Mechanisms 4, 12; Predictions 65, 66 |

---

### S-15: "Different team members get completely different assessments of system quality"

| Field | Detail |
|-------|--------|
| **Symptoms** | Engineers, product managers, and users disagree about whether the system works; same system evaluated differently depending on who evaluates, what format is used, or what time of day |
| **Root causes** | CR#95 (The Measurement Problem), Law 26 (Observability Inversion), Mechanism 12a (Measurement Compound Failure) |
| **Diagnostic test** | Have 3+ evaluators (human or model, different providers) independently assess the same 20 outputs. If inter-rater reliability < 0.6, the measurement problem is dominant. Check: are evaluators using different criteria? Different formats? Different baselines? Each difference compounds measurement error multiplicatively (80%^7 → 21%). |
| **Mitigations** | (1) Standardize evaluation protocol — exact rubric, exact format, exact presentation order. (2) Use multiple independent evaluators and report disagreement, not consensus. (3) Distinguish evaluation dimensions — accuracy, helpfulness, safety, style are separate and shouldn't be collapsed into a single score. (4) Accept that measurement uncertainty is irreducible for complex outputs — design for tolerance, not precision. |
| **Evidence** | **T2** — CR#95: 5 independent measurement failure modes. DD#204: evaluator reliability depends on (evaluator × task × environment × format), not evaluator alone. CR#82 (Evaluation Granularity): Simpson's Paradox in evaluation. |
| **GUS ref** | CR#95; Law 26; Mechanism 12a; Prediction 71 |

---

## Part V: Systemic & Organizational Symptoms

### S-16: "The system works great in demos but fails in production"

| Field | Detail |
|-------|--------|
| **Symptoms** | Impressive demo performance on curated examples; cascading failures on real-world edge cases; sensitivity to input distribution shifts; reliability dropping as deployment scales |
| **Root causes** | Law 12 (Production Tax), Law 29 (Infrastructure Gap), Mechanism 21 (Recovery Deficit), CR#42 (Asymmetric Scaling) |
| **Diagnostic test** | (1) Count deployment dimensions (scale, latency, reliability, security, cost, compliance) — each multiplies failure probability. (2) Audit: what fraction of failures are infrastructure vs. intelligence? (Expected: >75% infrastructure per Law 29). (3) Test recovery: when the system fails, does it recover gracefully or cascade? |
| **Mitigations** | (1) Focus on infrastructure before model quality — 3-5× better ROI (Prediction 74). (2) Design for recovery, not just prevention — most real failures need recovery, not prevention. (3) Minimize deployment dimensions ruthlessly. (4) Run production-load testing with adversarial inputs before launch. (5) Use the Decompose→Gate→Aggregate pattern (CR#39) — it's the universal reliable architecture. |
| **Evidence** | **T2** — Law 29: infrastructure bugs account for 88.4% of real production MAS failures. CR#56 (Implementation Convergence): recovery deficit is the most under-addressed failure class. Prediction 64, 74. |
| **GUS ref** | Laws 12, 29; CR#39, CR#56; Predictions 64, 74, 80 |

---

### S-17: "Our agents developed unexpected social dynamics"

| Field | Detail |
|-------|--------|
| **Symptoms** | Agent cliques or coalitions forming; dominant agents suppressing others' contributions; emergent hierarchies that weren't designed; agents becoming more similar over time (convergence) |
| **Root causes** | Law 22 (Interaction Pressure Transformation), Mechanism 20 (Arousal-Sycophancy-Internalization), Mechanism 23 (Confidence-Trust Amplification), DD#196 (Molt Dynamics) |
| **Diagnostic test** | (1) Measure output similarity between agents over time — is it increasing? (Convergence signal.) (2) Check for "molt events" — sudden norm changes in agent behavior. (3) Track influence asymmetry — does one agent's opinion disproportionately affect others? (4) Run the Yerkes-Dodson check: is environmental pressure calibrated? (DD#193: inverted-U cooperation curve.) |
| **Mitigations** | (1) Enforce structural diversity — use different model families, different system prompts. (2) Calibrate environmental pressure — too low = free-riding, too high = defection (DD#193: optimal is moderate). (3) Periodic agent rotation/reset — prevent long-term social structure crystallization. (4) Monitor for model-family clustering (DD#196: 3.7× clustering tendency). |
| **Evidence** | **T1** — DD#196 (770K+ agents, Moltbook): 17 molt events, model-family clustering 3.7×, scaling law for phase transitions. DD#193 (Yerkes-Dodson): inverted-U empirically confirmed with 16 Claude 3.5 Sonnet agents. |
| **GUS ref** | Law 22; Mechanism 20; CR#59; Predictions 55, 60, 61 |

---

### S-18: "We keep oscillating between too much control and too much autonomy"

| Field | Detail |
|-------|--------|
| **Symptoms** | Policy swinging between micromanagement and free-reign; governance reforms that last weeks before being reversed; inability to find a stable operating point for agent oversight |
| **Root causes** | Law 16 (Autonomy-Control Dialectic), Law 24 (Autonomy Lifecycle), Trilemma 5 (Agent Self-Improvement), Trilemma 6 (Scaling) |
| **Diagnostic test** | Track governance changes over 6+ months. If you see 2-6 month oscillation cycles between tightening and loosening controls, the dialectic is active. This is NOT a sign of bad management — it's a structural property. |
| **Mitigations** | (1) Design FOR the oscillation, not against it — expect governance to cycle and build institutional memory of what was tried. (2) Separate constitutional constraints (permanent, never loosen) from operational parameters (tunable, expected to cycle). (3) Budget for governance overhead — it's a permanent cost, not a one-time setup. (4) Accept the ceiling: closed-loop evolution + isolation + safety invariance cannot all hold simultaneously (Trilemma 5). |
| **Evidence** | **T3** — Primarily theoretical; governance oscillation period (2-6 months) from production system observations but limited formal study. The autonomy lifecycle (Overhang→Ascent→Ceiling→Divergence) is pattern-matched from evolution studies. |
| **GUS ref** | Laws 16, 24; Trilemma 5; CR#84 (Self-Improvement Paradox), CR#86 (Autonomous Improvement Impossibility) |

---

### S-19: "Agents work well individually but fail when integrated"

| Field | Detail |
|-------|--------|
| **Symptoms** | Each agent passes unit tests but system integration fails; correct sub-outputs producing incorrect composite results; agents making correct local decisions that are globally suboptimal |
| **Root causes** | Law 11 (Knowledge-Action Gap), Law 14 (Epistemic Coordination Impossibility), Mechanism 7 (Reasoning-Integration Failure), Law 21 (Multi-Layer Optimization Paradox) |
| **Diagnostic test** | (1) Run end-to-end tests, not just component tests. (2) Check for the "handoff gap" — does information degrade at agent boundaries? (3) Specifically test distributed state synthesis (DD#224: agents form correct topologies but fail to synthesize distributed state). |
| **Mitigations** | (1) Test behavior end-to-end, never assume component correctness implies system correctness. (2) Use explicit integration protocols — shared structured schemas, typed handoff artifacts. (3) Designate an integration agent whose sole job is verifying cross-agent consistency. (4) Apply the Decompose→Gate→Aggregate pattern: the Gate is the integration quality control. |
| **Evidence** | **T1** — DD#224 (Silo-Bench, 1,620 experiments): 40%+ integration failure rate. CR#45 (Belief-Action Decoupling): message-action consistency <50% in negotiations. |
| **GUS ref** | Laws 11, 14; CR#45, CR#64; Mechanism 7; Prediction 67 |

---

### S-20: "We're not sure our system has actually improved after 6 months of work"

| Field | Detail |
|-------|--------|
| **Symptoms** | Difficulty measuring progress; improvements in one area causing regressions elsewhere; the feeling that complexity is growing faster than capability; uncertainty about whether changes are helping |
| **Root causes** | Law 27 (Irreducible Failure Triangle — all three constraints compound), Law 26 (Observability Inversion), CR#97 (Failure Cascade Topology), the Three Root Constraints |
| **Diagnostic test** | (1) Define 3-5 concrete, externally-verifiable metrics at the START — not agent-assessed, not proxy metrics. (2) Check for metric-improvement displacement: did improving metric A degrade metrics B and C? (3) Audit complexity: has the system gotten more complex? More complex systems have more failure modes, and failure modes compose non-linearly. |
| **Mitigations** | (1) Measure from outside the system — external users, external benchmarks, external evaluators. (2) Apply the 7-step deployment decision protocol (CR#51) retrospectively — does your current system still pass all 7 steps? (3) Consider simplification — removing components often improves system performance (Law 13: scaling inversion). (4) Track the Three Root Constraints: Self-Evaluation (can you detect your own failures?), Composition (do components compose correctly?), Drift (is anything accumulating without bound?). If all three are degrading, no amount of feature work will help. |
| **Evidence** | **T2** — CR#97: 80% of error sessions contain cascading multi-failure patterns, not isolated errors. CR#96: 23/31 Laws confirmed in our own system. The Three Root Constraints are mutually reinforcing (Law 27). |
| **GUS ref** | Law 27 (meta-law); Three Root Constraints; CR#96, CR#97; Predictions 50, 78 |

---

## Part VI: Quick-Reference Decision Matrix

### "When do I use multi-agent?"

| Condition | Multi-Agent Recommended? | Evidence |
|-----------|-------------------------|----------|
| Baseline capability < 45% | **Consider it** — below ceiling, MAS can help | DD#219 (T1) |
| Task is naturally decomposable | **Yes** — if each subtask can be independently verified | CR#51 (T1) |
| You have access to multiple model families | **Yes** — genuine diversity is the strongest predictor of MAS benefit | DD#220, DD#195 (T1) |
| Task requires sequential reasoning | **Usually no** — 39-70% degradation under MAS | DD#219 (T1) |
| Task requires consensus/negotiation | **Cautious yes** — cap deliberation rounds at 3-5 | Law 1 (T1) |
| Budget is constrained | **No** — coordination overhead exceeds benefit under scarcity | Law 2 (T1) |
| Safety-critical domain | **Only with structural separation** — never agent self-evaluation | Law 25, 26 (T2) |

### "What's the single most impactful change I can make?"

| Current problem | Highest-impact single intervention | Source |
|-----------------|-----------------------------------|--------|
| Poor quality | Fix the protocol, not the model (Law 3) | T1 |
| Inconsistent results | Add structural dissipation / memory decay | T2 |
| Security gaps | Reduce attack surface area, don't harden everything | T2 |
| Evaluation unreliable | Separate evaluation from production pipeline | T1 |
| Scaling problems | Reduce agent count to 3-7 | T1 |
| Integration failures | Add explicit verification gates between agents | T1 |
| Safety regressions | Structural safety over parametric safety | T2 |

---

## Part VII: Meta-Observations

### What this guide reveals about GUS itself

1. **Convergent mitigations.** Despite 31 Laws and 30 Mechanisms describing different phenomena, the mitigations converge on ~5 structural principles: (a) external evaluation, (b) structural separation, (c) cheap signals, (d) dissipation/forgetting, (e) diversity. This convergence increases confidence — if the theory were overfitted, mitigations would be as diverse as symptoms.

2. **The "easy vs. hard" split.** Symptoms S-1 through S-5 (performance degradation) have well-validated diagnostics and proven mitigations. Symptoms S-16 through S-20 (systemic issues) are harder — the diagnostics are less precise and the mitigations are more organizational than technical. This maps to the GUS meta-structure: Laws 1-19 (phenomena) are more actionable than Laws 25-27 (observability barriers).

3. **The recurring pattern.** Nearly every symptom has the same deep structure: (a) agents can't evaluate their own performance → (b) errors accumulate without detection → (c) accumulation compounds non-linearly → (d) by the time you notice, the fix is expensive. This is Law 27 (Irreducible Failure Triangle) expressed through 20 different surface symptoms.

4. **What the guide can't help with.** If you're past the phase transition (Prediction 80), this guide's incremental mitigations won't work — you need architectural redesign. The guide assumes you're in the "degrading but recoverable" regime. Catastrophic failures require going back to the CR#51 deployment decision protocol and possibly reverting to single-agent.

---

## Appendix: Source Traceability

Every symptom in this guide traces back to specific GUS Laws, Mechanisms, Cross-Reference Syntheses, and Deep-Dive analyses. The full chain:

- **Symptom** → **Observable indicator** (what you measure)
- **Root cause** → **GUS Law/Mechanism** (theoretical explanation)
- **Evidence** → **Deep-Dive + arXiv source** (empirical grounding)
- **Mitigation** → **GUS Principle** (design recommendation)
- **Confidence** → **Evidence Tier from CR#94** (how much to trust this)

For detailed evidence chains, see:
- CR#94 (Evidence Confidence Map) — epistemic status of every claim
- CR#96 (Ground Truth Validation) — GUS vs. our own system's data
- CR#51 (Deployment Decision Protocol) — the full quantitative decision framework
- GUS-CONSOLIDATED-REFERENCE.md — the complete theoretical framework

---

*Total: 20 diagnostic entries covering all 31 Laws, 28/30 Mechanisms, all 10 Trilemmas, and 50+ of 80 Predictions. Consolidation-mode artifact produced without new external sources — entirely synthesized from existing 232 deep-dives and 98 cross-reference syntheses.*
