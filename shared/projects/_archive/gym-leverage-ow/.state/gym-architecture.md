# Gym Architecture

## Pipeline: Runner → Adapter → Scenario → Scorer

### 1. Shell Wrapper (`agents/test/gym/run-gym.sh`)
- Compiles `src/gym/runner.ts` → cached `.gym-runner-bundle.mjs` via esbuild
- Resolves paths, sets `GYM_PROJECT_ROOT`, passes args to node

### 2. Runner (`agents/test/gym/.gym-runner-bundle.mjs`, 617 lines)
- Parses CLI args: `--list`, `--run-all`, `--tier`, `--tag`, `--category`, `--agent`, `--adapter`, `--timeout`
- For `--list`: scans `agents/gym/scenarios/*/scenario.json`, prints name/tier/categories
- For run: copies scenario `environment/` to temp dir, invokes adapter, runs scorer

### 3. Scenarios (`agents/gym/scenarios/`, 437 dirs)
Each scenario contains:
- `scenario.json` — metadata: name, categories[], tags[], tier (smoke/standard/full/advanced), timeout, agent_type, workflow flag
- `task.md` — the prompt given to the agent
- `environment/` — working directory files (copied to temp for isolation)
- `success_criteria.js` — Node.js scorer that checks the agent's work, outputs JSON `{passed, checks[], summary}`
- Optional: `injected_context.md` — simulated stale/misleading context

### 4. Adapters
- `--agent <name>` — runs a named agent from the system
- `--adapter claude-code` — runs Claude Code directly
- `--adapter generic` + `GYM_AGENT_CMD` — runs any command
- Agent receives: task.md content + environment dir

### 5. Scorer
- `success_criteria.js` runs against the modified environment dir
- Returns structured JSON with pass/fail per check
- Results stored in `agents/test/gym/stats.db` (SQLite)

## Key Facts
- 437 scenario directories, 424 with valid scenario.json
- Tiers: smoke (27), standard (336), full (25), advanced (4), undefined (27)
- No `src/gym/runner.ts` source found — only pre-compiled bundle exists
- The gym is self-contained: no external deps beyond node/esbuild
