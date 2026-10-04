# Agent Conventions

## Current Documentation

The canonical convention docs are maintained under the current app layout:

### Directory Layout And System Prompt Assembly

→ `projects/alex.app/docs/2b-manual/agent-convention.md`

### Agent Operating Skills

→ `shared/skills/README.md`
→ `shared/skills/*/SKILL.md`

### Design Philosophy And Work Model

→ `projects/alex.app/docs/1-principles/core-principles.md`
→ `projects/alex.app/docs/1-principles/work-model.md`
→ `projects/alex.app/docs/2a-design/projects.md`

### Team And Agent Docs

→ `projects/alex.app/docs/2a-design/agents.md`
→ `agents/<agent>/AGENTS.md`

---

## Layout Rule

`/app` is the shared checkout on `main`. Finish work by merging meaningful,
verified source changes into `main` and leaving its Git status clean. Coordinate
the final switch or cleanup while other sessions are editing the checkout.

Keep temporary clones, Git worktrees, scratch and recovery archives outside
`/app`, for example under `~/workspace-worktrees/` and `~/workspace-archive/`.
Preserve unique commits, uncommitted files and evidence before removing a
checkout. Completed research belongs in its project knowledge base; unfinished
experiments stay in the external archive with a clear disposition.

Source belongs in `agents/`, `shared/`, `projects/` and `scripts/`, with entry
docs and package/build config at the root. Gym lives at `projects/gym/`.
Dependencies, runtime `.state/`, local tool configuration and separately managed
project repositories retain their documented homes and Git ignore rules.
See the [root layout contract](projects/alex.app/docs/2a-design/app-root-layout.md).
