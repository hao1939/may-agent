<ai_context>
summary: "Gryph's cross-harness policy layer makes two security boundaries explicit: a block only prevents an action when it comes from a pre-execution hook, and signed receipts only attest to what the same-user mediation path observed. Agent Hooks adds that multiple controls do not compose safely by default: approval can skip later controls, sequential transforms can change what later controls inspect, and streamed output requires segment-level release and persistence gates. Package Doctor demonstrates why dependency admission needs both a preventive check of the requested artifact and a post-execution audit of resolved transitive artifacts. Stop That Shit adds that task authority, host permission, and lifecycle evidence must remain separate: an allow cannot grant host authority, and uncertain delegated work must continue to consume capacity. Policy evidence therefore needs phase, coverage, composition, authority, lifecycle, and exposure metadata."
triggers: ["agent hooks", "coding-agent policy", "pre-execution enforcement", "post-execution detection", "signed receipts", "same-user bypass", "composition profile", "approval resume", "streaming mediation", "dependency admission", "transitive dependencies", "task authority", "delegation lifecycle", "Stop That Shit", "Gryph", "AARM", "Agent Hooks", "Package Doctor"]
last_updated: "2026-09-24"
source_basis: "GitHub repository metadata plus Gryph documentation, implementation, and tests at revision 44e63b09957c4ab841a5aafe19604c769f3f848f; the draft Agent Hooks specification, production guidance, threat model, Python reference SDK, and conformance vectors at revision 1fa77847c600b3582e73e0d20db9c625bf7f52b2; Package Doctor documentation, implementation, and tests at revision 5c14dfef0d80b7425ea1388ffea74d38b18d6d00; and Stop That Shit documentation, host-adapter contract, evaluation design, implementation tree, and repository-authored evidence at revision 18310454cf10c7a219a8bbdbab2760624a183c75."
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

## Dependency Admission Needs Two Phase-Distinct Gates

