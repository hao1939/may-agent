# Agent Conventions

## Current Documentation

The canonical convention docs are maintained under the current app layout:

### Directory Layout And System Prompt Assembly

→ `shared/may-agent-docs/manual/agent-convention.md`

### Agent Operating Skills

→ `shared/skills/README.md`
→ `shared/skills/LIBRARY.md`
→ `shared/skills/*/SKILL.md`

### Design Philosophy And Work Model

→ `shared/may-agent-docs/core-principles.md`
→ `shared/may-agent-docs/work-model.md`
→ `shared/may-agent-docs/design/project-focused-architecture.md`

### Team And Agent Docs

→ `shared/may-agent-docs/agents.md`
→ `agents/<agent>/AGENTS.md`

---

## Layout Rule

Top-level `/app` should expose only the core namespaces: `agents/`, `shared/`, `projects/`, `gym/`, `test/`, runtime `.state/`, and repo metadata. Legacy root content belongs in scoped agent/project/shared folders or under `projects/_archive/legacy-root/`.
