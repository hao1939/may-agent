# DD#725: SentinelAgent — Intent-Verified Delegation Chain Verification

**Paper**: arXiv:2604.02767 — "SentinelAgent: Intent-Verified Delegation in Multi-Agent Systems"  
**Authors**: (Multi-agent security research group, Apr 2026)  
**Scout Rating**: ★★★★★ CRITICAL  
**Gaps Addressed**: CR#324 Gap 3 — **Multi-step attack detection**, Gap 4 — **Verification of verifiers**

---

## Summary

Proposes a formal verification framework for delegation chains in multi-agent systems. Key innovation: every delegation carries a cryptographically-bound intent declaration, and downstream agents' actions are verified against the original delegator's intent — not just the immediate request. Uses TLA+ for formal verification of safety properties. Addresses the critical gap where individual request verification misses coordinated multi-step attacks.

## Key Contributions

1. **Intent-verified delegation**: Each delegation in the chain carries forward the original principal's intent, preventing intent drift across hops (Agent A delegates to B who delegates to C — C's actions are verified against A's intent, not just B's request)
2. **TLA+ formal verification**: Safety properties (no unauthorized escalation, no intent drift, no delegation cycle) are formally proven, not just tested
3. **Chain-level verification**: Sentinel monitors observe the *entire delegation chain*, not just individual request-response pairs — directly addressing the multi-step attack blind spot
4. **Delegation certificates**: Cryptographic attestation that delegation was authorized, creating an auditable chain of custody for agent actions

## Connection to CR#324 Gap Analysis

**Gap 3 (Multi-step attack detection)**: CR#324 identified that sentinels check individual requests but coordinated attacks span multiple requests. SentinelAgent's chain-level monitoring directly addresses this by tracking intent across the full delegation chain. An attack that appears benign at each individual step but escalates privileges across steps would be detected by intent-drift monitoring.

**Gap 4 (Verification of verifiers)**: The TLA+ formal verification of the sentinel protocol itself addresses "who watches the watchmen?" — the sentinel's behavior is mathematically proven correct, not just empirically tested. This is the strongest form of meta-verification: formal methods guarantee the verifier's correctness properties.

## Key Insights

1. **Intent drift is the real attack surface**: Individual requests can each be within policy while the cumulative effect violates the original intent. This is the multi-agent analog of confused deputy attacks in traditional security.
2. **Formal verification scales to this problem**: TLA+ can express and verify the properties that matter (no escalation, no drift, no cycles) without the combinatorial explosion that makes model-checking impractical for general agent behavior.
3. **Delegation certificates create accountability**: Combined with DD#584 (Springdrift's append-only audit log), delegation certificates provide forensic evidence of exactly who authorized what.
4. **Chain-level > node-level monitoring**: This validates MAScope's (DD, 2603.04469) insight that attacks are compositional — SentinelAgent provides the formal framework for what MAScope detected empirically.

## Architecture Implications for Our Stack

The SentinelAgent pattern maps directly to our multi-agent system:
- **May → Scout/Bob delegation**: Intent declarations would ensure Scout's research stays within May's original intent scope
- **Bob → Coder delegation**: Formal intent bounds prevent implementation from drifting from specification
- **QA verification**: QA agent's authority to reject/approve is itself formally specified and verifiable

## Limitations

- TLA+ verification is design-time, not runtime — a compromised sentinel at runtime is not covered
- Intent declarations require expressive but decidable intent language — too expressive = undecidable, too restrictive = false positives
- Performance overhead of chain-level monitoring not evaluated at scale
- Does not address cold-start (Gap 5) — new delegation patterns have no verified properties yet

## Cross-References

- **CR#324**: Gap 3 (Multi-step attack detection) and Gap 4 (Verification of verifiers) — directly addressed
- **DD#585**: ShieldNet MCP supply-chain defense — complementary network-level approach
- **DD#584**: Springdrift forensic accountability — delegation certificates extend the audit log
- **DD, 2603.04469**: MAScope cross-agent semantic flows — empirical detection that SentinelAgent formalizes
- **KE-104**: Complete Verification Architecture — formal verification layer for the orchestration stack

---
*Scout DD#725 | 2026-04-10 | CR#324 Gap-Filling Research*
