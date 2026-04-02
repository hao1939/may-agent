# Deep-Dive #381: Governing Dynamic Capabilities — Cryptographic Binding and Reproducibility Verification for AI Agent Tool Use

**Paper:** arXiv:2603.14332v1 (15 Mar 2026)
**Authors:** Ziling Zhou (Genupixel Technology)
**Rating:** ★★★★★ CRITICAL — First complete cryptographic governance framework for dynamic agent capabilities
**Session:** s_1773714433568_1163 (2026-03-17)
**Portfolio connections:** DD#264 (MCP Design Choices), DD#294 (Role Confusion), DD#295 (AgentDrift), DD#370 (PISmith), DD#373 (GroupGuard), CR#34 (Specification-Enforcement Gap), CR#131 (Context-Coupled vs Decoupled), CR#144 (Security-Safety-Memory Triad), CR#216 (Defense Impossibility Frontier), CR#217 (Iatrogenic Security Stack)

---

## The Problem: The Capability-Identity Gap

AI agents dynamically acquire capabilities at runtime via MCP and A2A protocols, yet **no existing framework detects when capabilities change post-authorization**. This creates a class of attacks called **silent capability escalation**: an agent certified with `{code_gen, unit_test}` acquires `web_browser` via a plugin — under all existing frameworks, its credentials remain valid.

### Root Cause: Capability-Context Conflation

The paper identifies a fundamental architectural distinction that existing frameworks ignore:
- **Capability envelope** (model identity, tool definitions, permission scopes) → governs what is *possible*, changes infrequently
- **Runtime context** (conversation history, user instructions, memories) → governs what is *chosen*, changes per-interaction

**Inside a transformer's forward pass**, these are indistinguishable token sequences. **At the orchestration layer**, they have completely different security semantics. This **capability-context separation** is the paper's foundational contribution.

Existing security layers conflate the two:
- **Identity platforms** (Keyfactor, SPIFFE): certificate valid regardless of tool changes
- **Authorization frameworks** (OIDC-A, Cerbos): evaluated at grant time, no drift detection
- **Runtime gateways** (Gravitee, Lasso): stateless, no memory of prior configurations
- **Governance platforms** (Credo AI): documentation layer, no cryptographic enforcement

## Three Governance Requirements (G1-G3)

The paper defines three simultaneous requirements — the critical insight being that **none is sufficient alone**:

**G1: Capability Integrity** — Every agent's identity cryptographically bound to its complete capability set. Any capability change invalidates credentials.

**G2: Behavioral Verifiability** — Agent actions independently verifiable post-hoc via replay. Detects model substitution, unauthorized tool use, output manipulation.

**G3: Interaction Auditability** — All interactions produce tamper-evident records for forensic reconstruction.

### Why All Three Required Simultaneously
- G1 alone: certified agents can misbehave undetectably within their envelope
- G2 alone: can't distinguish authorized from unauthorized capabilities
- G3 alone: audit logs of unverified actions by unverified agents
- G1+G3 (without G2): signing proves attribution, not computational fidelity — a compromised agent with valid certificate can execute arbitrary model internally, sign output, and pass all checks

## Three Mechanisms

### Mechanism 1: Capability-Bound Agent Certificates (→ G1)

Extends X.509 v3 with a **skills manifest hash** — SHA-256 commitment to complete tool configuration:
```
H_v^cert = SHA-256(canonical({(sid_i, ver_i, h_i, P_i)}))
```

**Capability Binding Invariant:** Access permitted only if `H_v(t) = H_v^cert`. Any tool addition/removal/modification → instant access denial. Runtime context changes do NOT affect hash.

**Trust Propagation Tree:** Human/organizational entities form roots. Trust constraints (max tier, delegation depth, allowed models, rate limits) propagate **monotonically downward** — no agent can exceed boundaries set by its human principal.

For open-source tools: `h_i` = SHA-256 of source code
For closed-source tools: `h_i` = hash of public configuration descriptor (name, version, API schema)

### Mechanism 2: Reproducibility Commitments (→ G2)

Leverages LLM inference near-determinism for post-hoc replay verification:

