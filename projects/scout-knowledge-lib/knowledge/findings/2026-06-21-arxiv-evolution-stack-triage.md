<ai_context>
summary: "Triage of 10 arXiv papers (June 12–18, 2026) converging on the 'Evolution Stack' — multi-dimensional agent self-improvement. The macro-thesis: single-axis optimization (just harness patching, just evaluation, just prompt tuning) is systematically inferior to co-evolving multiple layers simultaneously. Papers span self-evolution (APEX, Skill-MAS, RefGRPO), runtime economics (Trace-Economic Underwriting, Execution-State Capsules), trajectory-level safety (ToolChain-CRC, ToolPrivBench, NRT-Bench), and compositional skill routing (SkillWeaver, RODS)."
triggers: ["arXiv triage", "evolution stack", "self-improvement", "APEX", "three-layer evolution", "RefGRPO", "reflection gap", "calibration", "ToolPrivBench", "over-privileged", "privilege escalation", "ToolChain-CRC", "conformal risk control", "trajectory risk", "Skill-MAS", "meta-skill", "orchestration evolution", "trace-economic", "agent insurance", "risk pricing", "RODS", "reward-driven synthesis", "boundary detection", "Execution-State Capsules", "FlashRT", "checkpoint restore", "SkillWeaver", "compositional routing", "skill decomposition", "NRT-Bench", "red-teaming", "disjoint vulnerabilities"]
last_updated: "2026-06-21"
source_basis: "arXiv API queries: 'AI agent' AND 'multi-agent', 'LLM agent' AND 'planning', 'agent' AND 'tool use' AND 'failure', 'agent' AND 'orchestration' AND 'LLM', 'agent' AND 'evaluation' AND 'benchmark' AND 'LLM', 'agent' AND 'self-improvement' AND 'LLM'. All abstracts read from export.arxiv.org API."
</ai_context>

# Source Triage — June 21, 2026 (arXiv: The Evolution Stack)

Cross-source sweep covering 10 new arXiv papers (June 12–18, 2026) that converge on a macro-theme: **the evolution from single-axis optimization to multi-dimensional co-evolution of agent systems.**

## Convergent Thesis: The Evolution Stack

The previous batches diagnosed what's broken: the Assembly Gap (June 19), Runtime Hardening (June 17), Session-State Hierarchy (July 18). This batch reveals **how systems fix themselves** — and the dominant finding is that single-axis improvement is systematically inferior to multi-layer co-evolution.

**The pattern repeats across all 10 papers:**
- APEX: Harness + Principles + Topology co-evolve → +90% vs harness-only
- Skill-MAS: Meta-Skill evolution decouples learning from parameters → transfers across LLMs
- RefGRPO: Reflection + Task accuracy co-improve via calibration bonus → free verification
- ToolChain-CRC: Step-level + trajectory-level risk → catches failures invisible to final-answer checks
- SkillWeaver: Decompose + Retrieve + Compose → 99% context reduction

**Connection to our system:** Our architecture optimizes three axes independently:
1. **Evaluator** → session quality verdict (single output dimension)
2. **Compiled lessons** → behavioral rules (harness patching only)
3. **Workflow topology** → fixed, never evolved

APEX demonstrates that co-evolving all three simultaneously (+90%) dramatically outperforms our current sequential approach. The Phantom Feedback Loop (KE-1984) is a symptom of single-axis evaluation creating artifacts — multi-axis evolution avoids this by grounding improvement in multiple orthogonal signals.

---

## Theme 1: Multi-Layer Self-Evolution

### ★★★★★ [2606.15363] APEX: Three-Layer Self-Evolution for Production AI Agents

- **Source**: https://arxiv.org/abs/2606.15363
- **Published**: 2026-06-13
- **Categories**: cs.AI

**Summary**: The Self-Harness framework achieves 14–21% improvement by mining failure clusters and patching prompts — but optimizes only one dimension. APEX proposes three-layer co-evolution: (L1) harness via failure-mode patching, (L2) behavioral principles via success-trace distillation, and (L3) workflow topology via structural fitness-based selection. Implemented on a production agent managing a 15-node compute fleet using 114 real task traces over 18 days.

