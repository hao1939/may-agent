---
summary: "Shashankss1205/OpenDots binds required-check results to both workspace content and check configuration, revalidates after artifact retention, and keeps failed-task notes out of shared memory; this makes local completion evidence revision-specific without settling external effects."
triggers: ["Shashankss1205/OpenDots", "content-bound checks", "workspace fingerprint", "check signature", "required checks", "completion evidence", "artifact retention"]
last_updated: "2026-10-02"
source_basis: "GitHub Repository Search API discovery followed by static inspection of pinned README, implementation, validation record, and repository-authored evidence tests at bb8db954445d15ba815a9278cf07c51d20bb5109. The code and tests were not executed."
---

# Local completion evidence needs content and configuration identities

<ai_context>
Use this finding when a durable agent reports that a check passed. A check name and exit code are insufficient: admission should bind the result to the exact workspace bytes, executable check configuration, sandbox mode, task attempt, and final retained artifact. This still proves only the configured local predicate, not external-effect settlement.
</ai_context>

**Observed:** 2026-10-02  
**Disposition:** New source-grounded finding  
**Coverage:** GitHub repository search (`"AI agent" runtime created:>2026-09-25`, sorted by stars; 94 results; `incomplete_results: false`), pinned repository README, implementation and validation documents, `opendots/evidence.py`, relevant `opendots/engine.py` paths, and `tests/test_evidence.py`. Static inspection only.

## Sources

- **Repo:** [Shashankss1205/OpenDots](https://github.com/Shashankss1205/OpenDots) — an independent local runtime, not the similarly named `CopilotKit/OpenDots` project already covered in the library
- **Pinned revision:** [`bb8db954445d15ba815a9278cf07c51d20bb5109`](https://github.com/Shashankss1205/OpenDots/commit/bb8db954445d15ba815a9278cf07c51d20bb5109)
- **README:** [`README.md`](https://github.com/Shashankss1205/OpenDots/blob/bb8db954445d15ba815a9278cf07c51d20bb5109/README.md)
- **Evidence identity:** [`opendots/evidence.py`](https://github.com/Shashankss1205/OpenDots/blob/bb8db954445d15ba815a9278cf07c51d20bb5109/opendots/evidence.py)
- **Admission path:** [`opendots/engine.py`](https://github.com/Shashankss1205/OpenDots/blob/bb8db954445d15ba815a9278cf07c51d20bb5109/opendots/engine.py)
- **Repository-authored tests:** [`tests/test_evidence.py`](https://github.com/Shashankss1205/OpenDots/blob/bb8db954445d15ba815a9278cf07c51d20bb5109/tests/test_evidence.py)
- **Validation record:** [`docs/VALIDATION.md`](https://github.com/Shashankss1205/OpenDots/blob/bb8db954445d15ba815a9278cf07c51d20bb5109/docs/VALIDATION.md)

## Source observation

OpenDots is a new, low-adoption local prototype that coordinates CLI agents or model APIs around persistent targets, events, heartbeats, approval rules, managed worktrees, and owner-configured checks. Its completion path contains a useful evidence pattern that is narrower than a generic “tests passed” receipt.

A successful check records two independent identities. `workspace_fingerprint()` hashes a sorted inventory of workspace-relative files, modes, content, and relevant symlink targets, including Git-ignored inputs while excluding designated credential and generated-cache paths. `check_signature()` separately hashes the owner-configured command and selected sandbox mode. At completion, the engine accepts a required check only when both identities still match the current target.

That binding is enforced at several cut points:

1. Writes after a check clear the satisfied-check set.
2. Owner-required checks omitted by a model plan are appended as audited actions and still pass through ordinary policy or approval handling.
3. Completion recomputes current evidence before artifact retention and again afterward; a workspace change while retaining the proposal fails admission.
4. Approval context includes the workspace fingerprint, checks, sandbox, policy, write scopes, protected paths, required checks, and success conditions, so changed review context requires another decision.
5. Legacy check records without the content and configuration signatures are revalidated rather than grandfathered.
6. Notes become shared target memory only after successful completion; failed-task notes remain in the audit trail instead of being published as durable learning.

The selected repository tests encode adversarial cases for an external edit during review, a changed owner check command, mutation during artifact retention, a “passing” check that changes its own input, a Git-ignored validation input, legacy unsigned evidence, and a failed task that proposed a success-sounding note. These are repository-authored regression claims, not independently reproduced behavior.

## Interpretation

Completion evidence has at least four identities: **what bytes were checked, which predicate ran, under which execution boundary, and which task/artifact is being admitted**. Reusing only a check name or green exit code allows stale evidence to survive a code edit, a command change, a weaker sandbox, or finalization-time mutation. Recomputing both content and configuration identity at the admission boundary makes the local verdict revision-specific.

This does not turn local validation into business-effect proof. OpenDots' own implementation document states that filesystem operations and SQLite commits are not one atomic cross-system transaction, and its scope boundaries disclaim arbitrary side-effect atomicity, lossless ingestion, production hosting, and multi-day soak behavior. A content-bound local check can justify a retained patch while an earlier remote API effect remains uncertain. Local artifact admission and external-effect settlement therefore need separate receipts.

## Limits

- The repository had 14 stars at inspection and was created the previous day; this is an early implementation signal, not evidence of broad operational adoption.
- Scout did not install OpenDots, run its tests, execute a live model task, or reproduce interruption and artifact-retention scenarios.
- The repository's validation document reports current CI and historical live-agent results, but Scout did not independently inspect all run logs or reproduce those counts.
- The workspace fingerprint intentionally excludes credential locations and generated caches. The implementation document also notes that excluded inputs, external services, and executable/runtime changes outside the signed check configuration remain outside the local evidence claim.
- Required checks prove only owner-configured predicates. A complete green local gate can still omit a relevant requirement or misclassify an external effect.
