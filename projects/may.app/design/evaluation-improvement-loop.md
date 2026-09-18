# Evaluation-to-improvement pilot

The pilot is a composition of small ordinary Task stages, not one improvement controller.

1. **Publication (Evaluation):** immutable `evaluation.task_report_published` names subject App/Task, evidence hash, execution, report/facts paths and both content hashes. Publication can race its durable marker; May retries the same ordinary work and never trusts staged bytes.
2. **Disposition (May):** the explicit cross-target subscription normalizes the fact into a `message`. May uses Evaluation's published reader, rereads current subject outcomes/recovery/linked corrections, and records `invalid`, `retry-publication`, `recovered`, `no-op`, `reuse-linked-work`, or `candidate-needed` in the accepted Task result. Duplicate transport and unchanged semantic findings reuse accepted work.
3. **Candidate (responsible App):** existing isolated development prepares and commits one candidate with diff and verification receipts. Evaluation does not own this decision; Gym does not build it.
4. **Comparison (Gym):** an ordinary Gym goal carries a bounded `context.comparison`; Gym freezes exact baseline/candidate/benchmark/scorer/model/scenario/trial scope and returns a content-addressed receipt. Mechanical Host failures remain Host tests, not model training data.
5. **Approval (human):** a packet binds baseline and candidate commits/tree, complete diff, verification and comparison hashes, activation scope and rollback. Only the trusted human control path can approve the exact packet.
6. **Application (operator):** `applyWithExactApproval` is a mechanical identity fence around the existing operator route. Missing/rejected/stale/mismatched approval makes zero calls. Application and post-apply verification/rollback are separate from model judgment.

Each stage has an explicit input/output and retained evidence naming its failure stage. Candidate readiness is not integration, approval, activation, or deployment.
