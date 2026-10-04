# May-agent App Workflows

Reusable Host Operations workflows belong here when a repeated bounded process
is useful enough to outgrow a direct agent attempt.

`app.ts` maps addressed input and facts to Tasks; reconciliation invokes an
explicit App-local workflow or the selected agent. The assigned agent owns the
Task. The App extends its owner agent, `tech-lead`, with scoped policy, knowledge
and capabilities; May remains the human-facing deputy. Workflow execution does
not transfer Task ownership.

`platform-owner-review` uses the SDK's current Task result schema and adds only
its owner-signal disclosure. It preserves the owner's decision: a request does
not create a wait unless the owner declares a Condition. Supporting evidence
belongs in `facts`, including an unsuccessful attempt's partial results.

Each App's `app.test.ts` checks its own schedules and input routing. Apps may
use different schedules or none; a common owner heartbeat is not a requirement.
