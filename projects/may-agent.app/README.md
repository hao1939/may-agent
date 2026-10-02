# The App that maintains May (`may-agent`)

This directory contains the ordinary App that maintains and improves May.
Runtime knowledge, investigation, review and deployment policy are its domain,
not a special Host subsystem. Its stable technical App ID remains `may-agent`
so retained Task identities do not change.

Its contribution to [May's overall goal](docs/1-principles/purpose.md#mays-goal)
is to keep the Host dependable and affordable to operate and change, so May
and domain Apps can deliver useful results with less human supervision.
Judge runtime work by that contribution and its total cost. Use the
[decision and review guide](docs/1-principles/core-principles.md#review-rule)
for proposals, implementation choices, and reviews.

## Boundary

- `../may-agent/` is the platform/runtime code workspace. It should remain a
  normal portable repo.
- `app.ts` is the single canonical maintenance App manifest: addressed
  input, event schedules, task subscriptions, actions, and task policy.
- `../may.app/app.ts` is the separate May App (`appId: may`): it owns the
  Conversation, answers human requests directly, or requests typed work from
  the responsible App. It does not create a Task merely to track a request.
- `project.json` is the structured project frame for goal, owner, workspace,
  and current strategy.
- Host Task resources are the sole mutable work authority. Retained
  `.state/tasks/state.json` and `.state/tasks/tree.json` files are migration
  evidence or generated projections, never runnable authority.
- `tasks/seed.json` is used only to initialize an empty runtime state.
- `docs/` contains system design, principles, manuals, and proposals for May
  and the Host.
- `.state/` contains local runtime state. Durable understanding belongs in
  project metadata, design, workflows, receipts, and domain evidence.
- `archive/` keeps migrated legacy platform project files for audit.

## Layout

| Path | Purpose |
| --- | --- |
| `app.ts` | Maintenance App declaration and Task admission policy. |
| `agents/` | App-local execution profiles and their callable code or curated knowledge. |
| `docs/1-principles/` | Stable design principles. |
| `docs/2a-design/` | Current system contracts. |
| `docs/2b-manual/` | Operator and authoring guidance. |
| `docs/proposals/` | Active proposals and implementation trackers only. |
| `docs/archive/` and `archive/` | Historical evidence; never current authority. |
| `tasks/seed.json` | Empty-state bootstrap data only. |
| `.state/`, `artifacts/`, `evidence/`, `outputs/` | Local generated state and evidence; not source. |

An agent directory needs only `agent.json` and `AGENTS.md`. Add a workflow,
handler, packaged `skills/<name>/SKILL.md`, or indexed knowledge only when it
has a current caller or durable use. Runtime logs, status snapshots, backup
files, and loose Markdown under `skills/` do not belong in the live source
tree.

## Commands

```bash
bun run syntax
bun run typecheck
bun run check
```

The app package checks only the app declaration and local TypeScript boundary.
Run platform/runtime checks from `../may-agent/`.
