<ai_context>
summary: "DeepSeek Harness is a high-attention developer-preview implementation of a fully plugin-composed agent runtime. Its durable contribution is not 'everything is replaceable' alone, but the constraints that keep replacement observable: reversible registrations, event-sourced model context, capability-specific policy enforcement, and explicit refusal to call an in-process self-modification VM a security boundary."
triggers: ["DeepSeek Harness", "DSH", "Cordis", "plugin agent runtime", "reversible effects", "event-sourced session", "self-modifying agent", "agent sandbox"]
last_updated: "2026-09-12"
source_basis: "GitHub Search metadata and primary repository architecture, agent instructions, implemented design notes, package manifest, commit history, and public check-run metadata at revisions b150a551b8d465e31e418e1b2eaf5e79bbb7d28e and c291e7961a515f6d7af9304e7fd1d257929aef26."
</ai_context>

# A Plugin Agent Runtime Still Needs Non-Plugin Invariants

Date: 2026-08-27  
Source: GitHub  
Repo: https://github.com/deepseek-ai/deepseek-harness

## Signal

DeepSeek's new **DeepSeek Harness (DSH)** is an unusually extensive implementation
of a fully plugin-composed agent runtime. Model adapters, tool registry, session
log, agent loop, persistence, sandbox policy, approvals, UI, and even temporary
model-authored runtime extensions are mounted through Cordis plugins. A profile
is an ordered set of plugin bundles plus user overlays; a row can be replaced by
configuration, and a plugin's registrations unwind when its lifecycle ends.

The important lesson is that composability does not eliminate a core. It moves
the durable core into **invariants around the plugin graph**. DSH requires every
model-visible input to be reconstructable from an append-only session log; uses
separate durable session events, live agent events, and capability events;
routes tool execution through pre/execute/post interception; and treats policy
as capability-specific rather than pretending one generic wrapper can confine
both subprocesses and in-process functions.

The repository also provides a valuable negative boundary. Its opt-in
`cordis_mount` tool lets the model write and mount a temporary JavaScript plugin
inside the live process. The VM receives a whitelisted context façade, cannot
reach raw framework plumbing, and has reversible lifecycle semantics. But the
project explicitly says this is **not a security sandbox**: exposed services
such as shell, filesystem, and web still reach the real runtime. API narrowing
improves correctness and inspectability; it does not create isolation.

## Source-grounded details

- GitHub Search query `agent harness in:name,description,readme
  created:>=2026-08-01 stars:>=10`, sorted by stars, returned the repository at
  198,442 stars and 22,588 forks at observation time. The repository was created
  on 2026-08-13 and its inspected release commit was authored on 2026-08-21.
  These extraordinary early counts establish attention, not maturity or
  independent validation.
- The inspected tree was `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`,
  tagged `dsh-v0.1.1-rc.2`. Both the README and root instructions label the
  project developer preview / pre-release and explicitly disclaim compatibility:
  old on-disk formats may be rejected and breaking changes are expected.
- Runtime composition starts from an empty entry list, applies ordered bundles,
  then profile, home, and CLI patch overlays. A patch replaces a whole
  configuration row or inserts a new one, and `dsh --dump-config` exposes the
  actual boot tree.
- Session events are durable facts; agent events operate on in-flight work; and
  capability events attach policy or adapters. A rejected first input still
  closes a logged turn without spending a model step, preserving the attempted
  control decision.
- The architecture states **“model-visible means logged.”** Prompt history,
  replay, resume, fork, transcripts, persistence, and telemetry derive from the
  same session-event stream. Tool-schema changes are captured in changed request
  headers rather than inferred retrospectively from the current plugin set.
- Subprocess confinement is one swappable capability, not universal middleware.
  Linux selects and probes Bubblewrap or Landlock, macOS uses Seatbelt, and an
  unavailable selected backend fails closed rather than silently running
  unconfined. File modes govern file effects only; they do not claim network or
  process isolation.
- Wider subprocess access is a new logged tool call after a concrete denial. It
  needs a strictly wider mode and one user decision; approval applies to that
  retry only. The design rejects hidden auto-retry because one logged call would
  otherwise conceal two executions under different policies.
- Filesystem tools need enforcement in their own provider because they execute
  in process; web access remains outside the file-policy vocabulary. The design
  explicitly rejects a generic execution wrapper around arbitrary tools as a
  mechanically false abstraction.
- Temporary model-authored plugins exist only in process memory, disappear on
  restart, and are not restored when conversation history resumes. Their
  mount/unmount calls and resulting tool-schema changes remain logged, separating
  historical observability from restoration of executable state.
- The temporary-plugin VM traps Node built-ins and exposes a whitelist façade,
  but project documentation says the façade is not a security boundary. A real
  boundary would require a separate process and permission mediation.
- The package manifest exposes broad typecheck, unit, snapshot, coverage,
  documentation, package-invariant, and platform gates. However, GitHub's public
  check-run response for the inspected commit surfaced only six successful
  Dependabot checks, not a complete CI validation run. Scout did not execute the
  repository's test suite, so the implemented tests are design evidence rather
  than independently reproduced results.

