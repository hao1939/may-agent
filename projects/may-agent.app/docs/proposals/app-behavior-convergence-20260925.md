# App behavior convergence review

The common model is **read current facts → choose useful authorized work →
verify the effect → retain remaining obligations on the same Task**. Code
provides dependable mechanics; agents judge uncertain meaning. A structurally
accepted result establishes settlement, while evidence establishes whether the
chosen action serves the assignment.

## Scope and status

The installation catalog reported May, Scout, Evaluation and Gym loaded. This
review inspected their active role instructions and selected failure/return
boundaries, based on App workspace revision
`706b0ae4bb9633e6729f11248506061b14b53aa8` and Host revision
`17a7cdae`. Historical and paused Apps remain unassessed for live behavior.
The paused may-agent App remains paused; this document is common design work.

Host candidate commit: `a6049e5e3c8a8f79eefcea7f7813e496d35c13e6` on
`fix/recovery-instructions-20260925`. Companion App changes are on
`fix/unified-behavior-20260925`.

The candidate changes guidance and Evaluation's judgment criteria. It introduces
no Task state, schema, controller, queue or runtime restriction. The listed code
gaps remain open. Source checks, agent behavior and deployment are separate
claims; changed instructions alone establish neither recovery nor full adoption.

The preceding read-only investigation is retained locally at
`/app/.state/review-pilots/recovery-assumption-audit-20260924/REVIEW.md`, with
production-function probes and the exact two XHS review publications. Its
synthetic probes establish behavior at the tested functions, not general live
incidence. XHS subsequently resumed through normal observation and reconciliation;
the actor who restored access was not established.

## Findings by owner

| Owner and inspected path | Finding | Candidate or remaining work |
| --- | --- | --- |
| Host `src/app/adapters/executors/managed-agent.ts`, shared assignment guidance | “Never self-unblock” is broader than the actual forbidden self-targeted state action. | Replace with authorized repair, verification, ordinary settlement and external observation guidance. Keep existing state/approval enforcement and the five-kilobyte protocol budget. |
| Scout `AGENTS.md`, `design/scout-knowledge-library-process.md` | Setup belongs to the workflow, but the owner is told to preserve its wait interpretation. | Teach evidence preservation plus owner judgment and document the source gap explicitly. |
| Scout `tools/lib/xhs-credential.ts`, `workflows/scout-explore.ts:191` | Missing tab, broken connection, malformed probe output and actual login all lead to the same human wait. | Open code defect. Separate observed login need from setup/unknown failure, perform bounded authorized setup, and return remaining uncertainty to the same owner. Keep observers read-only. |
| Scout `tools/lib/xhs-source.ts`, `workflows/library-health.ts` | Unusable search rows become empty success; inaccessible library reads become empty values, including coverage 1 with zero samples. | Open code defects. Preserve observation availability and rejected data alongside usable partial results. A missing README is already flagged; the whole health packet is not silently healthy. |
| Evaluation `criteria/criteria.md`, evaluator role and `task-outcome-review.ts` | Recorded facts and workflow provenance are treated too strongly; the inspected XHS reports establish coherence but miss wait necessity. | Use one evidence contract, clarify independent support, and inspect recovery, wait necessity and request delivery in existing report fields. DeepSeek shares the same role file. Agent calibration remains necessary. |
| Evaluation `task-outcome-selector.ts` | Missing subject evidence retains `selector-evidence-unavailable` facts; bounded rotation and explicit failure inputs already exist. | Reuse these mechanisms. Sampling is not exhaustive coverage and Evaluation continues to exclude itself. |
| May role and `evaluation-report-intake.ts` | Intake already distinguishes unavailable evidence. The inspected no-concern dispositions nevertheless accept the XHS interpretation. | Add a bounded check of material wait/no-op premises and return useful feedback to the existing owner. Retain inexpensive routine review. |
| May `develop-change.ts:394,486` | Pass is accepted only with an empty findings list, although the schema describes general strings and Bob can report optional observations. | Open decision-model mismatch. Decide whether findings mean blocking defects or general observations; prefer honoring the explicit verdict and retaining observations, with tests for both passes and revisions. Existing candidate/verification fences remain necessary. |
| May Bob/tech-lead roles | Scope is largely expressed as prohibitions. | Give positive instructions for candidate work, evidence read-back and returning decisions to the creator. Preserve existing publication/approval authority. |
| Gym role and `compare-candidate.ts` | Missing or mismatched frozen evidence already produces an explicit blocked result. Some role instructions broadly prohibit handling runtime Tasks. | Explain ordinary result settlement versus App-owned requirement changes; retain exact frozen identities, comparison evidence and human approval boundaries. Unknown-failure agent recovery remains unproven. |

