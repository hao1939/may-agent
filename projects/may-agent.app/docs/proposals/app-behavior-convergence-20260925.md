# App behavior convergence review

**Supports:** [Host And App Boundary](../2a-design/system-boundary.md). Reviews whether App judgment and infra execution meet at the intended boundaries.

**Choice basis:** [Applicable philosophy and convention](../1-principles/core-principles.md#one-authority-for-each-resource); [compare competing choices](../1-principles/core-principles.md#resolve-conflicting-designs).

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

The candidate updates guidance and Evaluation criteria and repairs the four
App-level decision/observation defects below. It introduces no Host Task state,
controller, queue or runtime restriction. App observation evidence now retains
login-wall facts, unusable rows and failed reads. Source checks, agent behavior
and deployment remain separate claims; tests establish only the stated scope.

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
| Scout `AGENTS.md`, `design/scout-knowledge-library-process.md` | Setup belongs to the workflow, but the owner is told to preserve its wait interpretation. | Teach evidence preservation plus owner judgment; document setup, genuine login and uncertain failure separately. |
| Scout `tools/lib/xhs-credential.ts`, `workflows/scout-explore.ts:191` | Missing tab, broken connection, malformed probe output and actual login all lead to the same human wait. | Implemented: workflow preparation opens an absent tab and verifies access; only an observed login wall creates the human wait. Other failures return to the same owner. Observer status remains read-only. |
| Scout `tools/lib/xhs-source.ts`, `workflows/library-health.ts` | Unusable search rows become empty success; inaccessible library reads become empty values, including coverage 1 with zero samples. | Implemented: unusable-only search output fails; usable partial rows carry discard evidence. Health packets retain failed reads and valid findings together and wake through the existing path. Empty/unavailable coverage records no perfect sample. |
| Evaluation `criteria/criteria.md`, evaluator role and `task-outcome-review.ts` | Recorded facts and workflow provenance are treated too strongly; the inspected XHS reports establish coherence but miss wait necessity. | Use one evidence contract, clarify independent support, and inspect recovery, wait necessity and request delivery in existing report fields. DeepSeek shares the same role file. Agent calibration remains necessary. |
| Evaluation `task-outcome-selector.ts` | Missing subject evidence retains `selector-evidence-unavailable` facts; bounded rotation and explicit failure inputs already exist. | Reuse these mechanisms. Sampling is not exhaustive coverage and Evaluation continues to exclude itself. |
| May role and `evaluation-report-intake.ts` | Intake already distinguishes unavailable evidence. The inspected no-concern dispositions nevertheless accept the XHS interpretation. | Add a bounded check of material wait/no-op premises and return useful feedback to the existing owner. Retain inexpensive routine review. |
| May `develop-change.ts:394,486` | Pass is accepted only with an empty findings list, although the schema describes general strings and Bob can report optional observations. | Implemented: the explicit verdict governs acceptance and reuse; optional findings remain in evidence. Required changes use revise/redesign/clarify. Exact candidate and verification fences remain enforced. |
| May Bob/tech-lead roles | Scope is largely expressed as prohibitions. | Give positive instructions for candidate work, evidence read-back and returning decisions to the creator. Preserve existing publication/approval authority. |
| Gym role and `compare-candidate.ts` | Missing or mismatched frozen evidence already produces an explicit blocked result. Some role instructions broadly prohibit handling runtime Tasks. | Explain ordinary result settlement versus App-owned requirement changes; retain exact frozen identities, comparison evidence and human approval boundaries. Unknown-failure agent recovery remains unproven. |

The recurring defect is promoting an observation into an unjustified decision,
then treating consistent state as proof of that decision. Repeated reconciliation
and more reports will not by themselves remove that premise.

## Why the existing reviews missed the defect

The retained XHS attempts `r_2_01157aeb-84d9-4d40-9ac6-70af786db217`
and `r_2_5c0fbdf3-f26f-4aed-85b9-f138447b7803` contain the missing-tab
error. Evaluation publications 6425694 and 6425908 still praised the wait and
“no self-unblocking.” They checked coherence (owner, predicate and deadline),
while accepting the workflow's human-prerequisite interpretation as evidence.
May's corresponding intakes (`r_1_565baf30-1d91-4798-9605-ad4f8f5c4c38`
and `r_1_cc2f2ac9-5262-4e45-91d4-862d3ed01f20`) accepted no-action.
Thus review and delivery ran; the missing check was whether human intervention
was necessary given the actual failure and authorized setup. Existing tests
covered a legitimate login wait but lacked the missing-tab contrast.