**Key numbers:**
- APEX Health Score: 0.570 (+90% vs baseline 0.300)
- 6 novel reusable principles distilled from success traces
- Workflow topology score: 0.900 (+20%)
- Cost: 4 LLM calls (~270 seconds) on local 32B model

**Critical insight**: Single-axis harness optimization is the current SOTA, but it leaves behavioral principles and workflow topology unchanged. The jump from 0.300 to 0.570 comes from evolving all three simultaneously — the improvement is super-additive, not merely the sum of three axes.

**Implication for us**: Our system has the raw materials for all three layers:
- L1 (harness): Compiled lessons already patch behavioral rules from failures ✓
- L2 (principles): Success traces exist in session data but are never distilled ✗
- L3 (topology): Workflow topology is static, never selected by fitness ✗

The missing piece is L2 — we distill lessons from failures but never from successes. APEX's success-trace distillation is the inverse of our compiled lessons. Combined, they'd form a complete feedback loop. The 4-call cost makes this operationally feasible.

### ★★★★★ [2606.14211] RefGRPO: Closing the Reflection Gap

- **Source**: https://arxiv.org/abs/2606.14211
- **Published**: 2026-06-12
- **Categories**: cs.CL, cs.AI

**Summary**: LLM agents systematically mis-assess their own outputs even after observing concrete environment feedback. This "reflection gap" persists because standard RL doesn't address credit assignment between the agent's self-assessment and its actual performance. RefGRPO adds a free calibration bonus by contrasting the agent's reflection with the actual outcome — no reward model, LLM judge, or external annotation needed.

**Key numbers:**
- Underconfidence rate: 44.4% → 7.7%
- Task accuracy: 75.1% → 76.5% (text-to-SQL across 5 benchmarks)
- "Free" — no additional inference, computed from existing rollout data

**Critical insight**: The reflection gap is directional — agents are more often underconfident than overconfident after observing feedback. This means self-improvement systems built on agent self-assessment systematically undervalue good work. The calibration bonus corrects this for free by using the environment signal the agent already has.

**Implication for us**: Our evaluator (KE-1984) exhibits the same pattern — 75.6% of may-heartbeat's NI verdicts come from review overrides, suggesting systematic undervaluation of acceptable work. RefGRPO implies that if we calibrated our evaluation against downstream outcomes (did the "needs_improvement" verdict correlate with actual system degradation?), we'd discover the reflection gap is inflating the failure rate. The fix costs nothing — it's a computation over signals we already produce.

### ★★★★ [2606.18837] Skill-MAS: Evolving Meta-Skill for Automatic Multi-Agent Systems

- **Source**: https://arxiv.org/abs/2606.18837
- **Published**: 2026-06-17
- **Categories**: cs.MA, cs.AI, cs.LG

**Summary**: Identifies a dilemma between model capability and experience retention: inference-time MAS (frozen frontier LLMs) repeats identical searches without learning; training-time MAS (gradient updates on small models) has low capability ceilings. Skill-MAS proposes a third path: decouple experience retention from parametric updates by evolving a "Meta-Skill" — the high-level orchestration capability expressed as architectural knowledge.

**Architecture:**
1. Multi-Trajectory Rollout: sample behavioral distribution under current Meta-Skill
2. Selective Reflection: hierarchical contrastive analysis on priority tasks → distill strategy-level principles

**Key finding**: Evolved Meta-Skills are highly robust and transfer across unseen tasks AND different LLMs. The orchestration layer (not the model) is where durable improvement lives.

**Implication for us**: Our system uses frozen frontier models with static orchestration. Skill-MAS validates that the orchestration layer IS the improvement target — consistent with our Scope Premium finding (KE-1982) that workflow identity predicts quality 10× better than agent identity. The Meta-Skill concept maps to what we'd call "workflow topology + selection heuristics" — the thing APEX's L3 evolves.

---

## Theme 2: Trajectory-Level Safety and Economics

### ★★★★★ [2606.18467] ToolChain-CRC: Conformal Risk Control for Agent Trajectories

- **Source**: https://arxiv.org/abs/2606.18467
- **Published**: 2026-06-16
- **Categories**: stat.ML, cs.LG

