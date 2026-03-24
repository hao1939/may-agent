# Deploying Agents for Concrete Projects

## The Separation

May-agent has two layers that are currently entangled:

**1. The Runtime** (reusable): The engine that runs agents — session management, tool execution, persistence, evaluation, cron, web UI, gym, tracking. This is `src/`, `docker/`, `scripts/`. Project-independent.

**2. The Team** (project-specific): The agents that do the work — their identities, knowledge, skills, scenarios, cron schedules. This is `agents/`. Project-dependent.

Today both live in the same repo because the team IS building the runtime. For a concrete project, you'd use the same runtime but a different team.

## Project Layout

```
my-project/
├── agents/                    # The team (project-specific)
│   ├── shared/
│   │   ├── common-sense.md    # Team behavioral rules
│   │   ├── skills/            # Shared skills
│   │   └── daily-digests/     # Generated digests
│   ├── may/                   # Coordinator
│   │   ├── agent.json
│   │   ├── SOUL.md
│   │   ├── cron.json
│   │   └── handlers/
│   ├── coder/                 # Implementation
│   │   ├── agent.json
│   │   ├── SOUL.md
│   │   └── knowledge/
│   ├── reviewer/              # Code review
│   │   ├── agent.json
│   │   └── SOUL.md
│   └── researcher/            # Domain research (optional)
│       ├── agent.json
│       └── SOUL.md
├── .state/                    # Runtime state (auto-generated)
│   └── may.db
├── .env                       # API keys
└── docker-compose.yml         # Or k8s manifests
```

The project has NO `src/` — it uses may-agent as a runtime (binary or npm package). The `agents/` directory IS the project's configuration.

## What's in each file

### agent.json (same as today)
```json
{
  "name": "coder",
  "opBudget": 40,
  "description": "Implements features and fixes bugs",
  "domain": "web application development",
  "model": "opus",
  "tools": ["coding", "finish"],
  "compaction": true
}
```

### SOUL.md (project-specific identity)
```markdown
# SOUL — Coder

## Identity
You are the coder for the Acme web app. You write TypeScript/React
code, fix bugs, and implement features.

## Methodology
Read the spec → implement → run tests (npm test) → verify build (npm run build).

## Skills
- read-before-edit
- verify-after-write

## Constraints
- Never modify database migrations directly. Create a new migration.
- Always run the linter before finishing: npm run lint.

## Reference
- Architecture: knowledge/architecture.md
- API docs: knowledge/api-reference.md
```

### common-sense.md (starts from may-agent's, customize for the project)
Copy may-agent's common-sense.md as a starting point. Remove what doesn't apply, add project-specific norms.

### cron.json (what the team does autonomously)
Start minimal. Add as needed:
```json
[
  {
    "name": "heartbeat",
    "type": "heartbeat",
    "agent": "may",
    "intervalMs": 3600000,
    "message": "[heartbeat] Check for pending work and system health.",
    "enabled": true
  }
]
```

## How to create a new project team

### Step 1: Install may-agent runtime
```bash
# Option A: Docker (recommended)
docker run -v ./agents:/app/agents -v ./.state:/app/.state \
  -v ./.env:/app/.env may-agent --chat --cron --socket

# Option B: npm (if building from source)
npm install may-agent
npx may-agent --chat --cron --socket
```

### Step 2: Create the minimal team
Every project needs at minimum:
- **may** — coordinator (handles your messages, dispatches work)
- **coder** — writes code

Optional:
- **reviewer** — code review (valuable for quality)
- **researcher** — domain research (valuable for complex domains)
- **optimizer** — system improvement (valuable once team is running)

### Step 3: Write SOUL.md for each agent
Start from the slim SOUL.md template. Fill in:
- What project this agent works on
- What technology stack
- What the agent's specific responsibilities are
- Which skills apply
- Project-specific constraints

### Step 4: Add project knowledge
```
agents/coder/knowledge/
├── INDEX.md              # "Here's where to find things"
├── architecture.md       # System design
├── api-reference.md      # API docs
└── library/              # Deep reference material
```

Agents read these on-demand (not in the system prompt).

### Step 5: Run and iterate
```bash
may-agent --chat --cron --socket --web
```

Talk to may. Give it tasks. Watch what happens in the web UI. When agents make mistakes, add skills or update SOUL.md. Use the gym to verify improvements.

## Monitoring and coaching for concrete projects

### What transfers from may-agent

The entire coaching/evaluation/improvement infrastructure works unchanged:
- **Evaluations**: Score sessions automatically (heuristic + LLM)
- **Daily digest**: See what happened today
- **Web UI**: Dashboard, chat, benchmarks
- **Gym**: Test agent behavior with scenarios

### What needs to be created per project

- **Gym scenarios**: Project-specific test cases. "Can the coder fix a React component?" "Does the reviewer catch missing error handling?"
- **Coaching rules**: Project-specific additions to common-sense.md
- **Evaluation criteria**: What "good work" means for this project

### Do you need coach/optimizer for every project?

**No.** For a small project, the human IS the coach and optimizer. You:
1. Watch the daily digest
2. See where agents fail
3. Update SOUL.md or common-sense.md
4. Run gym to verify

Coach and optimizer are meta-agents that automate this loop. You only need them when the project is large enough that manual coaching doesn't scale.

### Scaling: when to add meta-agents

| Team size | What you need |
|-----------|--------------|
| 2 agents (may + coder) | Human coaches directly. Gym for verification. |
| 3-4 agents | Add reviewer. Human still coaches. |
| 5+ agents | Add optimizer (to spot waste). Consider coach (to automate improvements). |
| 8+ agents | Full meta team (coach, optimizer, evaluator). The may-agent setup. |

## The key insight

A "project" is just an `agents/` directory. The runtime is the same. The common-sense.md is mostly the same. What changes is:
- Agent identities (SOUL.md)
- Domain knowledge (knowledge/)
- Autonomous behavior (cron.json)
- Test scenarios (gym/)

You can start a new project in 30 minutes: copy the agent templates, write 3 SOUL.md files, add project knowledge, run the binary.
