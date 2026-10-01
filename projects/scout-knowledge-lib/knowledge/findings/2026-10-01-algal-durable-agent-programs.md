<ai_context>
summary: "Pinned GitHub assessment of ALGAL's durable agent-program VM: generation-bounded processes, exact-prefix receipt replay, explicit uncertain dispatch state, process-scoped tool idempotency, offline consistency verification, and the host responsibilities those mechanisms do not replace."
triggers: ["ALGAL", "durable agent program", "process receipt", "uncertain dispatch", "agent replay", "human approval", "effect idempotency", "offline verification"]
last_updated: "2026-10-01"
source_basis: "Scout reviewed the repository README sections on design, use cases, adoption limits, tools, and verification; the complete practical-workflows guide; and the complete process-v1 specification at pinned revision dc553dd32d42b7a53ae376ff02dbeee9a446847b. Scout did not clone or execute the software."
</ai_context>

# ALGAL Makes Waiting and Recovery Part of the Agent Program Contract

**Date:** 2026-10-01  
**Repo:** https://github.com/hraness/algal  
**Inspected revision:** [`dc553dd32d42b7a53ae376ff02dbeee9a446847b`](https://github.com/hraness/algal/commit/dc553dd32d42b7a53ae376ff02dbeee9a446847b)  
**Disposition:** New knowledge; no prior Scout note declared this repository as a primary source.

## What the source implements

ALGAL presents a programming language and VM for bounded agent procedures rather
than another conversational loop. Its repository describes typed model effects,
ordinary control flow, declared budgets, explicit approval points, content-addressed
program identities, and receipts that can be verified without calling the model
again. A native Rust CLI and a Bun runtime are intended to implement the same
manifest, receipt, and durable-process contracts.

The most useful implementation signal is the process state machine in
`spec/v1/process.md`. A named process advances through immutable, digest-linked
records. Before dispatch, the supervisor publishes an `uncertain` intent and
increments the generation. That state cannot be redispatched by the ordinary tick
or scheduler path. A completed generation instead records a receipt and becomes
`suspended`, `complete`, `failed`, or `stuck`. On continuation, previously completed
effects must remain an exact prefix of the new receipt, including metadata and
committed or skipped cells; only the suspended effect is retried through the
currently admitted host.

Tool requests receive a process-scoped idempotency key derived from the process
name and the original tool-request digest. This keeps repeated generations of one
process on the same request identity while separating byte-identical work in two
processes. The specification explicitly stops short of calling that exactly-once:
a mutable host tool still has to implement the key and reconcile an outcome that
became uncertain.

The practical guide turns those primitives into bounded examples: a proposal can
wait after the CLI exits and accept an exact approve or deny command later; a
coding-repair flow retains source identity, validation, and unknown job custody;
a portable evidence capsule can be checked away from the original store; and a PR
shepherd can wait on host events without spending model calls on polling. The
repository also describes a crash laboratory in which a completed effect replays,
an interrupted read may be attempted again, and an unacknowledged write stays
uncertain rather than being automatically redispatched.

## Why this matters

ALGAL makes a valuable separation concrete: **replayable computation, process
custody, approval authority, and external-effect settlement are different
contracts**. A receipt can prove that recorded execution is internally consistent
without proving that generated prose is true, a provider was authenticated, or a
remote write happened exactly once. This aligns with Scout's broader runtime
finding that recovery should preserve uncertainty rather than turn a missing
acknowledgement into permission to repeat an effect; see
[Agent Runtime Unattended Execution and Replay](../agent-runtime-unattended-execution-and-replay.md).

A reusable runtime pattern is therefore:

1. publish the exact dispatch intent before handing work to an executor;
2. retain an explicit uncertain state when settlement evidence is missing;
3. replay only the already verified prefix;
4. scope idempotency identity to the durable process, while requiring the external
   adapter to honor and reconcile it; and
5. describe offline verification as internal-consistency evidence, not external
   truth or authority.

## Evidence and limitations

Scout used GitHub's public Repository Search API with the query
`"AI agent" created:>=2026-09-01 stars:>=10`, sorted by recently updated. The
response reported `total_count: 280` and `incomplete_results: false`; ALGAL had 19
stars in the retrieved repository metadata. The recursive tree for the inspected
revision reported 1,651 entries and `truncated: false`.

Coverage was static: Scout reviewed the README sections covering the design,
examples, adoption boundary, external tools, verification, and test claims, plus
the complete `docs/use-cases.md` and `spec/v1/process.md`. Scout did not clone the
repository, build either runtime, run its tests or crash laboratory, inspect every
implementation file, or independently reproduce cross-runtime continuation,
filesystem durability, tamper rejection, or approval behavior. The repository's
own CI and test statements are author evidence, not independent validation.

The project describes itself as prerelease software. Native packages are unsigned
and unnotarized. It is an application VM, not an OS sandbox; host tools retain their
normal permissions. The host must still provide tenant authentication and
authorization, isolation for untrusted tools, store-wide quotas and retention,
distributed custody, and adapter-specific reconciliation. Deterministic demos show
orchestration and recovery mechanics, not live-model quality, production
reliability, or economic improvement.

## Primary sources

- [Repository README at the inspected revision](https://github.com/hraness/algal/blob/dc553dd32d42b7a53ae376ff02dbeee9a446847b/README.md)
- [Durable process specification](https://github.com/hraness/algal/blob/dc553dd32d42b7a53ae376ff02dbeee9a446847b/spec/v1/process.md)
- [Practical workflows and operating boundary](https://github.com/hraness/algal/blob/dc553dd32d42b7a53ae376ff02dbeee9a446847b/docs/use-cases.md)