HN item [49762076](https://news.ycombinator.com/item?id=49762076) surfaced
[Package Doctor](https://github.com/binuka200/package-doctor), whose Claude Code
hook demonstrates a narrower but reusable consequence of the phase distinction:
the artifact named before an install and the artifacts actually resolved after it
are different policy subjects.

At inspected revision
[`5c14dfef0d80b7425ea1388ffea74d38b18d6d00`](https://github.com/binuka200/package-doctor/commit/5c14dfef0d80b7425ea1388ffea74d38b18d6d00),
the `PreToolUse` path parses named installs, blocks direct URL/VCS targets that
cannot receive registry or advisory checks, and evaluates package names for
recent publication, near-match provenance, known exploitation, vulnerable
versions, and maintenance capacity. This is the preventive gate. A separate
`PostToolUse` path diffs supported lockfiles against Git's committed version after
resolvers and selected locking installers run. It removes names already checked
before execution and evaluates newly resolved transitive packages. Edits to
supported dependency manifests receive a similar after-write check.

The second pass closes a real observation gap but not an authority gap. Its own
implementation says it cannot block because the install, resolve, or edit already
happened; it can only return context asking the agent to change course before code
runs. It also covers only lockfiles and command shapes the parser understands.
Plain `pip`, PDM, and Rye transitive additions are not all covered by the lockfile
diff, a repository-less run has no committed baseline, and post-hook parsing or
lookup exceptions return silently. On the preventive path, malformed hook input
and lookup failures fail open; an unavailable upstream yields an explicit
“allowed unchecked” message when the event can still be interpreted.

This makes “dependency guard enabled” too coarse a control claim. A useful
admission receipt should separately report the requested artifact, effective
index or direct source, preflight verdict, exact resolved artifact set, lockfile
baseline, post-resolution verdicts, unchecked/degraded state, and whether any
flagged bytes had already entered the workspace or environment. The post-pass is
best treated as containment guidance until a subsequent clean resolve and scan
prove that the rejected artifact is absent.

The repository reports strong internal measurements—6,897/6,898 agreement with
OSV's version-scoped answer and zero misses against `pip-audit` over the stated
sample—but both comparisons share OSV, and the exposure map has no external
review. Scout inspected the pinned documentation, implementation, and tests; it
did not install the package or reproduce those measurements.

- **Primary sources:** [agent guardrail and coverage limits](https://github.com/binuka200/package-doctor/blob/5c14dfef0d80b7425ea1388ffea74d38b18d6d00/docs/agent-guardrail.md), [hook implementation](https://github.com/binuka200/package-doctor/blob/5c14dfef0d80b7425ea1388ffea74d38b18d6d00/src/package_doctor/cli.py), [decision logic](https://github.com/binuka200/package-doctor/blob/5c14dfef0d80b7425ea1388ffea74d38b18d6d00/src/package_doctor/guard.py), [hook tests](https://github.com/binuka200/package-doctor/blob/5c14dfef0d80b7425ea1388ffea74d38b18d6d00/tests/test_guard.py), and [accuracy method and limitations](https://github.com/binuka200/package-doctor/blob/5c14dfef0d80b7425ea1388ffea74d38b18d6d00/docs/accuracy.md)

## Task Authority Is Not Host Permission

[Stop That Shit](https://github.com/lennney/stop-that-shit) (STS) adds a useful
boundary to this policy picture: an agent's **task contract** and the host's
**execution permission** are different authorities. At inspected revision
[`18310454cf10c7a219a8bbdbab2760624a183c75`](https://github.com/lennney/stop-that-shit/commit/18310454cf10c7a219a8bbdbab2760624a183c75),
the shared policy parses explicit modes such as `review`, `answer`, `change`, and
`monitor`, plus optional file, dependency, hash, and subagent limits. A policy
pass adds no permission and cannot override the host sandbox; a host permission
grant does not enlarge the task. This makes authority an intersection rather
than a winner-takes-all verdict:

`executable action = host allows × task contract allows × adapter covers`

The repository's host-adapter contract also treats delegation capacity as a
lifecycle claim, not a process-count guess. Capacity is reserved before a spawn.
Only a correlated whole-call `joined` or `not_started` fact releases the rest of
that reservation; a session-end notice, stop attempt, timeout, path-only agent
listing, or unsupported adapter event does not prove that work ended. Under a
finite budget, missing lifecycle support is denied rather than inferred from
arrival order or local timing. This is conservative, but it preserves the actual
meaning of `agents=N`: uncertain work still occupies authority.

The evaluation design is equally instructive. Its paired matrix changes one
decisive fact between an unauthorized and authorized case for review mutation,
hashing, scope expansion, dependencies, deliverable disclaimers, compatibility,
proof stopping, and delegation. It keeps baseline, instruction-only, and plugin
arms separate, and describes routing and live Hook integration as different
experiments. A denied smoke cell requires both attempted-path evidence and the
sentinel's absence; a model that never attempts the action is `not_exercised`,
not a successful block. This avoids laundering model compliance, Hook response,
and host effect into one score.

The source's own evidence remains bounded. Its 0.2.3 report says repository-run
checks had 417 passing tests, 18/18 paired case arms, and one isolated Codex CLI
smoke in which review denied a mixed read/write command while change allowed it.
Those are maintainer-reported results; Scout inspected the pinned source,
documentation, evaluation plan, and repository-authored evidence but did not
install STS or rerun its tests. The report itself keeps `hostEffect` as
`unobserved` outside the isolated smoke and explicitly declines to claim general
model improvement or equivalent behavior across all five adapters.

**Reusable rule:** record task authority, host permission, adapter coverage,
lifecycle certainty, and observed effect separately. For a boundary test, require
both a negative witness (the forbidden effect is absent) and a positive witness
(the nearest authorized action still works), and report `not_exercised` when the
model never reaches the gate.

- **Discovery:** GitHub Repository Search API query
  `topic:ai-agents pushed:>2026-09-23 stars:>50`, sorted by recent update,
  returned 590 repositories with `incomplete_results: false`.
- **Primary sources:** [README](https://github.com/lennney/stop-that-shit/blob/18310454cf10c7a219a8bbdbab2760624a183c75/README.md), [host-adapter contract](https://github.com/lennney/stop-that-shit/blob/18310454cf10c7a219a8bbdbab2760624a183c75/HOST-ADAPTER-CONTRACT.md), [paired-evaluation design](https://github.com/lennney/stop-that-shit/blob/18310454cf10c7a219a8bbdbab2760624a183c75/evals/codex-paired/README.md), and [repository-authored evidence](https://github.com/lennney/stop-that-shit/blob/18310454cf10c7a219a8bbdbab2760624a183c75/EVIDENCE.md)

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
