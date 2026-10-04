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
- `projects/gym/` - standalone behavior/evaluation project for agent quality
  work.
- `projects/alex.app/` - improvement owner, evaluation and comparison specialists,
  shared design manual and preserved improvement knowledge.
- `contracts/` - explicit system contracts.
- `scripts/` - reusable app-level scripts.
- `projects/alex.app/docs/` - durable May-agent system docs, principles,
  manuals, and design notes.
- `.state/` - runtime/local state only; leave it out of source layout cleanup.

Root-level files should be limited to entry docs, package/build config, and
repo-wide conventions. Durable papers, docs, and research syntheses should be
curated into a knowledge base, not left at root or under top-level `docs/`.
One-off research scripts should live under `scripts/` only when reusable;
otherwise keep them local.

See `projects/alex.app/docs/2a-design/app-root-layout.md` for the current
root classification and cleanup guidance.

## Host installation declarations

`shared/host.env` selects this installation's interface agent, Conversation App
and existing Conversation ID. Supply it as environment to the Host and its
adapters. For Compose, add `/app/shared/host.env` to the service `env_file`
list in the installation override, alongside its existing credential file.
Compose `--env-file` alone supplies interpolation variables; it does not pass
every value into the container. Keep credential files separate. This source file is not loaded automatically by the Host and does not
change a running container.

`shared/file-write-policy.json` declares domain protections and intended writer
grants. Host PR #326 captures it during definition activation.
These are file-tool safeguards, not shell or native CLI filesystem permissions.
Load these declarations before starting the Host with the matching definition release. Retained Tasks,
Requests and Conversation history keep their existing identities.

Run installed policy/guide acceptance with `bun run test:deployment`; Gym's
script tests run from its package. Generic Host tests remain in the Host repo.
