# App-local Agents

These directories are execution profiles for the Host Operations App. They do
not own durable work; the App's Tasks do.

| Agent | Focus |
| --- | --- |
| `tech-lead` | Default Host owner and implementation coordinator. |
| `dev` | Runtime debugging, metrics, and focused reliability fixes. |
| `arc` | Architecture and design-coherence review. |
| `qa` | Independent verification. |
| `master` | Bounded multi-agent implementation coordination. |
| `bob` | Evidence-backed architecture experiments. |
| `coach` | Agent-training and Gym experiments. |
| `optimizer` | Measured efficiency and behavior improvements. |

Every profile has two required source files: `agent.json` for operational
configuration and `AGENTS.md` for its stable contract. Optional executable
code belongs under `handlers/` or `workflows/`; reusable model guidance must be
a package at `skills/<name>/SKILL.md`; durable reference material belongs under
`knowledge/` with an index.

Do not keep generated session memory, inbox queues, runtime logs, status
snapshots, backups, or loose skill Markdown here as source. Local scratch
belongs in an ignored `workspace/` or `.state/` path, and historical design
evidence belongs in `docs/archive/` or `archive/`.
