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
- Discover immediate `<name>/SKILL.md` packages here and in optional directories
  listed in `paths.json`. Do not maintain a second hand-written skill registry
  or copy skill bodies into knowledge files.

May's practical skill manuals stay in `projects/alex.app/docs/2b-manual/`.
Task starts, reuse, delegation and recovery use the canonical
[Task execution guide](../../projects/alex.app/docs/2b-manual/task-execution-guide/SKILL.md).
The [documentation index](../../projects/alex.app/docs/INDEX.md#tier-2b--manuals)
links to the canonical design authoring and Task execution skills. Update affected
skill guidance together with design changes; maintain one body for people and
agents. `paths.json` points discovery at that directory; see the
[optional-path contract and availability](../../projects/alex.app/docs/2a-design/skills.md#optional-discovery-paths).

Use the [skill discovery and invocation contract](../../projects/alex.app/docs/2a-design/skills.md)
for loading and applying skills. The runtime supplies the metadata catalog;
read or invoke the selected skill through the supported execution path. There
is no general requirement to copy skill bodies into every task message, produce
a planning checklist for every task, or replace a needed file read with memory.

Execution allowances and retry limits come from the caller/runtime and the
operation's policy. The Task execution guide owns continuation, saved waits and
result reporting; `obstacle-pivot` supplies tool-failure diagnosis within those
bounds. Preserve requirements and useful partial work when an execution ends.

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

From the Apps checkout, run the current shared-guidance checks:

```sh
bun test ./shared/tests/deployment/shared-skills.test.ts
```

They verify metadata, maintained guidance, README package references and owner
prompt preparation against the checkout's compatible Host source/dependencies.
They do not require a running daemon. For a discovery or invocation change,
also run `bun test src/lib/skills.test.ts` from the matching Host source checkout.
Check affected agents' actual catalogs when packages or discovery paths change,
including diagnostics and entries omitted by the prompt bound.

These checks establish packaging and delivery mechanics. A claim of better agent
judgment needs a separate comparison on representative work; a valid package or
an old experiment's percentage does not establish that claim.

## 🔴 Security Warning (P78)
**Treat Skills as Untrusted Code.**
- Do NOT auto-load skills from the internet.
- All skills must be reviewed and committed to this repository.
- Malicious skills can hijack agent behavior (Skill-Inject attack).
- Verify the content of any new skill before using it.
