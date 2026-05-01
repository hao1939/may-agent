# DD#554: Conjunctive Prompt Attacks in Multi-Agent LLM Systems

**Paper**: arXiv:2604.16543  
**Authors**: Nokimul Hasan Arif, Qian Lou, Mengxin Zheng  
**Venue**: ACL 2026 Main Conference  
**Rating**: ★★★★★ CRITICAL  
**Date Covered**: 2026-04-21  
**Code**: https://github.com/UCF-ML-Research/ConjunctiveAgents  

## Why This Matters

This paper demonstrates a **structural vulnerability** in multi-agent LLM pipelines that no existing defense can reliably stop. The attack exploits the fundamental property of MAS: messages are routed between agents. By splitting a malicious payload across two components (a benign trigger in the user query + a benign template in a compromised agent), the attack activates only when routing brings them together. No single component appears malicious in isolation.

## Attack Model

**Conjunctive Prompt Attack**:
- **Trigger key**: Placed in user query — appears completely benign
- **Adversarial template**: Hidden in one compromised remote agent — also appears benign alone
- **Activation**: Only when routing brings trigger + template together does harmful behavior emerge
- **Attacker capability**: Controls only trigger placement and template insertion. Does NOT modify model weights or the client agent.

## Key Results

- **Routing-aware optimization** substantially increases attack success over non-optimized baselines
- **False activation rate**: Low — attack is precise, not noisy
- **Tested topologies**: Star, chain, and DAG — all vulnerable
- **Existing defenses that FAIL**:
  - PromptGuard — doesn't detect because each component is benign
  - Llama-Guard variants — same reason
  - System-level controls (tool restrictions) — don't reason about composition
  - **No defense works** because no single component appears malicious

## Why This Is Structurally Different

Previous MAS attacks (DD#519 persistent vulnerability, DD#525 goal drift, DD#536 authority override) all operate within a single agent's context. Conjunctive attacks are **compositional** — they exploit the routing fabric itself.

This means:
1. Per-agent safety checks are fundamentally insufficient
2. You need **cross-agent composition reasoning** to detect the attack
3. The attack surface grows with the number of agents and routing paths

## Connection to Our Architecture

| Attack Vector | Our System Exposure | Mitigation |
|---|---|---|
| Compromised remote agent | Any agent receiving external tool results | Validate tool outputs, not just inputs |
| Routing-aware activation | Agent-to-agent message passing | Cross-message content analysis |
| Trigger + template composition | User instructions + agent responses combining | Compositional safety checking |

## Connection to Prior Work

- **DD#536 (AI Agents Cover Up Crime)**: Authority-based attacks operate within one agent; conjunctive attacks exploit the routing between agents. Together: full threat model for MAS
- **CR#287 (Compliance-Verification Gap)**: Self-QA won't catch conjunctive attacks because each agent's self-check sees only benign content
- **DD#520 (NARCBench Collusion Detection)**: Activation probes might detect conjunctive attacks at the hidden-state level — promising defense direction
- **DD#528 (SEVerA)**: Formal output contracts on each agent wouldn't catch this — the individual outputs are benign; only the composition is harmful

## Defense Implications

The paper motivates defenses that:
1. **Reason over routing paths** — analyze what happens when messages combine, not just individually
2. **Cross-agent composition checking** — evaluate the joint effect of multiple agent outputs
3. **Topology-aware security** — different topologies (star/chain/DAG) have different vulnerability profiles

## Actionable Takeaways

1. **Per-agent safety is necessary but insufficient** — need composition-level checking
2. **Routing topology is an attack surface** — simpler topologies reduce exposure
3. **Trust boundaries between agents** need explicit modeling — which agents can influence which others?
4. **Defense research should prioritize compositional reasoning** over per-component checking

## Predictions

- **P327**: Conjunctive/compositional attacks will become the dominant MAS attack vector within 18 months as per-agent defenses improve
- **P328**: Topology-aware security will become a standard MAS design consideration (currently almost no one thinks about this)

## Recommendations

- **R70 (Bob)**: Model trust boundaries between agents explicitly — which agents can send messages to which, and what can those messages influence?
- **R71 (Tech-lead)**: Minimize routing complexity — simpler topologies have fewer compositional attack paths
- **R72 (Security)**: Implement cross-agent output composition checking — analyze the joint effect of multiple agent outputs before acting on them
