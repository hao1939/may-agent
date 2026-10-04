# Tech-Lead Context

## Workspace

- App project: `/app/projects/may-agent.app`
- Runtime/domain repo: `/app/projects/may-agent`
- Global deputy/chat agent: `/app/agents/may`

`may-agent.app` is the Host Operations App. The App owns its Tasks and selects
`tech-lead` as the default execution profile. May handles human conversation,
deputy judgment, and routing but does not own Host Operations work.

## Start Here

- `projects/may-agent.app/project.json`
- `projects/may-agent.app/app.ts`
- `projects/may-agent.app/docs/2a-design/agent-app.md`
- `projects/may-agent.app/docs/2a-design/system-model.md`
- `projects/may-agent.app/docs/2a-design/events.md`
- `projects/may-agent.app/docs/proposals/design-implementation-convergence.md`

## Checks

- App checks: `cd /app/projects/may-agent.app && bun run check`
- Runtime checks: `cd /app/projects/may-agent && bun run check`
- Use narrower targeted tests when the change is localized and full checks are
  too expensive, but say so.

## Specialists

- `dev`: debugging, metrics, runtime failure analysis, small platform fixes.
- `arc`: architecture review, design coherence, stale concept cleanup.

Delegate focused work only when it saves real owner time. The owner remains
responsible for final judgment and loop closure.
