<ai_context>
summary: "TrustGraph demonstrates a practical derived-output policy: an output inherits the intersection of every input's readers, while an action is allowed only when its audience stays inside that intersection. The stronger lesson is that lineage is not enforcement by itself: safety depends on complete source reporting, checks immediately before effects, and a gateway that exclusively holds credentials and network reachability."
triggers: ["derived output ACL", "agent information flow", "lineage enforcement", "complete mediation", "TrustGraph", "agent gateway credentials"]
last_updated: "2026-11-16"
source_basis: "HN item 50514746 and TrustGraph repository revision 0144145078aec3e3b0536d450535b22978afd743 inspected 2026-11-16. Scout read the complete README plus verification and gateway documentation and the shared decision kernel; Scout did not build or run the repository, reproduce its gateway demo, rerun Kani, or conduct a security review."
</ai_context>

# Derived-output ACLs require complete mediation, not just lineage

**Date:** 2026-11-16  
**Disposition:** New source-grounded finding  
**Coverage:** Complete README, verification and gateway documentation, and shared decision kernel at the pinned revision; no execution or independent security review

## Question

What does a new policy-as-code implementation reveal about keeping access restrictions attached to content produced by agents?

## Source observation

[HN item 50514746](https://news.ycombinator.com/item?id=50514746) surfaced
[`skishore23/trustgraph`](https://github.com/skishore23/trustgraph), a repository
created on 2026-11-14. The HN item had two points and no comments when inspected,
so HN is discovery evidence rather than validation.

At reviewed revision
[`0144145`](https://github.com/skishore23/trustgraph/tree/0144145078aec3e3b0536d450535b22978afd743),
TrustGraph gives each source a reader set and computes the readers of a derived
output as the intersection of all its inputs' readers. An action is permitted
only when every intended recipient belongs to that intersection. Unknown
sources, agents, actions, empty provenance, disallowed audiences, and missing
approvals fail closed. The shared
[decision kernel](https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/crates/trustgraph-core/src/decision.rs)
places approval after eight permission checks, so an approval cannot widen a
source's reader set or turn another denial into an allow.

The policy interface treats reviewability as part of enforcement. Policies can
carry examples as tests, `explain` renders them in plain language, and `diff`
marks reader-set widening. This makes a policy change's security consequence
visible before activation rather than burying it in a general configuration
diff.

The repository's strongest claim is deliberately narrower than “lineage makes
agents safe.” Its
[gateway documentation](https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/docs/gateway.md)
says the gateway prevents bypass only while it alone holds upstream credentials
and the agent has no alternate route to the service. The README also says the
system can account only for sources the host reports, and non-gateway callers
must ask immediately before acting and honor only `allow`. The Python
integrations are explicitly labeled not ready after review found ways to drop
restrictions.

## Reusable implication

Derived-data governance has three separate obligations:

1. **Composition:** restrictions must combine across every input. Reader-set
   intersection is conservative and deterministic: adding one sensitive source
   can only narrow where the result may go.
2. **Policy review:** access widening should be a first-class diff with tests,
   not an incidental YAML change. Human approval should validate the policy
   change, not override a runtime denial.
3. **Complete mediation:** the component making the decision must see every
   relevant read and must control the effect. Provenance without exclusive
   credentials, source-complete capture, and a check at the effect boundary is
   advisory telemetry, not containment.

This connects two existing library threads. Formal or deterministic information
flow control can move security above the text layer, as tracked in
[the MVAR finding](./2026-06-23-hn-scan-104.md#signal-7-mvar--information-flow-control-for-llm-agents-github-5),
but enforcement still fails when an integration omits a read or an agent can
route around the policy point. Conversely, richer observability creates new
copies and trust domains, as shown by
[the MLflow credential finding](./2026-11-11-agent-observability-can-persist-provider-secrets.md);
lineage stores therefore need their own access, retention, and secret-handling
controls.

## Evidence and limits

The producer documents ten bounded Kani harnesses over decision and reader-set
kernels and two recorded CI runs with zero harness failures. Its verification
note explicitly limits those proofs: they do not cover arbitrary sizes, callers
that compute decision facts, authentication, the journal, network behavior, or
whether the host reports every input. A seeded simulator exercises the runtime
against five invariants and deliberately broken variants, but uses an in-memory
journal and does not exercise real threads, networking, or a filesystem.

Scout read the producer's complete README, verification document, gateway
document, and shared decision kernel at the pinned revision. Scout did not run
`cargo test`, the simulator, Kani, the gateway, or the Python integrations;
inspect every adapter or authentication path; reproduce the documented demo;
validate the recorded GitHub Actions runs independently; or perform a security
review. The repository had zero GitHub stars and forks at inspection time, and
its implementation and maturity claims are producer-authored.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50514746
- **Repository:** https://github.com/skishore23/trustgraph
- **Reviewed revision:** `0144145078aec3e3b0536d450535b22978afd743`
- **README:** https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/README.md
- **Verification:** https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/docs/verification.md
- **Gateway threat model:** https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/docs/gateway.md
- **Decision kernel:** https://github.com/skishore23/trustgraph/blob/0144145078aec3e3b0536d450535b22978afd743/crates/trustgraph-core/src/decision.rs
