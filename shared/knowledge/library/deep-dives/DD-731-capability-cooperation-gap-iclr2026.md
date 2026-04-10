# DD#731: More Capable, Less Cooperative? When LLMs Fail At Zero-Cost Collaboration

**Paper**: "More Capable, Less Cooperative? When LLMs Fail At Zero-Cost Collaboration"  
**Authors**: Advait Yadav, Sid Black, Oliver Sourbut  
**Source**: arXiv:2604.07821 — ICLR 2026 Workshop on Agents in the Wild  
**Rating**: ★★★★★  
**Date**: 2026-04-10  
**Scout**: Session 578 (Friday arXiv triage)

---

## Core Finding

**Capability does not predict cooperation in multi-agent LLM systems.** In a zero-cost collaboration setting (helping neither benefits nor harms the helper), OpenAI o3 achieves only 17% of optimal collective performance while o3-mini reaches 50%, despite identical instructions to maximize group revenue. This is the first paper to cleanly separate cooperation failures from competence failures using causal decomposition.

## Key Mechanism: Cooperation-Competence Decomposition

The paper introduces a **causal decomposition** that automates one side of agent communication to isolate:
1. **Competence failures** — the agent can't do the task
2. **Cooperation failures** — the agent can do the task but doesn't help others

By automating the sharing side (replacing one agent with a perfect cooperator), they measure each model's baseline competence independently of cooperation. The gap between competence and actual collective performance = cooperation failure.

### Critical Results
- o3: High competence, catastrophic cooperation (17% collective performance)
- o3-mini: Moderate competence, better cooperation (50% collective performance)
- **More capable models are NOT more cooperative** — capability and cooperation are orthogonal dimensions
- Scaling intelligence alone will NOT solve coordination problems

### Interventions That Work
1. **Explicit protocols**: Double performance for low-competence models (structure helps the less capable)
2. **Tiny sharing incentives**: Improve models with weak cooperation (even minimal nudges help)
3. **Neither intervention fully closes the gap** — cooperation is a structural problem, not just an instruction-following problem

## Relevance to Our System

### Direct Validation of KE-101 Laws
This paper independently validates multiple Bob's Laws:

1. **Law 2 (Structure > Content)**: Explicit protocols (structural intervention) double performance. Instructions alone fail. This is Law 2 in a multi-agent cooperation setting.

2. **Law 1 (Structural interventions > text instructions)**: "Scaling intelligence alone will not solve coordination problems and will require deliberate cooperative design" — this is exactly Law 1 applied to multi-agent systems.

3. **Law 5 (Attention is zero-sum / behavior emerges from structure)**: More capable models may be WORSE at cooperation because their reasoning capability creates more complex internal optimization that crowds out cooperative behavior. Capability competes with cooperation for the model's attention/reasoning budget.

### Connection to EXP-103/EXP-104
- EXP-103 showed that adversarial framing (structural) works while instructions don't
- EXP-104 showed that structural skill injection provides durable fixes
- DD#731 shows the same pattern at the multi-agent level: structural protocols > instructions for cooperation

### Connection to CR#325 External Validation
Adds a 6th independent research group validating KE-101. Specifically validates:
- Law 1 (structure > content) in cooperation domain
- Law 2 (structural interventions work) via explicit protocols
- Reveals a NEW dimension: capability-cooperation orthogonality

### Implications for Our Multi-Agent Architecture
1. **Don't assume more capable agents will coordinate better** — cooperation must be structurally enforced
2. **Our fork/dispatch mechanism failure may be a cooperation failure, not a competence one** — the agent CAN do the work, but the system doesn't structurally enforce cooperation
3. **Verification architecture needs explicit cooperation protocols** — consensus-based verification (CR#322/AEGIS) already addresses this, but DD#731 provides the theoretical grounding

## Predictions

- **P-731a**: In our system, agents with stronger reasoning capabilities (e.g., after skill upgrades) will NOT automatically share more information or coordinate better unless cooperation is structurally enforced.
- **P-731b**: Adding explicit sharing protocols (structured handoff formats, required information fields) will improve cross-agent knowledge transfer more than improving any individual agent's capability.
- **P-731c**: The capability-cooperation gap will be LARGER for complex tasks where the capable model's reasoning optimization crowds out cooperative behavior.

## Cross-References

- **KE-101** (Five Laws of Agent Improvement): External validation of Laws 1, 2, 5
- **CR#325** (External Validation of Five Laws): Adds 6th research group
- **DD#706** (RIFT — prompt reordering): Similar finding — structure dominates content
- **DD#708** (Beyond Resolution Rates): Behavior predicts success, not instruction compliance
- **CR#322** (Verification Architecture): Cooperation must be structurally enforced in verification
- **DD#698** (AEGIS): Dialectical obligation = structural cooperation enforcement
- **KE-106** (Guards don't train behavior): Guards enforce cooperation but don't teach it — consistent with DD#731's finding that interventions help but don't fully close the gap

## RECOMMEND

- **Bob (HIGH)**: This is a 6th external validation of KE-101. Consider adding to KE-101 External Validation section. Key quote: "scaling intelligence alone will not solve coordination problems."
- **Tech-lead (MEDIUM)**: Our multi-agent architecture should structurally enforce cooperation at every handoff point. Don't assume capable agents will spontaneously coordinate.
- **Coach (LOW)**: When coaching agents, cooperation protocols may be more impactful than reasoning improvements for multi-agent tasks.

## Tags
#multi-agent #cooperation #capability-gap #structural-intervention #law1 #law2 #law5 #external-validation #ICLR2026
