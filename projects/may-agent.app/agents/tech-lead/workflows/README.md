# May-agent App Workflows

Reusable Host Operations workflows belong here when a repeated bounded process
is useful enough to outgrow a direct agent attempt.

`app.ts` maps addressed input and facts to Tasks; reconciliation invokes an
explicit App-local workflow or the selected agent. The App owns the Task,
`tech-lead` is its default execution profile, and May remains the human-facing
deputy.
