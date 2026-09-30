# Live document observation — September 30, 2026

The merged observation path worked with the real sample reviewer. The Host
saved an ordinary wait, observed changed file data, and resumed the owner, which
read the document and returned a supported review. The owner used the installed
contract to construct its Conditions. No synthetic ready event, manual wake,
Task-storage edit or corrective message was needed.

## Deployment and activation

- Host: `dc6395dbccd0c1d7d2e95356859d9a9aec952734` (PR #270), installed as
  `v5.2.0 (dc6395db)` through the normal standalone deployment script.
- Receipt: `projects/may-agent/.state/deploy-receipts/sample-observation-dc6395db-20260930.json`.
  It reports success and matching built/loaded SHA-256
  `8ca59b589bc32444377e2dffaf6864b21a5cea0b7d0f267baddbf5519093393c`.
  Readiness and all three supervisor services were healthy; the existing
  container was retained.
- Initial App definition: `7ad541e0cabea9c4c0932e536f23e89bede7102f`.
  Reload request `6488910` links successful completion `6488912` at that revision.
  The exact installed App read exposes observer `document`, a ten-second
  interval, five-second read timeout and recent resource health.
- Evidence-retention refinement: `c8833824d72d0c6355378a12600b9d35c3115745`.
  Reload `6489020` links successful completion `6489022` at that revision.

These are installation-local receipts. Raw inputs, exact public Task/event
reads, creation times, selected tool-call evidence and retained source bytes
are under `/app/.state/review-pilots/sample-observation-20260930/`.

## Trials

The supervisor submitted ordinary `review` inputs and later supplied files.
Inputs explicitly asked the reviewer to prepare, wait for the required document
and avoid continuous self-polling; they supplied the README and Host design.
This tests informed agent adoption, not unguided discovery or a model benchmark.

| Trial | Behavior and result |
| --- | --- |
| Missing document | The reviewer prepared, called `tasks.contract` with an observation interest, and saved `available: true`. After the file was created, event `6488955` satisfied the Condition. The owner resumed 17.9 seconds after creation and correctly identified all three planted false claims, supported the other two, and verified the file hash. |
| Existing file, wrong revision | The reviewer recognized the old draft, preserved its preliminary finding and saved a wait for the requested SHA-256. File presence did not satisfy it. Replacement produced event `6488986`; the owner resumed 12.4 seconds later, verified the 476-byte revision, resolved the old finding and returned two reasonable wording suggestions. |
| Repeat after evidence refinement | The reviewer retained and verified its own snapshots before waiting. All five preliminary citations remained readable and hash-matching after source replacement. Event `6489047` resumed the owner 32.4 seconds after replacement; it completed the review and retained the new revision. All three final artifact references also verified. |

Each review used two owner attempts: preparation/wait, then substantive review.
All three ended `converged` with no remaining Conditions, input waits or pending
events. The human
view displays `up-to-date`, meaning the current work is reconciled; these are
not cancelled or manually closed Tasks. The observed delays include scheduling
and are not a latency guarantee.

Exact identities:

| Trial | Task | Waiting attempt | Receiving attempt |
| --- | --- | --- | --- |
| Missing document | `sample:review/app_a612c95f-c895-43bf-a9b4-ca8371b593e3` | `r_1_d91645f9-7b94-499c-bf36-b50fd91d612d` | `r_1_1a3abaee-1e43-49b2-ad80-02069352f6f1` |
| Required revision | `sample:review/app_8a0a06fe-6274-4241-95bf-f18a385aa768` | `r_1_d08bf47a-59ed-480f-b1e7-d8569b848585` | `r_1_db8db53b-2c2a-42ad-bd94-fa431c5ab1f5` |
| Refined evidence | `sample:review/app_24a49706-3f4d-4e02-b126-b1bd0dc93640` | `r_1_11047bfe-5041-49db-8cdb-93fd3459aa8b` | `r_1_978b1556-49fd-4d54-a344-d78a5ea8d4d1` |

## Refinement from the trial

The second preliminary result cited mutable file paths. Once the source changed,
the old path no longer matched its recorded hash. The supervisor retained the
verified old bytes before replacement; `preserved-artifacts.json` maps original
references to those copies. That is assisted evidence preservation, not success
of the reviewer's original evidence handling.

The sample reviewer now retains mutable reviewed text with the existing
`EvidenceStore`, verifies it and cites the retained path while identifying the
original source. This applies to partial reviews too. Immutable definition
snapshots remain directly usable. It strengthens the existing App evidence
convention; no Host mechanism, new input type, or separate watch lifecycle was
added. The common quickstart already documents the same helper.

The fresh repeat demonstrated adoption without an additional evidence instruction
in its input. Its final result cites the new revision and report; the retained
comparison documents remain linked from the earlier accepted result. Consumers
must follow that history when they need those copies. Retention adds file I/O
and agent work; this small trial does not establish a net efficiency gain.

The original revision trial also had one rejected `finish` call: a waiting
result supplied a top-level `response` unsupported by that result variant.
The agent moved the response into its App result and succeeded within the same
attempt after tool validation. Optional feedback-file probes returned missing
files without preventing delivery. These are recovered tool errors, not
error-free executions or proof of unknown-failure recovery.

## Scope and checks

The sample detector's portable check covers missing/present/changed content,
byte identity, invalid paths, read failures and abort. The common design/example
and canonical App checks passed. Deployment also passed its 64 portable control
checks. The merged Host had already passed its separate full CI gate.

The live trials establish useful owner continuation on this installed local-file
capability. They do not establish observer failure recovery, process restart,
large-resource capacity, external credentials, cross-App caller return or
independent Evaluation detection. Those need separate evidence; deliberate
fault injection belongs in isolation. Review quality remains an agent judgment,
not a consequence of receiving an observation.
