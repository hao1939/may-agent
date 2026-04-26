---
hypothesis_id: "H-197"
title: "Cross-User Agent Collaboration Requires Identity Governance Layer"
status: "deferred"
confidence: "medium"
source: "ClawNet paper analysis (HB-2154)"
date_created: "2025-04-26"
---

# H-197: Cross-User Agent Collaboration Requires Identity Governance Layer

## Hypothesis

For multi-agent systems to support **cross-user collaboration** (where agents representing different users work together), the system must implement an **identity governance layer** that separates:
1. **Manager Agent** — aggregates user's global cognitive state but is structurally isolated from external communication
2. **Identity Agents** — scoped to specific collaboration contexts with restricted permissions

Without this layer, cross-user collaboration risks violating privacy boundaries, exceeding authorization scopes, and creating accountability gaps.

## Supporting Evidence

**From ClawNet (香港生成式AI研发中心)**:
- Existing single/multi-agent frameworks serve one user/principal — they lack infrastructure for "different people's agents collaborating"
- Traditional multi-agent role division doesn't handle human identity proxying, failing on **interest boundaries, authorization scopes, and responsibility attribution** across owners
- The core risk isn't just communication protocol — it's missing **identity, permission, and audit** infrastructure

**Architecture pattern observed**:
```
Manager Agent (global cognitive aggregation)
    ↓ [structural isolation — no direct external comms]
Identity Agent A (context A, scoped permissions)
Identity Agent B (context B, scoped permissions)
```

- "Cannot do" > "should not do" — structural isolation prevents relying on prompt constraints for privacy
- Scoped authorization: each Identity Agent only accesses authorized resources, out-of-scope operations escalate to owner
- Cloud-edge architecture: cloud maintains persistent identity + cross-user orchestration; edge handles local execution with double-layer file authorization
- Action-level accountability binds every operation to owner/identity/authorization/result/time with audit/backup/rollback

## Implications for OpenClaw

### If True:
1. **Agent identity model** — Need to distinguish "acting on behalf of user" vs "operating independently" modes
2. **Cross-user collaboration roadmap** — Future multi-agent scenarios require explicit authorization boundary design
3. **Action audit trail** — Error logs must support complete traceability (owner/identity/authorization/result/time)
4. **Hierarchical agent architecture** — Consider Manager + Identity Agent separation for sensitive operations

### If False:
- Simpler agent identity model may suffice
- Cross-user trust can be handled at application layer rather than agent layer

## Testable Predictions

1. **Architecture prediction**: Systems without identity governance will face privacy/authorization incidents when attempting cross-user agent collaboration
2. **Performance prediction**: Scoped authorization adds <10ms latency per operation (acceptable overhead)
3. **Adoption prediction**: Enterprise use cases will demand action-level accountability before adopting cross-agent collaboration

## Related Findings

- [HB-2154: ClawNet — Human-Symbiotic Agent Network](../library/posts/HB-2154-clawnet-human-symbiotic-agent-network.md)
- [HB-2153: Self-Evolving Skill Lifecycle](../library/posts/HB-2153-self-evolving-skill-lifecycle.md) — Skill lifecycle governance

## Open Questions

1. How does identity governance compose with skill-based architectures? Does each Identity Agent carry its own skill set?
2. What's the migration path from single-user to cross-user agent systems?
3. How to balance scoped authorization with emergent collaboration (agents discovering new coordination patterns)?

## Next Steps

- [ ] Review current OpenClaw agent identity model — does it distinguish "representing user" vs "independent" modes?
- [ ] Design doc: scoped authorization for cross-user skill execution
- [ ] Spike: action-level audit trail implementation (owner/identity/authorization/result/time)
