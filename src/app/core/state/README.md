# Durable state

This directory owns typed operations on the shared Host SQLite database.
Callers supply the connection; operations retain their existing transactions and
revision checks. Schema upgrades and foundational transaction helpers remain in
`src/lib/db/`. Execution and model judgment happen outside these transactions.

| Start here | Owns |
| --- | --- |
| `app-task-resource-store.ts` | Canonical Tasks, attempts, Conditions, results and fenced mutations |
| `app-inbox-store.ts` | Admitted input, exact Task links and readable historical Turn evidence |
| `app-event-admission-store.ts` | Recorded routing decisions and delivery progress |
| `inbox.ts` | Atomic Task admission with input/Topic links; exact result projection |
| `conversations.ts` | Conversation reads and Topic links |
| `conversation-requests.ts` | Accepted asks and scoped revision checks |
| `conversation-task-turns.ts` | Task-owned Turn admission, fenced decision acceptance and scoped Stop |
| `conversation-cutover.ts`, `task-receipt-cutover.ts`, `task-state-cutover.ts` | Offline import of prior Conversation execution, completed work and retained open Task state |
| `task-emissions.ts` | Exact published-fact reads scoped to App, Task, generation, type and local effect key, using the event journal index and shared verified body loader |
| `task-reference-index.ts` | Lookup/display of exact Task references |

The Task runtime decides transitions; these operations enforce their storage
boundaries. Events announce meaningful changes and accelerate discovery, while
durable state remains authoritative. There is no extra server or storage queue.

Bounded Task context retains the exact current and observed attempt references
before filling the remaining history slots. Timestamp order alone cannot select
execution authority or accepted evidence: clocks can move backwards, and two
attempts can share a timestamp. The history limit remains 16 attempts per Task.

Cutover helpers require the old Host and every worker to be stopped, after the
normal database schema upgrade. They are source operations, not an operational
upgrade runner. Receipt import preserves original historical receipts and links
their exact generation/specification to accepted outcomes on closed Tasks;
newer Task generations and existing human closure remain unchanged. Open-state
import then preserves maintained outcomes, restores original input/wait links,
and paces unfinished work with the existing retry deadline. Historical worker
self-stops become failure evidence on the same Task; human closure and Turn
Stop remain effective. Missing original input or conflicting accepted-attempt
identity aborts import rather than inventing an answer. Supervisor retirement
uses ordinary owner closure; an operational upgrade runner remains separate.

App runtime preparation rejects unconverted completion receipts before admitting
or executing work. Run the offline conversion first. Admission, claims, recovery
and dependency readiness use retained Tasks; an archived receipt cannot delete
a Task or satisfy a newer assignment. Read-only history views still support old
receipts, and the original archive remains available to conversion and inspection.

Colocated store tests cover claims, revisions, transactions and reopen behavior.
`inbox.test.ts` covers cross-resource attachment; `conversation-requests.test.ts`
covers accepted-ask fences and closure. `retired-conversation-waits.test.ts` checks
upgrades preserve admitted work and expose unfinished legacy turns as failed.
