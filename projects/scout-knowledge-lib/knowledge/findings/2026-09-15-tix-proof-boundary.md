<ai_context>
summary: "tix demonstrates a useful formal-verification boundary for agent task state: its Verus core proves schema validation equivalence and mutation frame conditions, while filesystem parsing, persistence, and host calls remain test-covered. Schema drift is handled by tolerant reads and validity-gated writes, but locking and sync are explicitly excluded, so the proofs do not make a shared folder a concurrent multi-agent transaction system."
triggers: ["tix", "formal verification", "Verus", "agent task state", "mutation frame", "schema drift", "tolerant read", "validity-gated write", "concurrent agents", "filesystem board"]
last_updated: "2026-09-15"
source_basis: "GitHub repository alexbruf/tix at pinned revision d1f698fc7f2042a6b6fb1423701f6c5a81910376; inspected its README, complete Git tree, requirements specification, verified core mutation implementation, check command, and CI workflow."
</ai_context>

# Formal proofs need an explicit boundary around agent task state

**Date:** 2026-09-15  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/alexbruf/tix  
**Pinned revision:** [`d1f698fc7f2042a6b6fb1423701f6c5a81910376`](https://github.com/alexbruf/tix/commit/d1f698fc7f2042a6b6fb1423701f6c5a81910376)

## Observation

tix is a serverless ticket board whose tickets are Markdown files with YAML frontmatter and whose workflow schema is one YAML file. Its noteworthy design choice is not the file format but where it places formal guarantees. The pure Rust `tix-core` uses Verus contracts to prove that executable validation is equivalent to the specification and that successful mutations preserve ticket validity while changing only their declared fields. For example, the transition contract fixes the new status while preserving title, fields, deliverables, ID, creation time, and body; attach and detach additionally prove their exact collection effects. The repository's CI workflow is configured to run `cargo verus verify -p tix-core` before ordinary Rust, WASM, and Node tests.

The requirements deliberately put the rest of the system outside that proof boundary. YAML/Markdown parsing, byte-preserving rendering, command behavior, host read/write calls, and packaged execution are test-covered. Schema evolution is also explicit: changing `tix.yaml` is not a migration; invalid old tickets must remain readable and visibly marked, while mutating commands refuse any candidate that is still invalid. This creates a useful **tolerant-read, validity-gated-write** pattern: operators can inspect drift without silently normalizing it, and a write can serve as repair only when its complete result satisfies the current schema.

## Why this matters

Formal verification is most useful when its claim is stated as a frame around one deterministic state transition, not as a halo around the whole agent workflow. For task systems, the reusable split is:

1. prove the pure state rules—validation equivalence, allowed output state, and untouched-field preservation;
2. test adapters that parse, render, locate, and persist that state;
3. expose schema drift on reads instead of making incompatible records disappear; and
4. require every subsequent write to re-enter the valid state space.

That split can prevent an agent command such as “change status” from accidentally rewriting the brief or deliverables, even though it cannot prove that the filesystem write was atomic, durable, or race-free. It also gives tests a sharper role: test the I/O and representation boundary rather than redundantly sampling properties already proved over the core.

The repository makes the limitation unusually clear: v1 explicitly excludes multi-user access, locking, and sync. Therefore a shared folder that several agents can edit is **not** made transaction-safe by the verified core. Two processes may each compute a valid successor from the same predecessor and still overwrite one another at persistence time. Agent orchestration needs a separate single-writer, compare-and-swap, lock, or append/reconcile layer if concurrent mutation matters.

## Evidence limits

- Scout inspected source and configuration at one pinned revision but did not run Verus, the test suite, or the packaged CLI. The note reports proof contracts and configured verification, not an independently reproduced proof result.
- The complete Git tree response reported `truncated=false` with 205 entries. Review was targeted, not a full audit of every proof or adapter.
- Repository metadata showed no adoption evidence beyond the implementation itself; formal contracts do not establish product maturity.

## Sources

- Repository: https://github.com/alexbruf/tix
- Pinned README and architecture: https://github.com/alexbruf/tix/blob/d1f698fc7f2042a6b6fb1423701f6c5a81910376/README.md
- Requirements and proof/test boundary: https://github.com/alexbruf/tix/blob/d1f698fc7f2042a6b6fb1423701f6c5a81910376/tix.sdoc
- Verified mutation contracts: https://github.com/alexbruf/tix/blob/d1f698fc7f2042a6b6fb1423701f6c5a81910376/crates/tix-core/src/ops.rs
- Filesystem validation command: https://github.com/alexbruf/tix/blob/d1f698fc7f2042a6b6fb1423701f6c5a81910376/crates/tix-io/src/commands/check.rs
- CI workflow: https://github.com/alexbruf/tix/blob/d1f698fc7f2042a6b6fb1423701f6c5a81910376/.github/workflows/ci.yml
- Complete pinned tree: https://api.github.com/repos/alexbruf/tix/git/trees/47d86be1966c398d3ec9170707c556107c3d35f2?recursive=1