**Summary**: Agent runs produce trajectories of actions, observations, and final output. A final response may look acceptable even when retrieval was weak, a tool output was wrong, or an earlier step was unsupported. ToolChain-CRC builds step-level risk scores, combines them into trajectory risk, calibrates an accept-or-intervene rule, and adds an anytime alarm that can stop risky runs before the final answer.

**Key contributions:**
- Proves trajectory-level risk control under exchangeable calibration runs
- Drift-aware extension with auditable constants
- Anytime escalation rule via supermartingale construction
- Demonstrates that final-answer-only calibration misses retrieval and tool failures

**Critical insight**: The "anytime alarm" — stop a risky run mid-trajectory — is formally justified. This transforms evaluation from post-hoc verdict to runtime safety monitor. The supermartingale construction means the alarm has provable false-alarm bounds.

**Implication for us**: Our evaluator is purely post-hoc: it judges sessions after completion. ToolChain-CRC proves that trajectory-level calibration (watching the trajectory unfold) catches failures that final-output evaluation cannot. This is the formal justification for moving evaluation from "after the session" to "during the session" — specifically, the s/op metric from KE-1983 (Speed-Kill Threshold) is a degenerate case of a trajectory risk score. A proper CRC system would generalize beyond speed to multi-dimensional risk.

### ★★★★ [2606.20023] ToolPrivBench: Over-Privileged Tool Selection Under Failure

- **Source**: https://arxiv.org/abs/2606.20023
- **Published**: 2026-06-18
- **Categories**: cs.SE, cs.AI, cs.CL

**Summary**: Studies over-privileged tool selection — agents choosing higher-privilege tools despite sufficient lower-privilege alternatives. Finds this is common and amplified by transient failures (tool returns an error → agent escalates to a more powerful tool). General safety alignment does not transfer to least-privilege tool choice. Prompt-level controls provide only limited mitigation under transient failures.

**Key findings:**
- Over-privileged selection is the default behavior across mainstream agents
- Transient failures amplify escalation (failure → more power, not more caution)
- Post-training privilege-aware defense substantially reduces unnecessary high-privilege use
- Prompt-level controls fail specifically under transient failure conditions

