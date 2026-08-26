# Coach Context

## Environment

- Workspace root: `/app`
- Host Operations App: `/app/projects/may-agent.app`
- Host Runtime: `/app/projects/may-agent`
- Gym scenarios: `/app/projects/gym/scenarios`
- Coach source: `/app/projects/may-agent.app/agents/coach`

Use the current Task packet as work authority. Read exact referenced sessions,
evaluations, scenarios, and artifacts on demand. Historical knowledge and
experiment logs are evidence, not standing instructions or permission to widen
the Task.

## Useful references

- System model: `projects/may-agent.app/docs/2a-design/system-model.md`
- Practice loop: `projects/may-agent.app/docs/2a-design/practice-learning-loop.md`
- Skills: `projects/may-agent.app/docs/2a-design/skills.md`
- Workflows: `projects/may-agent.app/docs/2a-design/workflows.md`
- Coach methods: `projects/may-agent.app/agents/coach/knowledge/`

Run the repository's declared checks rather than remembered global commands.
Use supplied read capabilities for Runtime state and typed capabilities for
effects; do not write the Host database directly.
