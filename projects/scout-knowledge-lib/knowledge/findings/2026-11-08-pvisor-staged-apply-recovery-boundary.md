<ai_context>
summary: "Pinned pVisor source separates staged execution, selective publication, recover-forward file apply, and external effects; its durable apply ledger narrows interrupted-write ambiguity without making a multi-file apply atomic against non-cooperating writers."
triggers: ["pVisor", "PolicyVisor", "stagebox", "staged workspace", "selective apply", "apply recovery", "coding agent sandbox"]
last_updated: "2026-11-08"
source_basis: "GitHub Repository Search API discovery plus static inspection of pVisor documentation and apply implementation at commit 84b0898acc80ef0aa886ff3c1dcb066d88e9f530. Scout did not build or run pVisor, its tests, an agent, FUSE, a VM, or a fault-recovery scenario."
</ai_context>

# Selective agent-file acceptance still needs an interrupted-apply receipt

**Date:** 2026-11-08  
**Disposition:** New source-grounded finding  
**Repo:** https://github.com/DeepLink-org/pvisor  
**Inspected revision:** [`84b0898acc80ef0aa886ff3c1dcb066d88e9f530`](https://github.com/DeepLink-org/pvisor/commit/84b0898acc80ef0aa886ff3c1dcb066d88e9f530)

## Question

What does a staged coding-agent workspace need beyond a reviewable diff when the operator accepts only some changed paths and publication is interrupted?

## Source observation

pVisor's agent-style `stagebox` keeps workspace changes staged until an operator reviews them, applies selected paths, and drops the rest. The pinned README demonstrates accepting `hello.txt` while discarding `scratch.txt`, but also states that file acceptance does not undo remote API calls, database writes, charges, or files already applied. Its executor matrix further distinguishes staged workspace writes from other host-path writes and warns that isolation depends on the selected executor.

The apply implementation adds a narrower durability contract around local file publication. Before writing, it requires sealed preimages, acquires a per-target lock, detects conflicts, and records a durable apply intent. Ledger states distinguish `Prepared`, `TargetApplied`, and `Committed`; apply-owned private backups and preimages survive interruption. Recovery reads the existing batch and reconciles it forward rather than deleting the ledger and replaying the whole operation. The failure-semantics document explicitly says an interrupted apply may leave some target files changed and directs recovery through the existing ledger and preimages.

This is stronger than treating a visible diff or a successful command exit as the publication receipt. The durable batch identity preserves what was selected, what base state was checked, and whether target mutation or cleanup may already have occurred. It therefore gives a recovery routine evidence with which to distinguish pending work from work that reached the target.

## Evidence boundary

The repository also states the limitation that matters most: multi-file apply is not atomic against external editors. pVisor's target lock coordinates cooperating pVisor applies, but another program that ignores that lock can interleave writes. The implementation and documentation support recover-forward local publication under their stated ownership and filesystem assumptions; they do not prove one indivisible multi-file transaction, semantic correctness of accepted changes, or rollback of external effects.

The staged filesystem is not the whole authority boundary either. Host execution, OCI execution, and VM execution provide different isolation, network, and host-path guarantees. Daemon APIs do not expose the native Session stage/apply semantics. A reviewed file set therefore cannot be used as evidence that all agent effects were staged or that the selected executor contained every equivalent route.

**Operational implication:** retain a stable apply identity and explicit phase receipt for selectively accepted agent changes. Review answers *what may be published*; preimages and conflict checks answer *whether the reviewed base still applies*; the apply ledger and backups answer *how to recover an interrupted publication*; post-apply verification must still answer *whether the resulting project is valid*. Record remote and non-filesystem effects separately because dropping the stage cannot reverse them.

## Material inspected

- [Pinned README and stagebox walkthrough](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/README.md)
- [Apply implementation](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/crates/pvisor-overlay-core/src/apply.rs)
- [Failure semantics](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/docs/src/en/design/failure-semantics.md)
- [Known limitations](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/docs/src/en/security/known-limitations.md)
- [Executor boundaries](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/docs/src/en/security/executor-boundaries.md)
- [Staging and apply semantics](https://github.com/DeepLink-org/pvisor/blob/84b0898acc80ef0aa886ff3c1dcb066d88e9f530/docs/src/en/concepts/staging.md)

Scout inspected static project material only. It did not build or run pVisor, execute project-authored tests, invoke an agent, exercise FUSE or a VM, inject a write failure, or independently validate the documented recovery states.

## Discovery record

GitHub Repository Search API queries, sorted by recent update with ten results per query:

- `ai agent runtime pushed:>=2026-10-20 stars:>50` — `incomplete_results: false`
- `coding agent sandbox pushed:>=2026-10-20 stars:>20` — `incomplete_results: false`
- `multi agent orchestration pushed:>=2026-10-20 stars:>50` — `incomplete_results: false`

Repository metadata and popularity were used only for discovery, not as evidence that the implementation works.
