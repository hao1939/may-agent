# Scout Knowledge Library App

This Agent App adds schedules, observation, durable task reconciliation, and
delivery to the independently runnable Scout knowledge-library project in
[`../scout-knowledge-lib`](../scout-knowledge-lib).

## Current contract

- [`app.ts`](app.ts) is the only App declaration.
- [`design/scout-knowledge-library-process.md`](design/scout-knowledge-library-process.md)
  owns Scout's current operating model.
- [`design/scout-knowledge-library-layout.md`](design/scout-knowledge-library-layout.md)
  owns the current durable library layout.
- [`tasks/README.md`](tasks/README.md) explains the task resources and their
  generated read projection.
- [`design/archive/`](design/archive/) retains completed proposals and rollout
  evidence; those files are not current instructions or deployment targets.
- [`archive/agents/`](archive/agents/) preserves the retired Amy and Amy-Kimi
  agents and their historical research. The Host does not load agents from the
  archive; `agents/scout/` is the only active agent in this App.

The Host owns persistence, scheduling, attempts, recovery, and delivery. Scout
owns research judgment and library meaning. Historical runtime commits,
worktrees, rollout commands, and incident snapshots are evidence only.

Credentials belong in ignored runtime state or the external credential source,
never in the tracked agent or knowledge archive.

## Development

```bash
cd /app/projects/scout-knowledge-lib.app
bun run check
```
