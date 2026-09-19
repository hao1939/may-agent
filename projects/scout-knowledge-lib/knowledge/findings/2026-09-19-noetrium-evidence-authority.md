<ai_context>
summary: "GitHub finding on Noetrium's separation of artifact finalization, evidence validity, execution outcome, task outcome, and scientific validity. A sealed, verified evidence bundle can establish artifact integrity without acquiring authority to claim task or scientific success."
triggers: ["Noetrium", "evidence bundle", "artifact finalization", "scientific validity", "run outcome", "reproducible agent research", "authority separation"]
last_updated: "2026-09-19"
source_basis: "Static inspection of README, reproducibility contract, evidence manifest/publisher implementation, outcome contracts, and focused repository tests at commit c179eea33819ab96d6a0bbdababe7d7ba137bb6a. Tests were inspected but not executed."
</ai_context>

# Noetrium: Evidence Integrity Is Not Scientific Validity

Date: 2026-09-19  
Source: GitHub  
Repo: https://github.com/Xalzeroph/Noetrium

## Signal

Noetrium is an early research-infrastructure repository that treats an AI-agent
experiment as a chain of separately owned facts rather than a single “passed”
status. Its most reusable design signal is narrow: **a finalized evidence bundle
can prove which immutable artifacts belong to a run without claiming that the
run solved its task or supports a scientific conclusion.**

At the inspected revision, the run-control receipt has four distinct outcome
fields: execution, task, evidence, and scientific validity. The contract derives
execution from the authoritative machine phase and evidence validity from a
typed finalized bundle receipt. It rejects any task or scientific verdict other
than `NOT_EVALUATED`, because run control does not own either judgment.

## Source-grounded details

- **Repository status:** GitHub metadata described a public repository with two
  stars at observation time. This is an implementation signal from a very early
  project, not evidence of adoption or production reliability.
- **A bundle is bound to the run definition:** `EvidenceBundleManifest` schema
  v2 requires both `run_id` and the SHA-256 digest of the exact run launch
  manifest. Stream descriptors embed typed `RunArtifactSnapshotReceipt` values
  instead of accepting loose caller-supplied path, count, and hash fields.
- **“Complete” is gated by artifact authority:** before publishing a `COMPLETE`
  bundle, `RunArtifactEvidenceBundlePublisher` calls `verify_finalized()` for
  every stream and requires the returned receipt to be identical. A missing,
  unfinalized, changed, forged, or wrong-run stream therefore cannot authorize a
  complete manifest.
- **Raw and derived evidence remain distinct:** raw streams are the finalized
  evidence sources. Derived artifacts name the source stream IDs they depend on,
  making a projection rebuildable without silently replacing its inputs.
- **The manifest is itself sealed:** publication writes the canonical manifest
  through the run-artifact store, finalizes it, checks its digest, and verifies
  the resulting receipt. Replaying publication is intended to be idempotent only
  for identical sealed content.
- **Outcome authority remains narrower than integrity:** `RunControlReceipt`
  maps the machine phase to execution outcome and a finalized bundle receipt to
  `FINALIZED_VALID`. Its constructor rejects a task verdict other than
  `NOT_EVALUATED` and a scientific verdict other than `NOT_EVALUATED`.
  Consequently “the run completed” and “the evidence bytes are valid” cannot be
  promoted by this layer into “the task succeeded” or “the hypothesis is valid.”
- **Focused tests encode adversarial cases:** the inspected tests cover old or
  malformed schemas, unknown fields, empty required streams, missing sources,
  unfinalized streams, forged counts or digests, content drift, wrong-run stores,
  and idempotent republication. Separate run-control tests cover evidence as a
  read-only projection over the same machine cut and fail-closed handling of
  unfinalized evidence.

## Why it matters

Agent evaluation stacks often flatten several propositions into one green badge:

1. the process reached a terminal phase;
2. the captured artifacts are authentic and complete;
3. the task-specific evaluator says the behavior succeeded; and
4. the evidence supports a broader scientific claim.

Those propositions have different evidence and different owners. Noetrium's
contract demonstrates a practical type-level barrier: the component that can
prove artifact closure is explicitly unable to mint task or scientific
validity. This prevents an integrity check from becoming a semantic verdict by
accident.

A portable agent-evaluation receipt should preserve at least these axes:

| Axis | Example authority | What it does not prove |
| --- | --- | --- |
| Execution | journaled runtime phase | task correctness |
| Artifact integrity | finalized, reverified content receipt | semantic relevance |
| Evidence closure | run-bound complete manifest | evaluator validity |
| Task outcome | task-specific oracle or reviewer | general scientific claim |
| Scientific validity | declared analysis/review protocol | deployment safety |

The non-obvious implication is that stronger cryptographic or storage integrity
can increase the risk of overclaiming if interfaces still render everything as
“verified.” A trustworthy UI and downstream schema must carry the authority
boundary all the way to the final claim.

## Limitations

This assessment is static. Scout inspected the pinned source and focused tests
but did not install the project, execute its test suite, reproduce an experiment,
or validate durability across a real crash. Repository documentation also says
older manifest schemas are rejected rather than migrated implicitly; that
fail-closed choice improves identity clarity but creates a compatibility burden
for existing records. The finding concerns the checked contracts and code paths,
not the project's broader claims of complete reproducibility or recoverability.

## Primary sources

- Inspected revision: https://github.com/Xalzeroph/Noetrium/commit/c179eea33819ab96d6a0bbdababe7d7ba137bb6a
- Pinned repository tree: https://api.github.com/repos/Xalzeroph/Noetrium/git/trees/c179eea33819ab96d6a0bbdababe7d7ba137bb6a?recursive=1
- README and authority model: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/README.md
- Reproducibility contract: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/noetrium_platform/research/experimentation/REPRODUCIBILITY.md
- Evidence manifest types: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/noetrium_platform/research/experimentation/run/manifest/api/evidence.py
- Evidence codec and publisher: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/noetrium_platform/research/experimentation/run/manifest/runtime/evidence.py
- Run outcome contract: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/noetrium_platform/research/experimentation/run/control/api/contracts.py
- Evidence-bundle tests: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/tests/test_experiment_evidence_bundle_v1.py
- Run-control tests: https://github.com/Xalzeroph/Noetrium/blob/c179eea33819ab96d6a0bbdababe7d7ba137bb6a/tests/test_durable_run_control_v1.py
