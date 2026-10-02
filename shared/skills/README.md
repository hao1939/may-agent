# Agent Skills

This directory contains canonical reusable skill packages that agents can read
to learn specific capabilities.

## Philosophy

- A skill gives an existing agent a reusable judgment method; it is not a new
  worker, work record, or lifecycle.
- Promote repeated deterministic sequencing to a workflow and mechanical
  checks to scripts or guards. Frequency alone does not justify promotion.
- Keep guidance compact and evidence-backed. Retire it when the runtime or app
  structurally owns the behavior.

## Structure
- Each canonical skill is a `<name>/SKILL.md` package, with optional
  `references/`, `scripts/`, and `assets/` beside it.
- Agents read the skill, follow the instructions, and execute.
- Loose Markdown files are legacy documentation, not discovered skills.
- Keep skills narrow. If a behavior needs deterministic execution, use a
  workflow or handler instead of adding a longer skill.
- Treat the immediate `<name>/SKILL.md` packages as the catalog. Do not maintain
  a second hand-written registry or copy skill bodies into knowledge files.

Practical manuals can live directly in these packages. The May design
[documentation index](../../projects/may-agent.app/docs/INDEX.md#tier-2b--manuals)
links to the canonical design authoring and Task execution skills. Update affected
skill guidance together with design changes; maintain one body for people and
agents. Their references require the May documentation tree alongside `shared/`.

## Current System Skills

- `system-investigation/SKILL.md` — investigate runtime, metrics, alerts,
  handlers, workflows, guards, sessions, socket, and Telegram failures.
- `reading-metrics/SKILL.md` — react to metric signals without treating them as
  automatic judgments.
- `project-loop-driver/SKILL.md` — drive durable projects through intensive
  work and monitoring.
- `control-plane-operation/SKILL.md` — use events, workflows, SDK helpers, and
  socket control without bypassing the daemon.

The runtime supplies a bounded metadata catalog. The agent reads a complete
skill when its trigger matches, or a caller names one explicitly. New sessions
receive catalog changes; existing persistent chats retain their prompt snapshot.

## Verification

Use the smallest check that proves the risk you are working on:

1. **Skill contract:** `bun test test/integration/shared-skills.test.ts`
   - verifies frontmatter, key operating rules, README references, and obvious
     misleading wording.
2. **Skill delivery path:** `bun test test/agents-tool.test.ts`
   - verifies `agents.call` and `agents.fork` append `context_files` to the
     receiving task.
3. **Control-plane smoke:** emit one representative daemon event and verify the
   durable trace.

```bash
docker exec may-agent may-agent --emit trigger.metrics-snapshot '{}'
```

Then check the event store for `trigger.metrics-snapshot`,
`handler.started`, and `handler.completed`.

Behavioral proof still needs a gym or production comparison. Contract tests
prove the skill is valid and deliverable; they do not prove it changes agent
behavior.

## 🔴 Security Warning (P78)
**Treat Skills as Untrusted Code.**
- Do NOT auto-load skills from the internet.
- All skills must be reviewed and committed to this repository.
- Malicious skills can hijack agent behavior (Skill-Inject attack).
- Verify the content of any new skill before using it.
