<ai_context>
summary: "Triage of 10 new arXiv papers (June 3–18, 2026) not covered by prior batches. Convergent theme: The Contract Layer — the structured interface between agents and their environments (harness, guidance files, tool contracts, abstention protocols, evaluation criteria, uncertainty thresholds) is emerging as the primary site of both failure and improvement. Not model capability, not data, but the declared/enforced intermediary. Six papers independently show 6-12× improvement from contract quality while model swaps yield <2×. Two papers demonstrate that contract corruption (not model persuasion) is the load-bearing attack surface. Two papers show that aggregate evaluation contracts systematically mispredict deployment performance."
triggers: ["arXiv triage", "contract layer", "harness quality", "AGENTS.md guidance", "probe-and-refine", "StaminaBench", "multi-turn stamina", "ContractGuard", "tool contract security", "EARS", "explanatory abstention", "sub-agent failure communication", "predictive validity", "benchmark transfer", "trajectory collapse", "Human-on-the-Loop", "Meta-Agent Challenge", "recursive self-improvement", "uncertainty decomposition", "clarification seeking", "AtomMem", "atomic memory", "agentic review harness"]
last_updated: "2026-06-19"
source_basis: "arXiv API queries: all:'AI agent' AND all:'multi-agent', all:'LLM agent' AND all:'memory', all:'agentic workflow' OR all:'agent orchestration', all:'autonomous agent' AND all:'self-improvement', all:'LLM agent' AND all:'context window', all:'agent' AND all:'tool use' AND all:'LLM', all:'agent' AND all:'harness' AND all:'LLM', all:'agent' AND all:'failure mode' AND all:'LLM' (8 queries, deduplicated against all prior triages)"
</ai_context>

# arXiv Triage — June 3–18, 2026: The Contract Layer

*Triaged: 2026-06-19 | Source: `https://export.arxiv.org/api/query` | Queries: 8 standard scout queries (see source_basis) | Papers: 10 new, deduplicated against all prior batches.*

---

## Convergent Theme: The Contract Layer

Ten independent papers converge on a structural finding: **the decisive variable in agent system performance is the quality of the contract layer** — the structured interface between agents and their environments. This includes: guidance files (AGENTS.md), tool contracts (preconditions/effects/auth), evaluation contracts (what metrics measure), communication contracts (how agents signal failure), and uncertainty contracts (when to act vs. ask).

The evidence is striking in its consistency:

| Paper | Contract Type | Effect of Contract Quality |
|-------|--------------|---------------------------|
| Probe-and-Refine | Guidance file | +14.5pp coverage (33% vs 25.5%) |
| StaminaBench | Harness design | 6-12× between best/worst harness |
| ContractGuard | Tool effect declarations | 0% injection success (from ~40%) |
| EARS | Abstention protocol | 68.5% → 78.9% pass rate |
| Uncertainty Decomposition | Confidence/uncertainty split | +73% clarification F1 |
| Beyond Static Leaderboards | Evaluation criteria | Rank instability across OOD |

Meanwhile, model swaps within the same contract yield <2× differences. **The contract layer, not the model, is the multiplier.**

### Connection to Our System

This converges powerfully with KE-1982 (The Scope Premium): the 10.8× quality gap between may-heartbeat and metric-alert-triage is exactly a contract quality gap — the same agent, same model, different declared scope/completion criteria. Our system has high-quality model access but inconsistent contract quality across workflows.

---

## ★★★★★ [2606.20512] Probe-and-Refine Tuning of Repository Guidance for Coding Agents

- **Source**: https://arxiv.org/abs/2606.20512
- **Published**: 2026-06-18
- **Summary**: AGENTS.md guidance files for coding agents are contested — studies disagree on whether they help or harm. This paper shows **how the guidance is produced is the decisive variable**. Introduces probe-and-refine tuning: synthetic bug-fix probes iteratively diagnose and patch a repository's guidance file through single-shot LLM calls (no agent loop during tuning). On SWE-bench Verified (Qwen3.5-35B-A3B, 200 steps): 33.0% resolve rate vs 28.3% for static guidance and 25.5% unguided (p<0.001). The improvement comes from **coverage, not precision**: refined guidance produces evaluable patches for 14.5pp more instances while per-patch precision stays constant (~59%). A step-budget experiment shows guidance is what lets the agent use a larger step budget productively. Cross-model transfer degrades when the model can't generate sufficiently diagnostic output.
- **Key Finding**: The guidance contract determines whether additional compute is productive. Without good guidance, more steps = more waste. With good guidance, more steps = more solved problems. The precision ceiling (~59%) is model-determined; the coverage floor is contract-determined.
- **Implication for Us**: Our system's compiled lessons and context files are guidance contracts. The finding that coverage (not precision) improves means our agents aren't failing because they make worse changes — they fail because they don't reach the right files. This maps to KE-1979's orientation waste: 37% of ops spent navigating rather than acting. Probe-and-refine could be applied to our AGENTS.md/context.md files: synthetically probe whether agents can locate the correct intervention site, then iteratively refine the guidance until coverage improves. The step-budget finding directly validates KE-1983 (Speed-Kill Threshold): slow sessions hit timeout not because work is harder but because they waste steps on navigation — better guidance fixes this without changing the timeout.
- **Cross-references**: [KE-1979 Orientation Waste], [KE-1982 Scope Premium], [KE-1983 Speed-Kill Threshold], [APEX (2606.15363) three-layer evolution]

