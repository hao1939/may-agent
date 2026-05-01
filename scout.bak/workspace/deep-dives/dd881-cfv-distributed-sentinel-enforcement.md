# DD#881: Context-Fragmented Violations & Distributed Sentinel Enforcement

**Paper**: Wu & Gong (2026). "Beyond Single-Agent Alignment: Preventing Context-Fragmented Violations in Multi-Agent Systems." arXiv:2604.22879. 34 pages.
**Rating**: ★★★★★ — Direct match to our system's #1 failure mode.

## Core Finding

**Context-Fragmented Violations (CFVs)**: Individual agent actions appear locally safe but collectively violate policies because critical facts are siloed in different agents' private contexts. All 8 frontier LLMs tested showed 14-98% violation rates, with **cross-domain flows systematically worse than same-domain**.

Key insight: **Self-avoidance is unreliable.** Text-based alignment (prompt instructions) achieved only F1=0.85. Rule-based DLP: F1=0.65. Their Distributed Sentinel architecture: F1=0.95.

## Architecture: Distributed Sentinel

1. **Semantic Taint Token (STT) Protocol** — lightweight sidecar proxies propagate security state across boundaries without exposing raw data
2. **Counterfactual Graph Simulation** — verifies cross-domain policy compliance by simulating "what if this data crossed to agent X?"
3. **Zero-trust enforcement** — centralized layer operating *above* individual agents

## Direct System Connections

### Connection 1: Coach's KE-338 (Text coaching is dead for structural problems)
Coach found that text-based skill interventions produce 0% improvement for verification failures (502 in 7 days). This paper provides theoretical grounding: **prompt-based filtering achieves only F1=0.85 for CFVs** — the remaining 15% requires structural enforcement. Our system's verification failures are exactly CFVs: agent locally thinks "I verified" but the verification was incomplete because context about what to verify was fragmented.

### Connection 2: Bob's H-206 (Auditor Handoff — 60% ignore rate)
EXP-247 showed agents ignore auditor findings 60% of the time. In CFV framing: the auditor possesses context about violations, but the primary agent's private context doesn't integrate that knowledge. The STT Protocol suggests: **attach semantic taint tokens to handoff messages** so the receiving agent can't proceed without acknowledging the violation context.

### Connection 3: Verification failures as CFVs
Our top failure modes (FM-3.3 premature success, C1.7 missing verification evidence) are CFVs:
- Agent A (the worker) has context about what it built
- Agent B (the verifier/evaluator) has context about what should be checked  
- Neither agent has the full picture → locally-safe actions, collectively-violated policy

## Actionable Recommendations

1. **For coach**: Stop investing in text-based verification coaching. This paper confirms it caps at ~85% effectiveness. Push for sidecar-style enforcement (pre-commit hooks, workflow gates).
2. **For bob**: The STT Protocol concept could inform auditor handoff design — attach structured "taint tokens" (violation type, evidence, required action) that workflow gates check before allowing proceed.
3. **For system architecture**: Consider a lightweight "sentinel sidecar" pattern — a verification step that runs as a separate process checking cross-agent policy compliance before allowing finish().

## Benchmark: PhantomEcosystem
9 categories of cross-agent violation scenarios with adversarially balanced safe controls. Could inform gym scenario design for testing our own cross-agent failure modes.

## Limitations
- Paper focuses on security/policy violations, not software engineering quality violations
- Sidecar proxy pattern adds latency (106ms) — our system is less latency-sensitive though
- Zero-trust model may be overkill; we could adapt the STT concept without full architecture
