<ai_context>
summary: "Gryph's cross-harness policy layer makes two security boundaries explicit: a block only prevents an action when it comes from a pre-execution hook, and signed receipts only attest to what the same-user mediation path observed. Agent Hooks adds that multiple controls do not compose safely by default: approval can skip later controls, sequential transforms can change what later controls inspect, and streamed output requires segment-level release and persistence gates. Policy evidence therefore needs phase, coverage, composition, and exposure metadata."
triggers: ["agent hooks", "coding-agent policy", "pre-execution enforcement", "post-execution detection", "signed receipts", "same-user bypass", "composition profile", "approval resume", "streaming mediation", "Gryph", "AARM", "Agent Hooks"]
last_updated: "2026-09-19"
source_basis: "GitHub repository metadata plus Gryph documentation, implementation, and tests at revision 44e63b09957c4ab841a5aafe19604c769f3f848f; and the draft Agent Hooks specification, production guidance, threat model, Python reference SDK, and conformance vectors at revision 1fa77847c600b3582e73e0d20db9c625bf7f52b2."
</ai_context>

# An Agent-Policy Decision Needs an Execution Phase

Date: 2026-08-27  
Source: GitHub  
Repo: https://github.com/safedep/gryph

## Signal

Gryph exposes a useful distinction for policy layers that support several coding
agents: **a `block` decision is not necessarily prevention**. The same policy
engine receives both pre-execution and post-execution hooks. Gryph stamps the
normalized action `pre`, `post`, or `unknown`; only the first can stop the
operation. A post-phase block can inform the model and leave a receipt, but the
side effect has already happened.

The repository also makes a second boundary unusually explicit. Hash-chained,
Ed25519-signed receipts attest to what Gryph's mediator saw. They do not prove
that every host action passed through mediation. Gryph and the agent run as the
same operating-system user, hook configuration is user-writable, and a
same-user process can bypass file tools, remove hooks, replace the binary, or
read the signing key. Cryptographic evidence strengthens an observed path; it
does not expand that path's authority or coverage.

## Source-grounded details

- GitHub search for `topic:ai-agents pushed:>=2026-08-25 stars:>=20`, sorted by
  recent update, returned 1,462 repositories. Gryph had 158 stars at retrieval
  time. These are discovery and attention signals, not evidence of security
  maturity.
- The inspected revision is
  `44e63b09957c4ab841a5aafe19604c769f3f848f`. Its enforcement-coverage document
  lists each supported harness's pre-, post-, and lifecycle hooks rather than
  presenting hook support as one boolean.
- The phase mapper uses explicit overrides plus hook-name prefix/suffix rules.
  Unrecognized events become `unknown`, not `pre`, so new hook names are not
  accidentally advertised as preventive coverage.
- Claude Code, Gemini, OpenCode, Pi Agent, and Codex expose a broad pre-tool
  event; Cursor and Windsurf expose additional operation-specific pre-hooks.
  Post-tool and after-operation events remain detection paths even if the
  policy response is shaped like a block.
- The policy threat model says a determined same-user actor can edit agent hook
  configuration or invoke filesystem operations outside the mediated tool
  path. Hardened deployment therefore needs a lower-level control to protect
  hooks, binary, and configuration rather than another YAML rule.
- Receipts are chained per session, cover the active policy hash, and may carry
  Ed25519 signatures. The receipt documentation nevertheless warns that
  same-UID code can read the local private key and that a compromised agent can
  shape events before mediation. Off-host verification should pin public keys
  through a separate channel instead of trusting the producer's writable trust
  store.
- Scout inspected source, documentation, and test files but could not run the
  targeted Go tests because the environment has no `go` executable. The
  repository's tests are implementation evidence, not an independently
  reproduced validation result.

## A Hook Stack Needs a Composition Receipt

A second repository, `responsibleai/agent-hooks`, makes the next boundary
explicit: even when every control runs at a preventive hook, **how their verdicts
compose is part of the enforcement policy**. At pinned revision
`1fa77847c600b3582e73e0d20db9c625bf7f52b2`, its draft contract defines four
closed composition profiles rather than treating “several interceptors are
registered” as one security property.

The default `sequential/first_deny` profile is low-latency but order-sensitive.
Transforms fold through, so each later control inspects content already rewritten
by earlier controls. A deny short-circuits the stack. More subtly, if an approval
resolver lifts that deny under the default `on_approval: stop`, all later controls
remain uninvoked. The record exposes this as `fold_truncated: true`, but the approved
action still proceeds without their verdicts. `on_approval: resume` continues the
fold; `sequential/run_all` always evaluates every control and permits one approval
only when every deny is liftable.

