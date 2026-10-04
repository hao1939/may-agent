# Keep domain policy in Apps, keep the Host generic

**Supports:** [Host and App boundary](../2a-design/system-boundary.md). App changes
should improve the system without requiring unrelated Host edits or losing work.

**Choice basis:** [One authority for each resource](../1-principles/core-principles.md#one-authority-for-each-resource)
and [simple first](../1-principles/core-principles.md#simple-first). Reuse trusted
installation configuration, definition releases and existing event admission;
do not add a role registry, another scheduler or a second ownership system.

**Status:** Accepted direction; the October 4 source candidate is under review
in Host PR #326 with a companion Apps change. It has not been deployed.
The [September review](../archive/reviews/app-policy-boundary-baseline-20260913.md)
retains earlier decisions and evidence. Its old App IDs and rollout status are
historical, not current instructions.

## What the migration exposed

Moving improvement work into Alex should require changing Apps and installation
wiring. Instead, Host documentation required a particular sibling manual,
file tools granted privileges by agent name, human interfaces assumed May was
both agent and App, and reports inferred policy from evaluator names and job
paths. Deployment tests even imported retired executable Apps.

The root cause was treating one installation as the system contract. Replacing
one hard-coded name with another would keep the same dependency.

Follow-up review exposed the same authority problem within configuration:
startup honored a CLI override while send and maintenance independently read
environment defaults. Missing Conversation configuration also selected direct
chat in some paths. The candidate now resolves the complete binding once per
CLI invocation, passes it into each mode, and rejects missing human routing
at client and Host admission. The owning
[installation contract](../2a-design/system-boundary.md#installation-declarations)
defines this rule; agents do not need to understand these transport choices.

## Candidate changes

| Decision | Owner and implementation |
| --- | --- |
| Where human input and explicit notices go | Installation environment selects agent, App and retained Conversation independently. Console, Telegram, WebUI and control clients use that binding. Missing binding is explicit; a headless Host still runs Tasks. |
| Who can edit domain-protected files | Installation commits `shared/file-write-policy.json`. Host captures it in the definition release and preserves it when execution changes directory. Names alone confer no rights. |
| Which agents are available | Runtime and WebUI reuse enabled-App discovery, including `.disabled`. |
| What a metric or failed workflow means | Host preserves declared ownership and execution facts. An unattributed metric belongs to `system:host`; its label cannot assign an agent. Apps translate subscribed workflow facts into their own input schemas. |
| Whether quiet activity needs review | App policy decides. Generic reports show observations without assuming a required heartbeat or evaluation for every session. |
| Where domain tooling and acceptance checks live | Gym owns its runners and recording wrappers. Apps own their policy and acceptance tests. Host CI uses portable contract fixtures. |
| Which manual a Host contributor must read | Local Host source maps, contracts and tests suffice. Relevant App requirements arrive in the assignment or PR context. |

File tools retain generic protection for shared guidance and agent configuration.
The installation preserves its previous intended grants explicitly and protects
Alex's evaluation criteria. The policy file cannot grant its writer permission
to rewrite itself through those tools. Shell and native CLI access remain a
separate enforcement boundary; these file guards are not a filesystem sandbox.

Task-owned workflow failures continue through their existing Task result and
recovery path. A blocked standalone workflow publishes `workflow.owner.requested`
with its exact run and owner; the receiving App declares the translation. Host
must not fabricate `owner-review` for arbitrary App schemas.

## Adoption and remaining work

Commit the companion policy and provide `shared/host.env` to the installation
before rolling out the reviewed Host. Preserve `may:primary` for this installation;
new destinations are configuration choices, not a history migration. A retained definition release created by an older Host does not contain this
file: roll out under maintenance and explicitly reload the companion Apps
revision before resuming work. Reload selects a new immutable policy generation;
already prepared execution retains its captured grants. Neither source edit rewrites retained work or history.

Gym recording now defaults to its own `.state/gym.db`. `GYM_RESULTS_DB` explicitly
selects an older retained database. No database is moved or deleted by this change.
Retired Gym-emission and May-cron tests targeted removed workflows; current Alex
comparison tests and generic Host emission/admission tests own current behavior.

Verification must cover independent agent/App names, missing destination,
disabled-App discovery, policy capture and execution rebinding, current App
admission, and retained result/retry behavior. Source checks establish these
contracts, not model judgment or live adoption.
CLI process trials also use conflicting `--agent`, `AGENT` and `DAEMON_AGENT`
values: sends retain the App/Conversation, headless interface input is rejected,
other recipients remain usable, and maintenance probes the selected daemon.

The migration of retained legacy Tasks is still Alex's work. Private maintenance
capabilities and optional retained reporting schemas need their own consumer
reviews before removal. Do not infer that zero hard-coded names establishes
complete isolation, or move a safeguard without its consumer and replacement.
