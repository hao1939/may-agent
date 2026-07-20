# Tech-Lead Context

## Workspace

- App project: `/app/projects/may-agent.app`
- Runtime/domain repo: `/app/projects/may-agent`
- Global deputy/chat agent: `/app/agents/may`

`may-agent.app` is the project. `tech-lead` is its owner. May is outside the
project ownership model and handles human chat, deputy judgment, and system
escalation paths.

## Start Here

- `projects/may-agent.app/project.json`
- `projects/may-agent.app/app.ts`
- `projects/may-agent.app/.state/tasks/tree.json`
- `projects/may-agent.app/docs/2a-design/agent-app.md`
- `projects/may-agent.app/docs/2a-design/events.md`
- `projects/may-agent.app/docs/3-proposals/chat-agent-separation.md`

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
