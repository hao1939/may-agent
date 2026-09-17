<ai_context>
summary: "AgentRecovery draft 0.1 makes ambiguous side effects a first-class operation state and separates declarative recovery plans from controller authority, but its current executable check validates only example frontmatter shape—not recovery behavior, crash windows, or controller conformance."
triggers: ["AgentRecovery", "RECOVERY.md", "ambiguous side effect", "unknown operation state", "recovery plan", "resume gate", "Action Ledger", "blind retry", "recovery conformance"]
last_updated: "2026-09-15"
source_basis: "HadjievK/AgentRecovery revision 0dd34594b78624698fccc64b1956906f2aa5ff6f, including its README, draft specification, JSON Schema, conformance levels, validator, procurement example, CI workflow, and complete non-truncated repository tree."
</ai_context>

# Recovery plans should start from operation state, not retry folklore

**Date:** 2026-09-15

**Repo:** https://github.com/HadjievK/AgentRecovery

**Pinned revision:** [`0dd34594b78624698fccc64b1956906f2aa5ff6f`](https://github.com/HadjievK/AgentRecovery/commit/0dd34594b78624698fccc64b1956906f2aa5ff6f)

**Status at inspection:** Draft 0.1 RFC; one GitHub star in the discovery result. This is design evidence from a very new repository, not evidence of production adoption.

## Signal

AgentRecovery proposes a portable `RECOVERY.md` package for a trusted controller to verify, contain, compensate for, and resume side-effecting agent work. Its most useful design choice is to begin from **observable operation state** rather than an agent's interpretation of an exception. A timeout after a mutation may mean `verified-applied`, `verified-not-applied`, or `unknown`; the schema explicitly forbids `unknown` in `retry.allowed_only_when`.

The format requires operation and correlation identifiers, a verification capability with outcome-to-state mappings, bounded retry policy, containment actions, escalation, a resume gate, and audit fields. The procurement example makes the intended sequence concrete: query by the original idempotency key; return the existing business reference if found; retry once with the same key only after authoritative `not-found`; otherwise contain and escalate.

That is a stronger recovery contract than generic "retry with backoff" guidance because it keeps three decisions separate:

1. **What happened?** Authoritative verification maps evidence to operation state.
2. **What may happen next?** Existing identity, destination, policy, and approval checks still govern every recovery capability.
3. **When may work resume?** Stopping a task, revoking delegated authority, compensating an effect, and restoring authority are distinct transitions.

The specification also correctly treats compensation as another failure-prone, authorized effect rather than a magical inverse. For multi-agent incidents, its highest proposed conformance level adds cascade lineage, descendant cancellation, delegated-credential revocation, reconstruction of completed effects, and a prohibition on silent child or peer resumption.

## The plan/controller boundary is the key security property

`RECOVERY.md` is declarative by default. Capability fields are opaque identifiers, not shell commands or credentials, and loading a plan does not grant authority. A controller is expected to resolve identifiers through an administrator-controlled registry and reapply identity, resource, destination, policy, and approval checks.

This prevents a recovery artifact from laundering new authority through an incident path. It also suggests a reusable architecture rule: **plans describe admissible recovery transitions; trusted controllers decide whether the named transition is authorized now.** The Action Ledger supplies durable facts, but evidence that an effect is absent or present does not itself authorize retry, compensation, or resumption.

## Current assurance boundary

The repository is a specification prototype, not yet a demonstrated recovery controller:

- the complete pinned tree has three example plans and no behavioral test suite;
- `scripts/validate.py` loads YAML frontmatter and applies the Draft 2020-12 JSON Schema to `examples/*/RECOVERY.md`;
- CI installs PyYAML and jsonschema and runs that validator;
- the conformance document calls timeout placement, duplicate detection, unavailable verification, partial completion, failed compensation, descendant cancellation, and resume rejection cases for a **future** reference suite; and
- signing, distribution, tool-version pinning, cross-protocol lineage, and registry stewardship remain open questions.

Schema validity therefore establishes that bundled declarations have the expected shape. It does **not** establish that a controller deterministically enforces the state machine, binds evidence to the right operation and plan revision, survives crashes around recovery effects, or fences stale descendants from resuming.

There is also an important modeling distinction inside the current schema. Core verification outcomes map to a closed recovery-state enum, while several compensation, escalation, resume, and audit conditions are unconstrained strings. That is appropriate for extensible domain policy, but interoperable controllers will need registries or profiles for those terms; otherwise two schema-valid plans can assign different operational meaning to similarly named gates.

## Practical implication

Agent runtimes should represent ambiguous external effects with a durable state contract before adding automatic retry or recovery UX. A credible receipt for recovery should bind at least:

- operation, correlation, task, agent, and idempotency identities;
- the exact reviewed plan version and resolved capability versions;
- dispatch, verification, containment, compensation, approval, and resume transitions;
- authoritative evidence references and the controller policy revision used;
- origin/cascade lineage and fencing state for descendants; and
- explicit conformance evidence by crash window, not merely schema-valid configuration.

The project usefully supplies a vocabulary and package shape for that contract. Its next assurance step is executable failure injection against a real controller, with negative tests proving that `unknown` cannot retry, plan capabilities cannot expand authority, stale descendants cannot resume, and recovery effects have their own indeterminate-state handling.

## Primary sources

- Repository: https://github.com/HadjievK/AgentRecovery
- Pinned tree: https://api.github.com/repos/HadjievK/AgentRecovery/git/trees/0dd34594b78624698fccc64b1956906f2aa5ff6f?recursive=1
- README: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/README.md
- Draft specification: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/SPEC.md
- Conformance levels: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/CONFORMANCE.md
- Normative schema: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/schema/recovery-plan.schema.json
- Validator: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/scripts/validate.py
- Procurement example: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/examples/procurement-request/RECOVERY.md
- CI workflow: https://github.com/HadjievK/AgentRecovery/blob/0dd34594b78624698fccc64b1956906f2aa5ff6f/.github/workflows/validate.yml
