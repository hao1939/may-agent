# May Agent App

This repository is the app-owned configuration and project workspace for the may-agent system.

## Layout

- `agents/` — agent identities, prompts, tools, workflows, and per-agent workspaces.
- `shared/` — shared knowledge, skills, guards, workflows, docs, and compatibility SDK surface used by agents.
- `projects/` — project context maps, journals, discussions, outputs, and project-local tools.
- `gym/` — behavior/evaluation scenarios for agent quality work.
- `test/` — app-level tests and fixtures.
- `.state/` — runtime state only; not a source namespace.

Legacy top-level material from older layouts is archived under `projects/_archive/legacy-root/` or under the relevant shared archive.