## September update: compatibility became an immutable migration pipeline

At pinned revision `c291e7961a515f6d7af9304e7fd1d257929aef26`, DSH remains a
compatibility-breaking developer preview, but its handling of **already released
session formats** has become materially stricter. The repository now declares
released predecessors frozen, assigns each format transition to one adjacent
migration edge, retains source generations unchanged, and writes only the final
current generation. Plugins cannot register these migrations: historical
readability must not depend on which feature plugins happen to be mounted.

This is more than a file converter. DSH's migration stages are stateful because
old retries, interrupted attempts, packed assistant chunks, and sequence
references cannot be transformed one row at a time without context. A compiled
chain creates fresh per-session stages, streams records through each edge, and
settles stages in source-to-target order. Compact runs can pass between edges
without first expanding into millions of events. The repository reports that an
earlier whole-artifact converter exhausted a 16 GB Node heap on a 116 MB session;
its streaming path migrated that same internal fixture while retaining 477 MB of
heap. Those are project-reported measurements, not an independent Scout
benchmark, but they make a useful architectural point: backward compatibility
for event-sourced agents is both a semantic and a bounded-state problem.

Read access and mutation readiness are also separated. A read-only open may use
a validated in-memory migration result without publishing new bytes. A later
writer reuses that preparation, then encodes, verifies, and atomically publishes
the successor before returning an append-capable handle. Concurrent callers
share preparation without letting one caller's cancellation terminate work
still needed by another; source drift aborts publication instead of silently
recomputing history already shown to readers.

The current V3 envelope makes the compatibility boundary explicit: surface
placement is mandatory for model-visible messages and tool results, replacement
spans have one canonical spelling, and contradictory tool-failure metadata is
rejected rather than repaired. Historical normalization belongs only in the
incoming V2→V3 edge. Current readers stay strict, so “being backward compatible”
does not permanently widen the live schema.

The reusable lesson is to treat durable agent-history evolution as four separate
contracts: frozen predecessor semantics, adjacent deterministic transforms,
strict current-format admission, and verified no-overwrite publication. Keeping
those contracts outside the optional plugin graph is another example of the
non-plugin invariants this note originally identified.

## Why it matters

“Everything is a plugin” is safe only if some properties are not optional. A
replaceable agent loop still needs durable turn accounting. A replaceable tool
registry still needs an interception and audit path. A replaceable sandbox still
needs fail-closed capability detection. A self-modification API still needs an
honest statement of which powers it exposes and whether those powers cross an
actual isolation boundary.

The reusable architecture is therefore:

1. **Plugin graph for variation** — providers and policy adapters can be swapped
   or layered without editing the loop.
2. **Event log for truth** — everything the model saw or did is reconstructable
   from durable facts, independent of the plugin set present later.
3. **Capability-local enforcement** — each effect family enforces policy where
   it actually executes; no generic wrapper makes unsupported claims.
4. **Reversible lifecycle for experimentation** — temporary extensions settle,
   unload, and unwind their registrations predictably.
5. **Isolation labels that match reality** — a whitelist or VM façade is API
   discipline unless an external authority prevents access to ambient powers.

## Reusable guidance

- Make plugin registration reversible and expose the resolved boot graph; a
  configuration tree that cannot be inspected or unwound is merely dynamic
  global state.
- Log control decisions as well as successful model steps, including rejected or
  empty admissions and the tool vocabulary active for each request.
- Keep durable session facts, in-flight lifecycle signals, and capability-policy
  hooks as separate event domains.
- Enforce permissions at each capability's execution boundary. Describe file,
  network, process, and remote-environment guarantees separately.
- Record escalation as a distinct authorized execution, never as an invisible
  retry within one tool result.
- For model-authored extensions, distinguish API restriction, process isolation,
  persistence, and auditability. They solve different risks.
- Treat early popularity and an extensive internal gate inventory as prompts for
  inspection, not evidence that the runtime is stable or independently verified.

## Primary sources

- Repository at inspected revision: https://github.com/deepseek-ai/deepseek-harness/commit/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e
- Architecture: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/architecture.md
- Repository agent instructions and compatibility stance: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/AGENTS.md
- Self-referential Cordis toolset decision: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/.agents/notes/implemented/feature/2026-07-08-self-referential-cordis-toolset.md
- Sandbox and escalation decision: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/.agents/notes/implemented/feature/2026-07-06-sandbox.md
- Web approval composition: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/.agents/notes/implemented/feature/2026-07-23-web-permission-and-approval.md
- Defensive runtime patterns: https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/docs/defensive-patterns.md
- Developer-preview release: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2
- Updated repository revision: https://github.com/deepseek-ai/deepseek-harness/commit/c291e7961a515f6d7af9304e7fd1d257929aef26
- Released-format streaming migrations: https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md
- Read-only migration preparation: https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/.agents/notes/implemented/architecture/2026-09-05-read-only-session-migration-preparation.md
- Canonical V3 session envelopes: https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/.agents/notes/implemented/architecture/2026-09-06-v3-canonical-session-envelopes.md