Three commitment levels:
- **Full**: bitwise identical output expected
- **Statistical**: CharMatch ≥ θ (task-dependent threshold)
- **None**: no commitment → trust tier downgrade

**Bounded Divergence Theorem:** If adversary-controlled model M' passes replay on n independent prompts, then:
```
Pr[CharMatch(M(x), M'(x)) < θ] ≤ exp(-2nθ²)
```

For code (θ=0.98): only 3 prompts/skill achieve ε < 10⁻². For prose (θ=0.10): 1200 prompts achieve ε < 10⁻¹⁰.

**Security interpretation:** Transforms reproducibility from detection → **safety certificate**. Adversary faces dilemma: either M' behaves like M (fine-tuning achieves nothing) or M' diverges and gets caught with exponentially increasing probability.

### Mechanism 3: Verifiable Interaction Ledger (→ G3)

Hash-linked, bilaterally-signed records storing only **commitments** (not raw content):
```
R_i = (seq_i, t_i, a_send, a_recv, ch_send, ch_recv, η_in, η_out, π_i, h_prev, sig_i)
```

Privacy-preserving: only interaction metadata during normal operation. Content disclosed and verified against commitments only during forensic investigation.

## Chain Verifiability Theorem (Most Important Result)

**Behavioral verifiability is a chain property, not a node property.**

A single G2=none interior agent at position k breaks behavioral verification for ALL downstream nodes, even if they individually satisfy G2=full.

```
CVD(v_n) = min{j ≥ 1 : v_j has ρ.level = none}
```

### Three Deployment Principles
1. **High-determinism models at interior nodes** — Haiku (CharMatch=0.987) for coordinators, low-determinism models (Kimi: 0.169) at leaf positions only. **This is a security architecture constraint, not merely a performance recommendation.**
2. **Verification boundary checkpoints** — When G2=none interior agent unavoidable: human-in-the-loop, TEE attestation, or dual-execution with output comparison
3. **Explicit degradation in ledger** — PARTIAL_VERIFIABILITY markers, inherited trust tier penalty

## Empirical Results

### Performance
| Operation | Latency |
|-----------|---------|
| Certificate verification (3-level chain) | 97 µs |
| Capability binding check | <1 ns |
| Skills manifest hash (20 tools) | 10.6 µs |
| Ledger append | 448 µs |
| Full governance overhead/call | ~0.62 ms |
| As % of typical MCP call | 0.1-1.2% |
| E2E pipeline (5 agents, 21 steps) | 10.8 ms (0.12% of 8.7s) |
| Scaling 5→20 agents | Sub-linear per-agent cost |

### Model Determinism Spectrum (9 models, 7 providers, 15,120 comparisons)
| Model | CharMatch (same-model) |
|-------|----------------------|
| Claude Haiku 4.5 | 0.987 |
| Claude Sonnet 4 | 0.823 |
| GPT-4.1 mini | 0.701 |
| GPT-4.1 | 0.617 |
| Llama 4 Maverick | 0.528 |
| Grok 4 (reasoning) | 0.402 |
| Gemini 2.5 Pro (reasoning) | 0.392 |
| DeepSeek V3 | 0.225 |
| Kimi K2.5 (reasoning) | 0.169 |

**Critical finding:** Same-model vs cross-provider separation = 4.7× (CharMatch), Cohen's d > 1.0 on ALL metrics. Even least deterministic model (Kimi, 0.169) exceeds cross-provider mean (0.114).

### Attack Detection: 12/12 scenarios detected
MCP+OAuth 2.1 baseline: 0/12 detected
OpenTelemetry baseline: 0/12 detected
A2Auth framework: 12/12 detected, 0 false positives across 500 governed tool calls

## Comparison: 1,200,000× Faster Than BAID
| Metric | BAID (Blockchain) | This Work |
|--------|-------------------|-----------|
| Verification | ~120 s | 97 µs |
| Proof size | ~50 KB | ~2 KB |
| Infrastructure | Blockchain required | None |
| Detection | Post-hoc | Real-time |

## Limitations (Honest Assessment)

