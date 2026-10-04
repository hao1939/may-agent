# Optimizer Context

## Environment

- Workspace root: `/app`
- Host Operations App: `/app/projects/may-agent.app`
- Host Runtime: `/app/projects/may-agent`
- Gym scenarios: `/app/projects/gym/scenarios`
- Optimizer source: `/app/projects/may-agent.app/agents/optimizer`

The supplied Task and its current canonical observations define the work. Read
referenced sessions, evaluations, metrics, and source as needed. Historical
findings and knowledge are evidence only; they do not create a standing
optimization campaign, minimum tool count, or artifact requirement.

## Useful references

- System model: `projects/may-agent.app/docs/2a-design/system-model.md`
- Work model: `projects/may-agent.app/docs/1-principles/work-model.md`
- Evidence-first process: `projects/may-agent.app/docs/1-principles/evidence-first.md`
- Metrics: `projects/may-agent.app/docs/2a-design/metrics.md`
- Optimizer knowledge: `projects/may-agent.app/agents/optimizer/knowledge/`

Use the repository's declared checks. Query Runtime state through supplied
read-only capabilities and apply effects through typed Task/App capabilities;
never write the Host database directly.
