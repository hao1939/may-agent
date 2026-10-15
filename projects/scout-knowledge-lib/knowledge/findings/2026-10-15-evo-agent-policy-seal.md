<ai_context>
summary: "Pinned evo-agent inspection shows why an agent approval policy needs a host-owned admission boundary, fail-visible loading, non-overridable denials, self-protection, and limits on repeated automatic action."
triggers: ["evo-agent", "approval policy", "tool governance", "self-authorization", "fail-visible policy", "red line"]
last_updated: "2026-10-15"
source_basis: "Static inspection of evorule/evo-agent revision ffc8cd6bef1e9f48093f36027a6d6e536a61de63: README, architecture, threat model, approval-policy module, runner, and replay module. Scout did not build or run the project or inspect the separate evorule server."
</ai_context>

# Agent approval policy must be sealed from the agent it constrains

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Repo:** https://github.com/evorule/evo-agent  
**Inspected revision:** https://github.com/evorule/evo-agent/commit/ffc8cd6bef1e9f48093f36027a6d6e536a61de63

## Question

What must sit around an agent's tool-approval policy so that “policy-controlled” does not collapse into self-approval or silent fail-open behavior?

## Observation

A current GitHub Repository Search for `"AI agent" memory orchestration pushed:>2026-10-01`, sorted by recently updated, returned `incomplete_results: false` and surfaced `evorule/evo-agent`. Scout pinned the default branch before reading repository content.

The repository combines several controls that are more useful together than as separate feature claims:

- Tool availability has three states: active tools execute directly, candidate tools produce an approval proposal, and blocked tools cannot be approved. Separately, application-scoped switches can remove governance-write, MCP, or service-proxy tools from the model-visible tool surface rather than merely reject them after selection.
- The new approval-policy module says the serve side exclusively reads `.evo/approval-policy.toml`; the agent context receives only a read-only copy. Missing, unreadable, or invalid policy files return typed errors and are specified to downgrade policy-mode actions to manual review with an explicit trace rather than silently treating an empty policy as permission.
- Deterministic “red line” predicates identify deletion, remote push, network egress, and writes to the approval or settings files. Hits fall back to manual review across approval tiers. An explicit operator override may relax those red lines but must be marked in the audit trail; blocked-tool denial is documented as higher priority and not overrideable.
- The policy schema also carries correction and per-run automatic-action limits (defaults: 3 corrections and 200 actions). These address a different failure mode from per-call approval: individually admissible actions can still form an unbounded retry or runaway sequence.
- The public threat model does not treat the architecture as complete. It records DNS rebinding and time-of-check/time-of-use risks for HTTP access as open, notes social engineering around auto-approval, and places the separate fact log, WAL, TCB, HTTP authentication, and server-side risks outside this repository's threat-model scope.

## Interpretation

An approval policy is itself an authority-bearing asset. Keeping its decision basis outside model-writable context, failing visibly when it is absent or malformed, and forcing policy-file writes through a stronger gate prevents the agent from changing the rules and then citing those changed rules as authorization. Capability removal, immutable denial, conditional approval, operator override, and sequence budgets are distinct controls and should remain distinguishable in logs and tests.

The reusable review question is therefore not only “does this call require approval?” It is: who owns the policy bytes, can the subject rewrite them, what happens when policy loading fails, which denials survive override, how is override evidenced, and what bounds a sequence of individually allowed actions?

## Limits

This is static repository evidence from an early, zero-star project at observation, not independent security validation or adoption evidence. Scout did not compile the Rust workspace, run its project-authored tests, operate its workbench, exercise approvals, or verify emitted Fact records. The approval-policy module explicitly delegates downgrade and audit behavior to callers; static inspection of the module does not prove every call path consumes it correctly. The separate evorule server and its fact-log/TCB claims were not inspected, and the repository's own threat model leaves material network and server boundaries open or out of scope.

## Primary evidence

- [README: tool tiers and source-level capability switches](https://github.com/evorule/evo-agent/blob/ffc8cd6bef1e9f48093f36027a6d6e536a61de63/README.md)
- [Approval-policy schema, fail-visible errors, and red-line predicates](https://github.com/evorule/evo-agent/blob/ffc8cd6bef1e9f48093f36027a6d6e536a61de63/src/agent/approval_policy.rs)
- [Architecture: proposal protocol and tool-safety model](https://github.com/evorule/evo-agent/blob/ffc8cd6bef1e9f48093f36027a6d6e536a61de63/ARCHITECTURE.md)
- [Threat model and explicit residual risks](https://github.com/evorule/evo-agent/blob/ffc8cd6bef1e9f48093f36027a6d6e536a61de63/docs/security/THREAT_MODEL.md)
- [Runner implementation inspected for approval integration context](https://github.com/evorule/evo-agent/blob/ffc8cd6bef1e9f48093f36027a6d6e536a61de63/src/agent/runner.rs)