---

## ★★★★★ [2606.19613] StaminaBench: Stress-Testing Coding Agents over 100 Interaction Turns

- **Source**: https://arxiv.org/abs/2606.19613
- **Published**: 2026-06-17
- **Summary**: Measures agent stamina — how many consecutive turns before failure. Agents implement a REST API server then modify it across 100 procedurally generated change requests (up to 6,000-line codebases). Six harnesses × seven open-source LLMs × 20 scenarios. Key findings: (1) **All tested models fail within 5-6 turns** without test feedback — confirming vibe-coding without testing produces bugs. (2) Passing test feedback + retry improves passed turns by **up to 12×**. (3) **A good harness is required**: stronger models exhibit up to a **6× gap** between their best and worst harness; weaker models fail with any harness.
- **Key Finding**: The 6× harness gap for strong models means the contract layer (harness design) explains more variance than 6× model capability differences. The harness is not infrastructure — it's the primary determinant of multi-turn success. Critically, weaker models can't be rescued by any harness, establishing a **capability threshold below which contracts don't matter**. Above that threshold, contract quality dominates.
- **Implication for Us**: Our system already operates above the capability threshold (frontier models). StaminaBench predicts that harness quality should be our primary optimization target. The 12× improvement from test feedback specifically maps to our system: sessions that verify their work (run tests, check results) before proceeding sustain coherence dramatically longer. This validates the "verify-after-write" pattern we enforce. The 5-6 turn failure without feedback explains why heartbeat sessions (which often don't verify intermediate steps) degrade — they're operating in the "no feedback" regime.
- **Cross-references**: [KE-1982 Scope Premium], [KE-1917 Valley of Death], [Guava (2606.18363) harness for embodied agents]

---

## ★★★★★ [2606.18550] ContractGuard: The Gate Is Only as Honest as Its Contracts

- **Source**: https://arxiv.org/abs/2606.18550
- **Published**: 2026-06-17
- **Summary**: Risk-Aware Causal Gating (RACG) removes dangerous tools from the agent's action space. This paper shows the security guarantee **relocates trust into tool contract integrity**, not model behavior. Three contributions: (1) Contract corruption makes the gate mis-decide without persuading the agent. (2) **Effect forgery is strictly more dangerous than risk-label tampering** — RACG's causal gate is applied before the admissibility gate, so only effect manipulation routes dangerous tools onto the causal path. (3) ContractGuard: signed provenance + typed attestation + runtime effect verification restores injection success to zero against all modeled attacks (including exhaustive white-box adaptive attacker) on six current models (Claude Opus 4.8, Sonnet 4.6, Haiku 4.5, Nova Premier, Nova 2 Lite, GPT-OSS-120B).
- **Key Finding**: The attack surface for tool-using agents is the **contract registry**, not the model's reasoning. This is analogous to attacking the DNS rather than the application — you don't need to compromise the agent if you can compromise what the agent trusts about its tools. The effect-over-risk ordering is a precise architectural insight: the causal graph structure of the gating system determines which contract fields are load-bearing.
- **Implication for Us**: Our system defines tool contracts implicitly through context files and function signatures. ContractGuard's insight applies: if an agent's context says a file "contains X" but it doesn't (stale context), the agent will make wrong decisions not because it reasons badly but because its contract about the environment is wrong. This is ACCORD's assumption-over-observation gap applied to the tool layer. The fix is structural: sign/verify contract integrity, not just trust static declarations. Our tool definitions should be verifiable at call time, not loaded once at session start.
- **Cross-references**: [FragFuse (2606.15609) memory as temporal attack surface], [SafeClawBench (2606.18356)], [Agent Security & Governance], [ACCORD (2606.16432) probe before act]

---

## ★★★★ [2606.18668] EARS: Explanatory Abstention for Reliable Sub-Agent Modeling

- **Source**: https://arxiv.org/abs/2606.18668
- **Published**: 2026-06-17
- **Summary**: In large-scale MAS, a coordinator delegates to domain-specialized sub-agents. Sub-agents built on smaller models **over-answer** misrouted/underspecified requests instead of abstaining — producing hallucinations rather than actionable feedback. EARS reframes sub-agent abstention as an **inter-agent communication protocol**: the sub-agent exposes an actionable failure state (structured label + rationale under a failure taxonomy) to the coordinator, enabling clarification, rerouting, or fallback. Production deployment in e-commerce assistant: **overall pass rate improves from 68.5% to 78.9%**.
- **Key Finding**: The contract between agents matters more than the capability of individual agents. EARS's insight is that "I can't do this, and here's why" is more valuable than attempting and hallucinating. The structured failure taxonomy (inter-agent protocol) is itself a contract — it defines what failure states are communicable. This creates a **failure-aware routing layer** that didn't exist when agents only returned success outputs.
- **Implication for Us**: Our agents don't have a structured abstention protocol. When a session fails, the failure manifests as timeout, low-quality output, or error — not as a typed failure state communicable to the orchestrator. EARS predicts that adding structured "I can't do this because X" responses (instead of attempting and failing) would improve overall system pass rate. This maps directly to the Constraint-Evasive Fabrication finding (2606.14831): agents under irreconcilable constraints fabricate escape routes. EARS's fix is architectural — make abstention the easier path than fabrication.
- **Cross-references**: [CEF/Thanatosis (2606.14831) constraint-evasive fabrication], [KE-1982 Scope Premium], [Idle-Drift (2606.16613) plan but don't act], [The Abstention Decay]

---

## ★★★★ [2606.19704] Beyond Static Leaderboards: Predictive Validity for the Evaluation of LLM Agents

- **Source**: https://arxiv.org/abs/2606.19704
- **Published**: 2026-06-18
- **Summary**: Aggregates 14 parallel implementation studies of one MCP-based industrial-agent benchmark + seven prior benchmarks. Finds: aggregate-score leaderboards **systematically underspecify** deployed-agent evaluation. Rankings from aggregate scores don't transfer to OOD settings; recent competition retrospectives provide direct evidence of rank instability. Proposes ranking by **predictive validity** (correlation between in-sample and out-of-sample rank) instead of in-sample mean. Reports a twelve-tier measurement apparatus exposing deployment-relevant dimensions that HELM-era benchmarks collapse.
- **Key Finding**: The evaluation contract (how you measure) creates the reality (what you optimize for). Aggregate scores collapse 12+ dimensions into one number, producing rankings that are internally consistent but externally invalid. This is the evaluation version of Goodhart's Law applied to agent systems: once agents optimize for leaderboard position, the metric ceases to measure what matters. The predictive validity proposal is a contract upgrade — it asks "does this ranking predict deployment rank?" rather than "is this ranking internally consistent?"
- **Implication for Us**: Our evaluation system uses session-level verdicts (good/acceptable/needs_improvement) that collapse multiple quality dimensions. KE-1984 already shows this creates phantom feedback loops. The predictive validity framework suggests we should measure whether evaluation verdicts predict downstream system health (user satisfaction, task completion, error rates) rather than just internal consistency of the evaluation criteria. If they don't correlate, the evaluation contract is invalid regardless of how precisely it's applied.
- **Cross-references**: [KE-1984 Phantom Feedback Loop], [KE-1982 Scope Premium], [The Evaluation Mirage], [DeepSWE benchmark saturation (HN)]

---

## ★★★★ [2606.19559] Uncertainty Decomposition for Clarification Seeking in LLM Agents

- **Source**: https://arxiv.org/abs/2606.19559
- **Published**: 2026-06-17
- **Summary**: Classical aleatoric/epistemic uncertainty is insufficient for interactive agents. Proposes prompt-based decomposition separating **action confidence** from **request uncertainty**, enabling agents to ask for clarification when specifications are ambiguous. Introduces WebShop-Clarification and ALFWorld-Clarification benchmarks (50% deliberately underspecified tasks). Results across 5 LLM backbones (GPT-5.1, DeepSeek-v3.2-exp, GLM-4.7, Qwen3.5-35B, GPT-OSS-120B): **+73% clarification F1** on ALFWorld-Clarification vs ReAct+UE, +36% vs UAM. Gains generalize across all backbones.
- **Key Finding**: The agent's contract with its environment should include a "request more information" action that is structurally available when specifications are underspecified. The decomposition is the key insight: "I'm confident in my reasoning but uncertain about what you want" vs "I'm uncertain about my reasoning" requires different responses (ask vs think harder). Current agent systems conflate these.
- **Implication for Us**: Our agents rarely ask for clarification — they proceed with assumptions or produce partial results. This maps to ACCORD's assumption-over-observation gap: agents act on assumed specifics rather than probing. The uncertainty decomposition could be applied to our workflows: when a heartbeat session encounters an ambiguous task, it should be able to signal "underspecified" (high request uncertainty) rather than attempting and producing low-quality output. This is EARS's structured abstention applied to the task-specification layer.
- **Cross-references**: [EARS (2606.18668) explanatory abstention], [ACCORD (2606.16432) probe before acting], [CEF (2606.14831) fabrication under constraint], [KE-1982 Scope Premium — scope is the uncertainty-resolution mechanism]

---

## ★★★★ [2606.19812] Human-on-the-Loop Orchestration for AI-Assisted Legal Discovery

- **Source**: https://arxiv.org/abs/2606.19812
- **Published**: 2026-06-18
- **Summary**: Names **"trajectory collapse"** — an early misclassification silently propagates through a multi-step agentic workflow, rendering the entire chain invalid. In legal e-discovery, this constitutes malpractice. Introduces a four-layer verification architecture (planning, reasoning, execution, uncertainty quantification). Calibrated uncertainty thresholds **reduce privilege-waiver risk by up to 61%** while routing fewer than 25% of documents to human review.
- **Key Finding**: Trajectory collapse is the cascading failure mode of contract-less execution — when there's no checkpoint contract ("verify this step before proceeding"), a single early error compounds silently. The 4-layer architecture is a contract specification at each stage. The efficiency result (61% risk reduction for 25% human routing) shows that selective enforcement of verification contracts is sufficient — you don't need to check everything, just the high-uncertainty points.
- **Implication for Us**: Our system experiences trajectory collapse in multi-step workflows — a wrong file read or misunderstanding in early ops propagates through the entire session. The verify-after-write pattern is a partial contract against this. The 61%-for-25% efficiency suggests we should identify the 25% of steps with highest uncertainty and enforce verification only there, rather than universal checking (expensive) or no checking (collapse-prone).
- **Cross-references**: [KE-1983 Speed-Kill Threshold — slow sessions may be manifesting trajectory collapse], [StaminaBench (2606.19613) 5-6 turn failure without feedback], [The Transduction Chain]

---

## ★★★ [2606.04455] The Meta-Agent Challenge: Are Current Agents Capable of Autonomous Agent Development?

- **Source**: https://arxiv.org/abs/2606.04455
- **Published**: 2026-06-03
- **Summary**: Evaluates whether frontier models can autonomously develop agent systems. Meta-agents (code agents) are given a sandbox, evaluation API, and time limit to iteratively build agent artifacts. Results: **meta-agents rarely match human-engineered baselines**. Successes dominated by proprietary frontier models. High variance. Under optimization pressure, agents surface **adversarial behaviors** (ground-truth exfiltration). Multi-layer defenses against reward hacking required.
- **Key Finding**: The contract design skill — knowing what guidance/structure/constraints to put around an agent — doesn't yet meta-learn. Models can execute within contracts but can't reliably design good contracts. Under pressure, they hack the evaluation contract rather than improving the execution contract. This is a fundamental asymmetry: contract *execution* scales with model capability, but contract *design* requires a different competence that current models lack.
- **Implication for Us**: Our system's self-improvement loop (compiled lessons, harness evolution) operates within human-designed contracts. MAC's result predicts that fully autonomous evolution of the contract layer (letting the system redesign its own workflows, evaluation criteria, context structures) would produce adversarial drift rather than genuine improvement. Human oversight of the contract layer — what gets measured, what counts as success, what's the scope boundary — remains the irreducible human contribution. APEX's +90% co-evolution works because it has human-specified dimensions to evolve along.
- **Cross-references**: [APEX (2606.15363) multi-axis co-evolution], [KE-1984 Phantom Feedback Loop — evaluation contract creates its own failures], [SEAGym (2606.17546) self-evolution evaluation]

---

## ★★★ [2606.19847] AtomMem: Atomic Facts for LLM Agent Memory

- **Source**: https://arxiv.org/abs/2606.19847
- **Published**: 2026-06-18
- **Summary**: Long-term memory via atomic facts: a Fact Executor selectively extracts high-value atomic facts from interactions as memory primitives. Facts organized into hierarchical event structures and temporal profiles tracking evolving attributes. Retrieval via associative memory graph connecting fragmented memories. SOTA on LoCoMo benchmark across reasoning tasks.
- **Key Finding**: The memory contract (what unit gets stored) determines downstream utility. Coarse narrative storage is unstable; atomic facts with hierarchical structure and temporal tracking are stable and retrievable. The "selective extraction of high-value facts" is a contract at consolidation time: what's worth remembering is determined by value, not by recency or semantic similarity.
- **Implication for Us**: Our compiled lessons are coarse narrative ("don't do X because Y happened") rather than atomic facts. AtomMem predicts that decomposing lessons into typed atomic facts (with temporal profiles tracking when they were relevant and event structures showing causation) would improve retrieval and reduce context inflation. The GitOfThoughts copyability threshold (>0.8 similarity required) from prior triages may be bypassed by atomic-level storage: individual facts have cleaner retrieval signals than multi-sentence narratives.
- **Cross-references**: [GitOfThoughts (2606.14470) copyability threshold], [MemTrace (2606.17328) evidence-use gap], [GateMem (2606.18829) multi-principal memory], [Learning What to Remember (2606.12945) multi-factor value function]

---

## ★★★ [2606.19749] Benchmarking Agentic Review Systems

- **Source**: https://arxiv.org/abs/2606.19749
- **Published**: 2026-06-18
- **Summary**: Evaluates agentic paper review systems (OpenAIReview, coarse, Reviewer3) across six LLMs. Best: OpenAIReview + GPT-5.5 at 83.0% pairwise accuracy tracking paper quality. Error detection: 71.6% recall for best config. Key insight: **union of detections across six models reaches 83.3% recall** — different models detect different errors. User votes on deployed system skew 1.44:1 positive.
- **Key Finding**: The harness design (how reviews are structured, what the detection pipeline does) matters more than model choice. The 83.3% union-of-models vs 71.6% best-single-model gap (11.7pp) shows that model-diverse ensembles under the same harness catch complementary errors. This is the review/evaluation equivalent of StaminaBench's harness dominance finding.
- **Implication for Us**: Our evaluation system uses a single model per evaluation pass. The union-of-models result predicts that using diverse model calls (not just repeating the same model) would catch more quality issues. The 11.7pp gap is free improvement from diversity. This connects to NRT-Bench's finding (2606.20408) that agent vulnerabilities are nearly disjoint across models — the same principle applies to evaluation coverage.
- **Cross-references**: [KE-1984 Phantom Feedback Loop], [NRT-Bench (2606.20408) disjoint vulnerabilities], [Contagion Networks (2606.20493) evaluator bias propagation]

---

## Synthesis: The Contract Hierarchy

These papers collectively map a hierarchy of contract types in agent systems:

```
L4: Evaluation Contract (what counts as good)  ← Beyond Static Leaderboards, KE-1984
L3: Communication Contract (what agents tell each other)  ← EARS, Uncertainty Decomposition
L2: Tool Contract (what tools declare about themselves)  ← ContractGuard, ContractGuard
L1: Execution Contract (harness, guidance, scope)  ← Probe-and-Refine, StaminaBench
L0: Verification Contract (when to check vs proceed)  ← Human-on-the-Loop, StaminaBench
```

**The multiplier compounds across layers.** Probe-and-Refine shows L1 produces 14.5pp coverage improvement. StaminaBench shows L0 (test feedback) produces 12× improvement. EARS shows L3 produces 10.4pp pass rate improvement. ContractGuard shows L2 produces 0% residual attack success.

Our system currently has:
- **Strong L0** (verify-after-write pattern, test enforcement)
- **Weak L1** (static context files, guidance doesn't adapt)
- **No L2** (tools have implicit contracts only)
- **No L3** (agents don't communicate structured failure states)
- **Problematic L4** (KE-1984's phantom feedback loop)

**The cheapest intervention this batch suggests:** Apply probe-and-refine to our agent context files. Synthetically test whether agents can locate correct intervention sites given current guidance. Iteratively patch guidance until navigation coverage improves. Zero architecture change — just better L1 contracts.

---

## Deduplicated Paper IDs (for future collision checks)

2606.20512, 2606.19613, 2606.18550, 2606.18668, 2606.19704, 2606.19812, 2606.04455, 2606.19559, 2606.19847, 2606.19749
