# Agent Conventions

## Current Documentation

The canonical convention docs are maintained under the current app layout:

### Directory Layout And System Prompt Assembly

→ `projects/may-agent.app/docs/2b-manual/agent-convention.md`

### Agent Operating Skills

→ `shared/skills/README.md`
→ `shared/skills/LIBRARY.md`
→ `shared/skills/*/SKILL.md`

### Design Philosophy And Work Model

→ `projects/may-agent.app/docs/1-principles/core-principles.md`
→ `projects/may-agent.app/docs/1-principles/work-model.md`
→ `projects/may-agent.app/docs/2a-design/projects.md`

### Team And Agent Docs

→ `projects/may-agent.app/docs/2a-design/agents.md`
→ `agents/<agent>/AGENTS.md`

---

## Layout Rule

Top-level `/app` should expose only the core namespaces: `agents/`, `shared/`, `projects/`, `gym/`, `test/`, runtime `.state/`, and repo metadata. Legacy root content belongs in scoped agent/project/shared folders or under `projects/_archive/legacy-root/`.