The broad “Never self-unblock” wording plausibly reinforced this mistake; it
does not establish the models' internal cause. Runtime actually rejects the
self-targeted state override, not ordinary authorized setup. The earlier Codex
audit also accepted the human premise. More identical reconciliations or
reports would repeat the shared assumption. The correction separates observable
facts in code, clarifies owner action and adds contrasting production-path tests.
Evaluation/May guidance now uses the selective deeper review when signals merit
it, through existing reports and owner input. This is guidance, not proof that
future model judgment will always catch the error.

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

## Validation before the code correction

- `bun run check:may-design`: design links, checked SDK examples and canonical App integrity passed.
- Evaluation `bun run check`: syntax, types, formatting and all 210 tests passed.
- Host `bun run ci`: types, SDK/boundary checks, lint and 3,245 tests passed; three installation-catalog tests were explicitly skipped by the portable suite. The protocol is 5,076 bytes within the existing 5 KiB budget.
- May: 119 tests passed, one existing conditional integration test skipped. Gym: all 11 tests passed.
- Scout: 420 tests passed; the PDF fixture failed because the development Python lacked the pinned reader. Installed the existing `requirements-source.txt` into an isolated test virtualenv and reran the affected source-assessment suite: all 18 tests passed, including real PDF extraction. The live environment was unchanged.
- Evaluation's first run exposed two pre-existing wall-clock-sensitive selector fixtures; both failures reproduced on unchanged source. Those production-entry fixtures now use a current timestamp; the fixed-clock selection tests retain their explicit clock.
- Removed assertions tied to prohibition wording. Protocol size/identity and actual Task/Condition enforcement tests remain; a sentence match is not evidence of model behavior.
- No production activation or live model calibration was performed. Live owner recovery and evaluator recognition remain to be verified after activation; neither follows from a mocked model reply.

## Code-correction validation

The follow-up tests exercise the actual Node browser CLI against a local CDP
fixture: observation performs no setup; preparation opens a missing tab once,
checks the DOM and reuses it; an actual login wall still yields human help.
This fixture is synthetic and does not claim live XHS or model behavior.
Production workflow tests contrast unknown failures, genuine login, empty
searches and unusable records. Filesystem tests retain a valid health finding
beside EISDIR/missing-path failures and verify that no false metric is recorded.
Real-Git development tests retain optional findings on a pass, reuse that exact
candidate and continue rejecting changed candidates and failed verification.
Follow-up validation passed:

- Scout `bun run check`: syntax, types, formatting, projections/navigation and all 433 tests. The existing pinned PDF dependency came from the isolated test virtualenv.
- May `bun run check`: types, formatting and 119 tests; one existing conditional integration test skipped. Two pre-existing code-block formatting violations were normalized so the full check could run.
- Evaluation `bun run check`: all checks and 210 tests.
- Common design integrity, SDK examples and canonical App checks passed.
- The read-only health CLI was checked separately after exposing its packet observations. A read-only run against the current real library inspected 1,546 Markdown files with no I/O errors and retained 26 existing maintenance facts. It emitted no events and changed no library or runtime state.

Exact logs and the read-only packet are retained under
`/app/.state/review-pilots/unified-behavior-20260925/`. Changes remain local
candidates. Live owner recovery and evaluator/May recognition have not been
retested or claimed as fixed behavior.
