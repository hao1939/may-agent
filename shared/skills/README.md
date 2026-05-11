# Agent Skills

This directory contains reusable skills (markdown guides) that agents can read to learn specific capabilities.

## Philosophy (P52, P81)
- **Skill Over Agent**: If an agent can read a doc and do the job, don't delegate.
- **Skill Hardening**: Repeated actions should become scripts or formal skills.
- **ZeroToken Goal**: Execute complex tasks with minimal token overhead by following proven paths.

## Structure
- Each skill is a markdown file or directory.
- Agents read the skill, follow the instructions, and execute.
- Prefer `agents/shared/skills/<name>/SKILL.md` for new shared skills.
- Keep skills narrow. If a behavior needs deterministic execution, use a
  workflow or handler instead of adding a longer skill.

## Current System Skills

- `system-investigation/SKILL.md` — investigate runtime, metrics, alerts,
  handlers, workflows, guards, sessions, socket, and Telegram failures.
- `reading-metrics/skill.md` — react to metric signals without treating them as
  automatic judgments.
- `project-loop-driver/SKILL.md` — drive durable projects through intensive
  work and monitoring.
- `control-plane-operation/SKILL.md` — use events, workflows, SDK helpers, and
  socket control without bypassing the daemon.

Skills are most effective when a workflow/task injects the relevant skill
content. Do not assume agents will discover this directory by themselves.

## Verification

Use the smallest check that proves the risk you are working on:

1. **Skill contract:** `bun test test/shared-skills.test.ts`
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
