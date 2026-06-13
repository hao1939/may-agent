# May Agent App

This repository is the app-owned configuration and project workspace for the
May-agent system.

## Layout

- `agents/` - agent identities, prompts, tools, workflows, and per-agent
  workspaces.
- `shared/` - shared knowledge, skills, guards, workflows, docs, and
  compatibility SDK surface used by agents.
- `shared/knowledge/` - system-consumed knowledge base entries, conventions,
  concepts, and agent-operational knowledge.
- `projects/` - project apps, domain workspaces, and project archives. See
  `projects/README.md`.
- `projects/scout-knowledge-lib/knowledge/` - Scout-maintained external
  research and paper/doc knowledge library.
- `gym/` - behavior/evaluation scenarios for agent quality work.
- `contracts/` - explicit system contracts.
- `scripts/` - reusable app-level scripts.
- `projects/may-agent.app/docs/` - durable May-agent system docs, principles,
  manuals, and design notes.
- `.state/` - runtime/local state only; leave it out of source layout cleanup.

Root-level files should be limited to entry docs, package/build config, and
repo-wide conventions. Durable papers, docs, and research syntheses should be
curated into a knowledge base, not left at root or under top-level `docs/`.
One-off research scripts should live under `scripts/` only when reusable;
otherwise keep them local.

See `projects/may-agent.app/docs/2a-design/app-root-layout.md` for the current
root classification and cleanup guidance.