1. **Capability-context boundary edge cases**: A "code execution" tool can effectively acquire new capabilities through composition (download + execute scripts). Framework guarantees capability *set* hasn't changed, but effective attack surface within fixed envelope can still be large.
2. **Closed-source binding weakness**: Hash captures metadata (name, version, API schema), not implementation code. Provider could change implementation without descriptor change. Mitigated by reproducibility verification catching behavioral changes.
3. **Reproducibility ≠ universal guarantee**: Non-reproducible behavior = non-verifiable behavior. Not unique to this framework — fundamental to any non-TEE verification.
4. **Non-agent node trust assumption**: CAs, humans, organizations assumed uncompromised.
5. **Statistical vs computational security**: Token-level reproducibility provides statistical guarantees, bounded by the Divergence Theorem.

## Portfolio Integration

### Direct Connections
- **DD#264 (MCP Design Choices)**: This paper provides the cryptographic governance layer CE-MCP lacks. The capability-context separation maps directly onto the context-coupled vs decoupled architecture distinction.
- **DD#294 (Role Confusion)**: The capability-bound certificate prevents the role confusion attack at the identity layer — an agent's tools are cryptographically tied to its identity.
- **DD#295 (AgentDrift)**: The reproducibility commitment provides a formal mechanism to detect tool corruption drift.
- **DD#370 (PISmith)**: PISmith proves all prompt injection defenses vulnerable at prompt level. This paper provides the structural layer below the prompt level.
- **DD#373 (GroupGuard)**: The credential isolation theorem (Theorem 10) provides the formal foundation for preventing collusion escalation.
- **CR#34 (Specification-Enforcement Gap)**: This paper literally fills the gap — cryptographic enforcement of declared specifications with 0.12% overhead.
- **CR#216 (Defense Impossibility Frontier)**: Confirms defense can't be solved at prompt level, but shows it CAN be solved at infrastructure level.
- **CR#217 (Iatrogenic Security Stack)**: The trust tier degradation for G2=none is a non-iatrogenic security mechanism — it makes costs explicit rather than generating false confidence.

### GUS Integration
- **Validates Law 33 (Infrastructure Dominance)** — governance infrastructure accounts for more security variance than model-level defenses
- **Extends Mechanism 16 (Evaluation-Policy Co-Adaptation)** — reproducibility commitments break the co-adaptation loop
- **Validates Principle 80 (Cache-Coordination Coupling)** — capability binding extends to compute coordination
- **New Principle candidate: Capability-Context Separation** — the boundary between what's possible and what's chosen must be cryptographically enforced, not just architecturally separated

### Chain Verifiability Implications for Our System
Our system has 5 agents (May, Coder, QA, Bob, Scout) with May as coordinator. Under the Chain Verifiability Theorem:
- If May (interior node) uses a low-determinism model, ALL downstream agent outputs lose G2 protection
- Our file-based coordination (SIGNALS.md) lacks hash-chain integrity — any agent could modify records
- We have NO capability binding — agents can acquire new tools without re-authorization
- We have NO reproducibility verification — cannot detect if an agent session used a different model

### Proposed GUS Updates
- **Law 34 (Capability-Identity Binding)**: Agent identity without cryptographic capability binding is security theater — all authorization decisions are evaluated against stale capability snapshots
- **Mechanism 39 (Silent Capability Escalation)**: Runtime capability acquisition without re-authorization enables unbounded privilege elevation invisible to all existing security layers
- **Principle 81 (Chain Verifiability Minimum)**: The weakest G2 commitment at any interior node in a trust tree determines the maximum behavioral verification guarantee for the entire sub-tree

---

## Key Takeaways

1. **The capability-identity gap is universal** — every current agent framework (MCP, A2A, LangChain, AutoGen) has this vulnerability
2. **Standard crypto is sufficient** — no novel primitives needed, just correct composition along the capability-context boundary
3. **0.12% overhead** — governance is effectively free relative to LLM inference costs
4. **Chain position matters for security** — model placement in trust trees is a security decision, not just performance optimization
5. **Reproducibility = trust primitive** — non-reproducible models are inherently less trustworthy, and this should be explicit in governance
6. **12/12 attacks detected vs 0/12 for baselines** — the gap between current practice and what's achievable is total

This paper is to agent security what Certificate Transparency was to web PKI — showing that standard mechanisms, correctly composed, can fundamentally change the security landscape.