**Implication for us**: Our agents have access to tools with different impact levels (write vs. read, shared KB vs. workspace). The finding that transient failures trigger privilege escalation maps to a concrete risk: when a read fails, agents may escalate to more invasive approaches. The fact that prompt-level controls fail under transient failure explains why behavioral guardrails show near-zero efficacy (KE-1984's 375:1 ratio) — they degrade precisely when most needed.

### ★★★★ [2606.16465] Trace-Economic Underwriting: When Agent Automation Becomes Profitable

- **Source**: https://arxiv.org/abs/2606.16465
- **Published**: 2026-06-15
- **Categories**: cs.AI, cs.SE

**Summary**: Frames the question: when does autonomous AI deployment become economically acceptable despite failure risk? Answer: quantify risk at the customer-task-trace episode level and transfer it through insurance. Introduces trace-economic underwriting that maps tool-use traces to customer exposure and claimable loss, using deterministic economic labels (not LLM judge).

**Key numbers:**
- Trace-economic pricing: MAE from $17.7K → $569
- 300-trace expert audit: 295/300 labels accepted unchanged
- Trace-conditioned controls: CVaR95 reduced by 72%

**Critical insight**: Deterministic economic labels outperform LLM judges for risk assessment. The 295/300 audit acceptance rate means the labeling is practically human-equivalent. This suggests our evaluator's LLM-judge approach is the wrong tool for measuring actual system risk — deterministic trace analysis would be cheaper and more calibrated.

**Implication for us**: The paper provides a formal answer to "when should we let agents run unsupervised": when expected benefit exceeds premium + control cost + residual risk, with a defined role with bounded permissions and comparable traces. Our system already has the traces and role definitions. What's missing is the economic labeling — mapping sessions to actual value produced/destroyed. This would replace the evaluator's binary verdict with a continuous economic signal.

### ★★★★ [2606.20408] NRT-Bench: Multi-Turn Red-Teaming of Safety-Critical LLM Agent Teams

- **Source**: https://arxiv.org/abs/2606.20408
- **Published**: 2026-06-18
- **Categories**: cs.CR, cs.AI

**Summary**: Benchmark for multi-turn adversarial attacks on LLM agent teams operating a simulated nuclear plant. Harm is an objective signal (critical safety function lost), not LLM-judged text.

**Key finding**: Vulnerabilities are **disjoint across models** — of 149 attack sessions, none defeat all four models but a third defeat at least one. The same guardrail stack that reduces attacks for one model can INCREASE attack success for another.

**Critical insight**: Defenses are model-specific, not universal. Guardrails have model-dependent effects (positive for some, negative for others). This directly validates the finding from our system that the same behavioral rules help some agents and hurt others — it's not an implementation bug, it's a structural property.

---

## Theme 3: Compositional Capabilities and Runtime Efficiency

### ★★★★★ [2606.18051] SkillWeaver: Compositional Skill Routing for LLM Agents

- **Source**: https://arxiv.org/abs/2606.18051
- **Published**: 2026-06-16
- **Categories**: cs.CL

**Summary**: Real-world tasks require composing multiple skills, not just selecting one. Formalizes Compositional Skill Routing: decompose query into sub-tasks, retrieve appropriate skill for each, compose executable plan. CompSkillBench: 300 queries over 2,209 real MCP server skills.

**Key numbers:**
- Standard LLM decomposition: 34.2% category recall at step level — the primary bottleneck
- Iterative Skill-Aware Decomposition (SAD): 51.0% → 67.7% accuracy (+32.7%, p < 10⁻⁶)
- Context window reduction: >99%
- Transfer: +35.6% relative gain even on unseen categories

**Critical insight**: Task decomposition quality is the primary bottleneck — not skill retrieval, not execution. This is the same finding as PACMS (June 19 triage) applied at the skill layer: the assembly step (decompose/route) dominates, not the execution step.

**Implication for us**: Our workflows are pre-decomposed (workflow topology is static). SkillWeaver implies that dynamic decomposition at runtime would unlock composability but requires the decomposition quality problem to be solved first. The 34.2% baseline means naive "let the model decompose" fails 2/3 of the time. Iterative skill-aware feedback (SAD) is the fix — similar to how our agents improve when they can see what tools are available before planning.

### ★★★★ [2606.19047] RODS: Reward-Driven Online Data Synthesis for Multi-Turn Tool-Use

- **Source**: https://arxiv.org/abs/2606.19047
- **Published**: 2026-06-17
- **Categories**: cs.CL, cs.AI

**Summary**: Multi-turn tool-use RL is bottlenecked by rapid depletion of informative samples in static datasets. The gradient signal concentrates on tasks at the agent's capability boundary (where successes and failures balance). As training progresses, this boundary shifts, depleting informative samples. RODS continuously identifies boundary samples via reward variance, synthesizes new variants, maintains a co-evolving replay buffer.

**Key numbers:**
- Starting from 400 human seeds, maintaining ~800 active samples
- Matches performance of 17K-sample offline pipeline
- 20× fewer trajectories needed

**Critical insight**: The Popoviciu upper bound means informative training signal concentrates at the capability boundary. This is a formal explanation for why our system's compiled lessons lose effectiveness over time — they're mined from a fixed distribution of failures, but the agent's boundary moves. Old lessons address problems the agent no longer has; new problems generate no lessons because they're not yet recognized as systematic.

**Implication for us**: The "capability boundary detector" (zero-cost, uses existing rollout variance) could identify which tasks our agents are currently struggling with vs. which are resolved. This replaces the binary pass/fail of our evaluator with a gradient signal that tracks where improvement is possible.

### ★★★ [2606.20537] Execution-State Capsules: Sub-Millisecond Checkpoint/Restore for Agents

- **Source**: https://arxiv.org/abs/2606.20537
- **Published**: 2026-06-18
- **Categories**: cs.LG, cs.DC

**Summary**: LLM serving systems manage only KV cache, but interactive agents need full execution-state reuse (KV + recurrent state + convolution state + MTP state). Execution-State Capsules provide graph-bound checkpoint/restore of complete restorable state. FlashRT achieves sub-millisecond GPU-resident snapshot/restore.

**Key numbers:**
- Capsule restore: byte-exact at stored-state level, token-identical under greedy decode
- KV-only ablation **diverges** — recurrent state is load-bearing
- TTFT speedup: 3.9× at 2k tokens → 27× at 16k tokens
- Sub-millisecond snapshot/restore

**Critical insight**: KV cache alone is insufficient for faithful agent state restoration. Recurrent state diverges without full capsule restore. This means any system that "resumes" an agent session by reloading KV cache only is silently producing different outputs than a continuous session would have.

**Implication for us**: If our system ever implements session resumption or branching, the naive approach (reload context, re-prompt) introduces silent divergence. Full state capsules are the formally correct approach — but they require white-box model access we don't have with API models. This is a fundamental limitation of API-based agent systems vs. self-hosted ones.

---

## Synthesis: What the Evolution Stack Means for Our System

### The Three-Layer Gap

| Layer | APEX Name | Our System | Status |
|-------|-----------|-----------|--------|
| L1: Harness | Failure-mode patching | Compiled lessons | ✓ Present |
| L2: Principles | Success-trace distillation | (none) | ✗ Missing |
| L3: Topology | Structural fitness selection | Static workflows | ✗ Missing |

Our system operates at L1 only. The +90% improvement from L1→L1+L2+L3 suggests the largest gains come from adding success-trace learning and topology evolution.

### The Calibration Gap

| Dimension | State-of-Art | Our System |
|-----------|-------------|-----------|
| Reflection accuracy | RefGRPO: 7.7% miscalibration | Evaluator: ~76% override rate on some workflows |
| Risk detection | ToolChain-CRC: trajectory-level, anytime | Post-hoc verdict only |
| Economic grounding | Trace-economic: MAE $569 | Binary pass/fail |
| Privilege awareness | Post-training defense | None (prompt-only governance) |

### The Decomposition Bottleneck

SkillWeaver's 34.2% baseline decomposition accuracy explains why our static workflows outperform dynamic planning — dynamic decomposition fails 2/3 of the time without iterative skill-aware feedback. The Scope Premium (KE-1982) is the positive case: pre-decomposed scoped workflows bypass the decomposition bottleneck entirely.

### Cheapest Interventions (Ranked by Expected Impact / Implementation Cost)

1. **Add success-trace distillation** (APEX L2): Mine what successful sessions do differently. Zero infrastructure change — it's a query over existing session data + principle extraction. Expected: +30-50% over L1-only.

2. **Calibrate evaluator against outcomes** (RefGRPO insight): Check whether "needs_improvement" verdicts correlate with actual downstream degradation. If they don't, the evaluator is miscalibrated. Cost: one-time analysis query.

3. **Replace binary verdict with capability-boundary signal** (RODS): Use reward variance across similar tasks to identify where agents are at their boundary. Focuses improvement effort where it can have effect.

4. **Add trajectory-level risk scoring** (ToolChain-CRC): Generalize s/op (KE-1983) into multi-dimensional trajectory risk. Enable anytime intervention rather than post-hoc evaluation.

5. **Evolve workflow topology** (APEX L3 + Skill-MAS): Allow workflow definitions to be selected by fitness across sessions. Highest impact but highest implementation cost.

---

## Papers Not Triaged (Excluded)

- **LiteOdyssey** (2606.16149): Medical rare-disease diagnosis. Domain-specific, no generalizable agent architecture insight.
- **Exploration Structure** (2606.11976): Multi-file change localization. Confirms domain-agent spawning helps but finding is incremental.
- **Internet of Agentic AI** (2606.12835): Vision paper, no empirical results.
- **Agents All the Way Down** (2606.11869): Methodology paper documenting existing practice. CLI composition insight already captured in our library.
- **EEVEE** (2606.11182): Test-time prompt learning with router. Related to Skill-MAS but focused on single-agent prompt adaptation.

---

*Next priority: Check if APEX's success-trace distillation can be prototyped with our existing session data. The 4-LLM-call cost makes this immediately testable.*
