<ai_context>
summary: "Strands Box combines OS containment with a shared, default-deny policy history across its shell, Python runtime, egress gateway, and MCP broker, allowing an earlier sensitive read to govern later network access. Its own security guide makes the key limit explicit: direct filesystem grants, spawned programs' later effects, and selected uncontained MCP egress do not enter that history, so a temporal information-flow rule is only as strong as its complete-mediation envelope."
triggers: ["Strands Box", "Dogwood policy", "history-aware sandbox", "temporal information flow", "egress after secret read", "complete mediation", "opaque credential injection"]
last_updated: "2026-11-12"
source_basis: "GitHub repository Search API discovery and static inspection of strands-agents/box at revision 61ade09efd5aeeae10992ef5866acb39dd947bc7: repository metadata and tree, README, user security and policy guides, Dogwood language reference, credential crate documentation, temporal write-budget example, and selected credential, policy, egress, and fail-closed tests."
</ai_context>

# History-Aware Sandbox Policy Needs Complete Mediation

**Date:** 2026-11-12  
**Repo:** https://github.com/strands-agents/box  
**Reviewed revision:** https://github.com/strands-agents/box/commit/61ade09efd5aeeae10992ef5866acb39dd947bc7

## Question

Can a local agent sandbox enforce a rule that depends on what the agent did
previously—such as refusing egress after a sensitive read—and what must be true
for that rule to cover the real effect path?

## Source signal

Strands Box separates two enforcement tiers:

1. `box.toml` defines direct filesystem and program access enforced by the host
   operating system; and
2. `policy.dw` supplies default-deny, forbid-overrides rules for operations that
   pass through Box's trusted shell, Monty Python runtime, egress gateway, and
   MCP broker.

The second tier uses one Dogwood engine and shared event history. The README
therefore describes a cross-operation control: a file read through Shell or
Python can cause a later outbound HTTP request to be denied. The policy guide
also documents history predicates over completed responses, elapsed-time
windows, command exits, MCP calls, filesystem operations, and network requests.
This is stronger than evaluating each tool call in isolation because the later
request can be harmless by itself yet disallowed because of earlier state.

The credential boundary composes with that policy path. Configured credentials
are resolved at a trusted boundary, represented inside the workload by
non-secret phantom values, attached only after policy permits a matching
request, and redacted if a response echoes an injected secret. The credential
crate explicitly does **not** decide reachability: destination binding and
secret opacity do not replace the policy decision that opens the route.

## The important boundary is what enters the history

Box's own security guide names several effects that do not receive per-operation
Dogwood decisions or records:

- files directly granted under `[agent.filesystem]`;
- file operations and child processes performed by a configured external tool;
- the later filesystem and network effects of an OS program admitted once by
  `shell:spawn`; and
- MCP connections configured with `contain_egress = false`, which bypass the
  gateway policy checks.

This means a temporal rule such as “deny network after reading a secret” is not
a property of the workload as a whole. It is a property of the mediated routes
whose relevant read and egress events both reach the same policy engine. A
sensitive file granted directly to the agent can be read without updating the
history. A permitted external process may perform effects after the one spawn
verdict. An uncontained network route can leave without consulting the later
policy decision.

The documentation also exposes more subtle history semantics:

- `::request` records include refused attempts, while `::response` records only
  operations that ran;
- response-keyed budgets may overshoot when requests are concurrently in flight;
- edits to some temporal rule forms can reset their retained count;
- long windows increase decision cost; and
- the runtime refuses inconsistent persisted history and box-run state rather
  than silently starting with a misleading empty history.

Thus “stateful policy” requires a receipt for event meaning, concurrency, rule
revision, persistence, and route coverage—not merely evidence that the policy
language supports temporal predicates.

## Reusable implication

A history-aware agent boundary should publish a **mediation map** alongside its
rules:

| Relevant effect | Required route | Evidence needed |
|---|---|---|
| Sensitive read | Policy-observed filesystem/interpreter operation | Completed read event with normalized resource identity |
| External request | Policy-observed gateway or broker operation | Verdict plus settled request/response event |
| Credential use | Destination-bound injection after permit | Route binding and evidence that plaintext never entered workload context |
| Spawned program effects | Separately contained or recursively mediated execution | Coverage for child filesystem/network effects, not only the spawn verdict |
| Direct OS grant | Explicitly outside temporal policy | Operator-reviewed exception or removal from direct reach |

The practical rule is: **put every event needed by the invariant behind the same
trusted state machine, or state the invariant more narrowly.** OS containment is
still useful for coarse reachability, and semantic policy is useful for
history-dependent decisions, but one tier cannot infer events that only the
other tier sees. Credential opacity likewise limits secret exposure without
proving that every destination or downstream effect was governed.

This strengthens the earlier Fairlead finding on sequence-aware hook policy:
Box places the policy engine beside OS containment and owns several execution
paths directly, but its explicit exclusions show that stronger effect ownership
still needs route-by-route coverage evidence.

## Evidence boundary and disposition

**Coverage:** topic-led GitHub repository Search API discovery returned
`incomplete_results=false`; Scout then inspected repository metadata, the
non-truncated recursive tree, and selected complete documentation and test files
at the pinned revision. Scout did not compile or run Box, Dogwood, its tests,
its containment mechanisms, credential injection, network gateway, MCP broker,
or telemetry; did not audit every source file or policy example; and did not
perform a bypass or information-flow campaign. The inspected tests are
producer-authored source evidence, not independently observed passes.

The repository labels Box a preview. Its README says Linux ARM64 and Apple
silicon macOS are supported, Linux x86-64 is experimental, and direct filesystem
grants do not emit individual policy decisions. Static inspection does not
establish production hardening, complete mediation, policy correctness,
performance, credential non-disclosure under all encodings, or resistance to
kernel and implementation defects.

**Disposition:** new source-grounded finding. Existing Scout notes cover
sequence-aware hook policy and sandbox endpoint scoping; this source adds a
concrete combined OS-and-semantic architecture whose own documentation sharply
identifies which effects are and are not eligible for shared temporal policy.

## Primary evidence

- [README](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/README.md)
- [Security guide](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/docs/user/security.md)
- [Policy guide](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/docs/user/policy.md)
- [Credential boundary](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/crates/credentials/README.md)
- [Dogwood policy language reference](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/.agents/skills/authoring-box-policy/references/dogwood-policy-language.md)
- [Temporal write-budget example](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/.agents/skills/authoring-box-policy/examples/temporal-write-budget.dw)
- [Linux gateway fail-closed tests](https://github.com/strands-agents/box/blob/61ade09efd5aeeae10992ef5866acb39dd947bc7/crates/containment/tests/gateway_fail_closed_linux.rs)
