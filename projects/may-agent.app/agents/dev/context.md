# Dev Context

## Primary References

- App manifest: `projects/may-agent.app/app.ts`
- Project model: `projects/may-agent.app/project.json`
- Task tree: `projects/may-agent.app/tasks/tree.json`
- App integrity design: `projects/may-agent.app/docs/2a-design/app-project-integrity.md`
- Events design: `projects/may-agent.app/docs/2a-design/events.md`
- Metrics design: `projects/may-agent.app/docs/2a-design/metrics.md`
- Runtime workspace: `projects/may-agent/`

## Useful Runtime Signals

- Recent handler failures: `handler.failed`
- Session failures: `session.resume_failed`, `session.recovery_failed`
- Delivery failures: `subscriber.failed`, `message.delivery_failed`
- Config failures: `agent.config_invalid`
- Metric loop signals: `metric.breach`, `metric.stalled`, `metric.recovered`

Use `query_db` for runtime inspection. Keep SQL bounded and focused.

## Output Locations

- Investigation notes: `projects/may-agent.app/agents/dev/workspace/investigations/`
- Durable design changes: `projects/may-agent.app/docs/`
- Runtime fixes: `projects/may-agent/`
- App workflow fixes: `projects/may-agent.app/workflows/`