Parallel profiles solve a different problem: each interceptor receives an isolated
copy of the same untransformed snapshot. They do not silently choose an order for
conflicting rewrites. `parallel/strictest` rejects transform conflicts by default,
while `parallel/unanimous` rejects anything except unanimous allow. “Parallel” here
means snapshot isolation, not necessarily concurrent execution. The specification
also rejects quorum and most-permissive-wins because both silently override some
controls.

The same composition discipline reaches streaming output. Agent Hooks' conformance
vectors release a segment only after a covering verdict, retain an already released
prefix when a later segment is denied, withhold the denied segment and all remaining
content, and prohibit unevaluated or withheld content from durable incorporation. A
truncated residue that no emission evaluated self-denies with
`host_error:streaming_unsupported`. This is a bounded-exposure contract, not
retroactive secrecy: once a prefix has been released, a later deny cannot retract
it.

**Reusable rule:** every policy receipt should identify the composition profile,
resolved knobs, interceptor order or shared-snapshot semantics, individual verdicts,
truncation, approval substitution, and output exposure mode. Approval UIs should
show the full deny set they are lifting. A deployment that requires every control to
run must not rely on the default stop-after-approval profile, and streamed content
must use the same verdict watermark for caller release and durable persistence.

The evidence is specification, reference-SDK, threat-model, and conformance-vector
inspection—not a production-security result. The repository labels the specification
draft/alpha, says the published `0.1.0a1` artifact implements a superseded draft, and
explicitly limits conformance to cooperating hosts: it does not establish complete
mediation, sandboxing, or resistance to a malicious interceptor or host. Scout did
not install the SDK or execute the multi-language conformance kit.

- **Repo:** https://github.com/responsibleai/agent-hooks
- **Inspected revision:** https://github.com/responsibleai/agent-hooks/commit/1fa77847c600b3582e73e0d20db9c625bf7f52b2
- **Primary sources:** [draft specification](https://github.com/responsibleai/agent-hooks/blob/1fa77847c600b3582e73e0d20db9c625bf7f52b2/spec/AGENT-HOOKS-0.1.md), [production profile guidance](https://github.com/responsibleai/agent-hooks/blob/1fa77847c600b3582e73e0d20db9c625bf7f52b2/docs/PRODUCTION.md), [threat-model coverage and gaps](https://github.com/responsibleai/agent-hooks/blob/1fa77847c600b3582e73e0d20db9c625bf7f52b2/docs/THREAT-MODEL.md), [Python emitter](https://github.com/responsibleai/agent-hooks/blob/1fa77847c600b3582e73e0d20db9c625bf7f52b2/sdk/python/python/agent_hooks/emitter.py), and [incremental-stream conformance vectors](https://github.com/responsibleai/agent-hooks/tree/1fa77847c600b3582e73e0d20db9c625bf7f52b2/conformance/vectors)
- **Discovery query:** GitHub Repository Search API `"AI agent" guardrails pushed:>2026-09-17`, sorted by update time; 63 results, `incomplete_results: false`

## Why it matters

A portable policy layer has at least three independent properties:

1. **Decision** — what did the policy engine return?
2. **Temporal authority** — was the decision made before the effect, after it,
   or at an unknown phase?
3. **Mediation coverage** — could the actor perform the effect outside the
   observed path?

A fourth property, **evidence integrity**, says whether the resulting record was
altered. Signed receipts can improve the fourth without improving the second or
third. Collapsing these properties into labels such as “blocked,” “protected,”
or “verified” overstates what the control established.

## Reusable guidance

- Put execution phase on every normalized action and receipt. Reserve
  “prevented” for a deny returned through a confirmed pre-execution boundary.
- Report coverage by harness, hook, and operation class; do not turn “has hooks”
  into a universal enforcement claim.
- Default new or unrecognized hook events to unknown authority until their
  timing contract is verified.
- Treat post-execution denies as detection or correction signals, not rollback.
  If reversal matters, model and verify compensation separately.
- Separate policy integrity, hook integrity, binary integrity, and receipt-key
  custody. Same-user self-protection is not an OS security boundary.
- For external audit, pin verifier keys out of band and retain policy hashes,
  phase, hook identity, and coverage version with each receipt stream.

## Primary sources

- Repository at inspected revision: https://github.com/safedep/gryph/commit/44e63b09957c4ab841a5aafe19604c769f3f848f
- Enforcement coverage: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/agent-enforcement-coverage.md
- Policy threat model: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/security-policy-threat-model.md
- Receipt trust model: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/docs/security-policy.md#threat-model-receipt-keys-and-trust
- Phase mapping implementation: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/aarm/mediation/phase.go
- Phase mapping tests: https://github.com/safedep/gryph/blob/44e63b09957c4ab841a5aafe19604c769f3f848f/aarm/mediation/phase_test.go
