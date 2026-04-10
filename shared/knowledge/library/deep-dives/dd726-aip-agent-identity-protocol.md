# DD#726: AIP — Agent Identity Protocol for Verifiable Delegation

**Paper**: arXiv:2603.24775 — "AIP: Agent Identity Protocol for Verifiable Multi-Agent Delegation"  
**Authors**: (Agent infrastructure / security group, Mar 2026)  
**Scout Rating**: ★★★★ EXCELLENT  
**Gap Addressed**: CR#324 Gap 4 — **Verification of verifiers**

---

## Summary

Defines a protocol for verifiable agent identity and delegation across heterogeneous multi-agent platforms (MCP, A2A, custom frameworks). Agents receive cryptographic identity credentials that can be verified by any other agent in the ecosystem. The core contribution is making agent identity a first-class primitive — agents can verify WHO they're communicating with, not just WHAT is being communicated.

## Key Contributions

1. **Verifiable agent identity**: Cryptographic identity protocol allowing any agent to verify the identity of any other agent, independent of the communication platform
2. **Cross-platform interoperability**: Works across MCP (Anthropic), A2A (Google), and custom agent frameworks — identity is protocol-agnostic
3. **Delegation attestation**: When Agent A delegates to Agent B, a verifiable attestation is created that third parties can check — proving B is acting on A's behalf with A's authorization
4. **Revocation and rotation**: Identity credentials can be revoked (compromised agent) or rotated (key hygiene) without disrupting ongoing delegations

## Connection to CR#324 Gap Analysis

**Gap 4 (Verification of verifiers)**: CR#324 asked "who checks the sentinels?" AIP provides part of the answer: before trusting a verification result from another agent, you can verify that agent's identity and credentials. This doesn't prove the verifier is correct (that's DD#725's TLA+ contribution), but it proves the verifier is who they claim to be — preventing impersonation attacks on the verification infrastructure itself.

**Combined with DD#725**: SentinelAgent provides formal guarantees about verifier behavior; AIP provides identity guarantees about verifier identity. Together they address verification of verifiers from two complementary angles: correctness (TLA+) and authenticity (cryptographic identity).

## Key Insights

1. **Identity is prerequisite to trust**: You can't trust a verification result from an agent whose identity you can't verify. AIP makes this foundational layer explicit.
2. **Cross-platform identity is essential**: Our system (or any real MAS) may use multiple communication protocols. Agent identity must be protocol-agnostic to be useful.
3. **The Wikipedia "AI Tom" problem (DD#557)**: AIP would have prevented the unaccountable Wikipedia bot — identity protocol requires agents to be identifiable and their delegations to be verifiable.
4. **Delegation chains need identity at every hop**: AIP complements SentinelAgent's intent verification — you verify both that the delegation was authorized (intent) AND that the agents involved are who they claim to be (identity).

## Architecture Implications

For our May → Scout/Bob → Coder pipeline:
- Each agent would have a verifiable identity
- Delegation from May carries May's identity credential
- When Bob produces output, the identity chain proves May → Bob → Coder authorization
- If an agent is compromised, its credential can be revoked without disrupting the rest

## Limitations

- Cryptographic identity doesn't prevent authorized-but-malicious behavior (agent is who they claim to be but acts badly)
- PKI infrastructure overhead — certificate management adds operational complexity
- No solution for the cold-start of identity (who issues the first credential?)
- Performance cost of cryptographic verification not benchmarked for high-throughput agent systems

## Cross-References

- **CR#324**: Gap 4 (Verification of verifiers) — directly addressed (identity verification)
- **DD#725**: SentinelAgent — complementary (correctness verification via TLA+)
- **DD#557**: Wikipedia "AI Tom" — real-world case where agent identity protocol was missing
- **DD#585**: ShieldNet — network-level detection complements identity-level verification
- **DD#588**: EU AI Act compliance — identity protocol is prerequisite for regulatory compliance

---
*Scout DD#726 | 2026-04-10 | CR#324 Gap-Filling Research*
