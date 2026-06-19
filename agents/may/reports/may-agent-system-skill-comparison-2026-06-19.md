# May-Agent System Skill Comparison

## Compared Artifacts

- Codex candidate:
  `/app/.state/cli-skill-candidates/may-agent-system/codex/may-agent-system/SKILL.md`
- Claude candidate:
  `/app/.state/cli-skill-candidates/may-agent-system/claude-after-fix/may-agent-system/SKILL.md`
- Installed merged skill for Codex workers:
  `/app/.state/.codex/skills/may-agent-system/SKILL.md`
- Installed May-local skill:
  `/app/agents/may/skills/may-agent-system/SKILL.md`

Both original candidates were 172 lines and passed `quick_validate.py`.

## Summary Judgment

The Codex candidate was the better operational skill for May-agent maintenance.
It behaved like a maintainer checklist: read the source-of-truth docs, preserve
the owner loop, avoid event and metric anti-patterns, and verify with focused
checks.

The Claude candidate was the better architecture reference. It gave a compact
mental model, event envelope shape, project-app layout, task lifecycle, metric
pipeline, escalation lifecycle, owner workflow pattern, and key principles.

The installed skill should use Codex as the base and merge Claude's concise
architecture framing. That is the current installed state.

## Detailed Comparison

| Area | Codex candidate | Claude candidate | Decision |
| ---- | --------------- | ---------------- | -------- |
| Trigger description | Concrete May-agent maintenance surfaces and paths. | Broad architecture-reference trigger. | Prefer Codex; it triggers better on real repo work. |
| Source-of-truth docs | Explicit doc paths for principles, events, metrics, escalation, apps, task tree, alerts, chat separation. | No source-of-truth path list. | Prefer Codex; May must read design docs before behavior changes. |
| Operating procedure | Strong loop: owner boundary, active files, evidence, smallest change, focused verification. | Mostly explanatory architecture sections. | Prefer Codex. |
| Architecture overview | Missing in original candidate. | Strong concise model: event -> owner routing -> judgment -> evidence -> state -> follow-up event. | Merge Claude into Codex. |
| Event model | Strong anti-pattern guidance and canonical project event guidance. | Strong envelope example and event-family list. | Codex base; Claude envelope can inform future docs but not needed in full. |
| Project app model | Good boundaries and task-tree behavior. | Better compact V3 layout and owner workflow pattern. | Merge Claude's V3 shape and owner workflow pattern. |
| Task tree | Strong operational constraints around owner/worker roles and valid states. | Good lifecycle diagram, less operational caution. | Prefer Codex. |
| Metrics | Strong guidance that metrics are signals, owner resolved by convention, no manual DB edits. | Good pipeline sketch. | Prefer Codex; keep pipeline idea implicit through docs. |
| Escalation | Strong distinction between local blockers and ownership-boundary escalation. | Good lifecycle sketch. | Prefer Codex. |
| Verification | Explicit change checklist. | No comparable finish checklist. | Prefer Codex. |
| Token efficiency | Practical but dense. | Very concise and readable. | Merge only concise pieces that improve orientation. |

## What Was Installed For May

The May-local skill was installed at:

`/app/agents/may/skills/may-agent-system/SKILL.md`

It mirrors the validated merged skill: Codex operational checklist plus Claude's
architecture overview, core primitive definitions, Project App V3 shape, owner
workflow pattern, and key principles.

May's discovery surfaces were updated:

- `agents/may/AGENTS.md`
- `agents/may/skills/README.md`
- `agents/may/context.md`

## Remaining Note

Codex CLI workers auto-discover the Codex skill through
`CODEX_HOME=/app/.state/.codex`. May does not use Codex's skill discovery
mechanism directly, so May needs the separate local skill under
`agents/may/skills/`.