The recurring defect is promoting an observation into an unjustified decision,
then treating consistent state as proof of that decision. Repeated reconciliation
and more reports will not by themselves remove that premise.

## Reusable verification cases

Apply these cases at each relevant App boundary using its actual supported
operations. An App can mark an inapplicable case with a reason. Keep exact tests
with their owning implementation; the table is review guidance, not a second
test framework or required lifecycle.

| Case | Expected evidence |
| --- | --- |
| Known authorized setup is missing | Setup executes, its effect is verified, original work resumes on the same identity. |
| Human-only login, authority or choice is confirmed | Concrete correlated request is delivered and retained in the human-action view; useful independent work can continue. |
| Tool output is corrupt or a read fails | Exact failure remains available for diagnosis; independent useful observations survive. |
| A read succeeds with no results | Truthful empty result with its scope; additional work is decided by the owner. |
| A workflow recommends an unjustified wait | Owner examines the premise and uses the supported recovery/result path; unrelated obligations remain. |
| A prior attempt failed but the effect already exists | Owner reads and verifies the existing effect before choosing any repeat. |
| A useful result has non-blocking observations | Verdict, evidence and observations coexist; required acceptance still governs. |
| A model cannot substantiate its assessment | Report names the exact unknown scope; confirmed independent findings remain distinct. |

For model behavior, retain the original failing case and an opposite control.
Use a bounded independent review or Gym comparison when it adds value. A mocked
reply passing admission proves wiring, not the model's choice. Calibration of
Evaluation belongs to independent supervisor review; its normal external-App
restriction remains intact.

## Ongoing assurance through existing owners

The [workflow-authoring review method](../2b-manual/workflow-authoring.md#checking-app-behavior)
owns the reusable practice. Existing CI and App tests cover mechanically decidable
contracts. Evaluation uses its current event inputs and periodic selector to
assess actual behavior, including accepted waits and no-ops. May judges impact,
the simpler alternative and value versus cost; the original owner recovers
current work, with separate improvement only when independently worthwhile.

A human should be able to read, for each reviewed App/revision: the relevant
case, exact evidence, observed result, coverage limitation, accountable owner
and next action. Use existing Task results and Evaluation report fields. A
dated matrix like this is an audit result, not an authoritative live registry.
Track unassessed scope explicitly and revisit it after relevant changes or
new failures rather than claiming all Apps comply from a green test count.

## Validation

- `bun run check:may-design`: design links, checked SDK examples and canonical App integrity passed.
- Evaluation `bun run check`: syntax, types, formatting and all 210 tests passed.
- Host `bun run ci`: types, SDK/boundary checks, lint and 3,245 tests passed; three installation-catalog tests were explicitly skipped by the portable suite. The protocol is 5,076 bytes within the existing 5 KiB budget.
- May: 119 tests passed, one existing conditional integration test skipped. Gym: all 11 tests passed.
- Scout: 420 tests passed; the PDF fixture failed because the development Python lacked the pinned reader. Installed the existing `requirements-source.txt` into an isolated test virtualenv and reran the affected source-assessment suite: all 18 tests passed, including real PDF extraction. The live environment was unchanged.
- Evaluation's first run exposed two pre-existing wall-clock-sensitive selector fixtures; both failures reproduced on unchanged source. Those production-entry fixtures now use a current timestamp; the fixed-clock selection tests retain their explicit clock.
- Removed assertions tied to prohibition wording. Protocol size/identity and actual Task/Condition enforcement tests remain; a sentence match is not evidence of model behavior.
- No production activation or live model calibration was performed. The open source gaps above remain independent work.
