# Durable state

This directory owns typed operations on the shared Host SQLite database.
Callers supply the connection; operations retain their existing transactions and
revision checks. Schema upgrades and foundational transaction helpers remain in
`src/lib/db/`. Execution and model judgment happen outside these transactions.

| Start here | Owns |
| --- | --- |
| `app-task-resource-store.ts` | Canonical Tasks, attempts, Conditions, results and fenced mutations |
| `app-inbox-store.ts` | Admitted input, exact Task links and readable historical Turn facts |
| `app-event-admission-store.ts` | Recorded routing decisions and delivery progress |
| `inbox.ts` | Atomic Task admission with input/Topic links; exact result projection |
| `conversations.ts` | Conversation reads and Topic links |
| `conversation-requests.ts` | Accepted asks and scoped revision checks |
| `conversation-task-turns.ts` | Task-owned Turn admission, fenced decision acceptance and scoped Stop |
| `task-emissions.ts` | Exact published-fact reads scoped to App, Task, generation, type and local effect key, using the event journal index and shared verified body loader |
| `task-reference-index.ts` | Lookup/display of exact Task references |

Offline completion-receipt import (`task-receipt-cutover.ts`) lives under
`src/app/migrations/` outside the runtime `core/state` store modules.

The Task runtime decides transitions; these operations enforce their storage
boundaries. Events announce meaningful changes and accelerate discovery, while
durable state remains authoritative. There is no extra server or storage queue.

Submission identity belongs to `app-inbox-store.ts`. Its verified read and reuse
operations serve creation, Host submission, Conversation admission and frozen
Event commands. Receipt acknowledgment does not require the current App schema;
independent Task/Condition effects still require their execution owner. Registry
reload validation uses the same canonical Event-to-submission identity as dispatch.

A keyed desired-Task admission retains a hash of the original request separately
from its resolved specification. Exact replay returns its recorded generation
through later revisions, changed agent defaults and owner closure without a new
mutation or debit. Fresh work still passes current authority, funding and closure
checks. Older admissions retain their existing specification comparison; missing
original request metadata is never reconstructed from today's defaults.

Budget admission uses the Task's immutable creator as well as its recipient App
to identify retained work requiring explicit attribution. Unconfigured independent
services keep their own scope. Standing allowances match the full App/Task identity.
Task creation wakes exact deferred creation inputs in the same transaction;
saving a hold rechecks existence so a concurrent free attachment cannot be lost.
Adopting a contribution wakes both it and its bound root, with their exact input
holds, without charging historical work.

Bounded Task context retains the exact current and observed attempt references
before filling the remaining history slots. Timestamp order alone cannot select
execution authority or accepted facts: clocks can move backwards, and two
attempts can share a timestamp. The history limit remains 16 attempts per Task.

Offline completion-receipt conversion (`src/app/migrations/task-receipt-cutover.ts`)
requires the Host and every worker to be stopped, after the normal database
schema upgrade. Receipt import preserves original historical receipts and links
their exact generation/specification to accepted outcomes on closed Tasks;
newer Task generations and existing human closure remain unchanged. The older
pre-#449 open-state cutover (`task-state-cutover.ts`) and runtime cutover
harnesses were retired in PR #477 after all installations completed cutover.

App runtime preparation rejects unconverted completion receipts before admitting
or executing work. Run the offline conversion first. Admission, claims, recovery
and dependency readiness use retained Tasks; an archived receipt cannot delete
a Task or satisfy a newer assignment. Read-only history views still support old
receipts, and the original archive remains available to conversion and inspection.

Colocated store tests cover claims, revisions, transactions and reopen behavior.
`inbox.test.ts` covers cross-resource attachment; `conversation-requests.test.ts`
covers accepted-ask fences and closure.
