# Skill: Infrastructure Map

**Purpose**: Eliminate discovery spirals when working with platform guards, gym infrastructure, and the source tree. Coach sessions have burned 40-48% of ops searching for things documented here.

**Source**: Optimizer archaeology of sessions s_1775901874236_82 (166 ops, 70 ops wasted on guard search) and s_1775908930937_129 (131 ops, 71 ops wasted on gym infrastructure).

---

## 1. Platform Architecture — Where Things Live

### Source Tree Layout

```
/app/
├── src/                          # Compiled runtime harness (TypeScript)
│   ├── lib/
│   │   ├── tools/                # Tool implementations (bash, read, edit, etc.)
│   │   └── growth.ts             # Growth/skill loading
│   ├── gym/
│   │   └── runner.ts             # Gym execution engine
│   └── pipeline.js               # Session pipeline
├── agents/                       # Agent configs, skills, knowledge (SEPARATE git repo)
│   ├── {agent}/
│   │   ├── SOUL.md               # Identity + behavior
│   │   ├── context.md            # Persistent facts (injected into every session)
│   │   ├── skills/               # Skill files (injected based on triggers)
│   │   ├── handlers/             # Cron handler code (.ts)
│   │   ├── workspace/            # Working files, drafts, journals
│   │   └── knowledge/            # Consolidated knowledge
│   ├── shared/
│   │   ├── skills/               # Shared skill library (41+ skills)
│   │   ├── knowledge/            # Shared knowledge base, experiments
│   │   ├── protocols/            # Shared protocols (escalation)
│   │   ├── workflows/            # Workflow implementations (.ts)
│   │   └── CONVENTIONS.md        # Convention definitions
│   ├── gym/
│   │   └── scenarios/            # Gym scenario definitions
│   └── evaluator/
│       └── skills/
│           ├── monitor-session.cjs  # Session monitoring (DETECTS issues)
│           └── monitor-session.md   # Monitor documentation
├── scripts/
│   ├── gym-run.sh                # Single scenario runner (CORRECT path)
│   ├── gym-batch.sh              # Batch runner with trials + comparison
│   └── gym-stats.ts              # Stats queries
├── test/gym/
│   ├── run-gym.sh                # ALSO works (legacy path, same script)
│   └── stats.db                  # Legacy stats DB (may be empty)
└── .state/
    ├── (database — access via query_db tool only)
    └── .bun/bin/bun              # Bun binary
```

### Three Enforcement Layers — Don't Confuse Them

| Layer | What | Where | Can You Modify? |
|-------|------|-------|-----------------|
| **Runtime harness guards** | Block actions in real-time (e.g., ghost-deliverable check on `finish()`) | Compiled into `src/` — NOT in the agent source tree | **No** — compiled binary. You can only change agent-side behavior. |
| **Evaluator detection** | Post-hoc session analysis (quality scores, waste detection) | `agents/evaluator/skills/monitor-session.cjs` | Yes, but evaluator owns it. |
| **Convention checks** | Mechanical compliance scoring after sessions complete | `agents/may/handlers/convention-check.ts` | Yes — this IS in the agents/ repo. |

### Common "Where Is X?" Answers

| Looking for... | It's at... | NOT at... |
|----------------|-----------|-----------|
| Ghost-deliverable guard | **Runtime harness** (compiled, not in source tree) | Not in `src/lib/tools/`, not in convention checks |
| Convention check code | `agents/may/handlers/convention-check.ts` | Not in `src/` |
| Session evaluation | `agents/evaluator/skills/monitor-session.cjs` | Not in the harness |
| Finish tool behavior | **Runtime harness** — look at error messages, not source | Not greppable in `src/lib/tools/` |
| Skill loading | `src/lib/growth.ts` + agent's `skills/` directory | — |
| Workflow implementations | `shared/workflows/*.ts` | Not in `src/` |

### Key Principle

**If you can't find guard code in `src/`, it's in the compiled harness binary.** Stop searching after 2-3 greps. Instead, analyze the guard's *behavior* from error messages and session transcripts.

---

## 2. Gym Operations — Complete Cheat Sheet

### Running Scenarios

```bash
# Single scenario, single trial
scripts/gym-run.sh <scenario-name> --agent <agent-name> --timeout 3

# Batch: multiple trials of one scenario
scripts/gym-batch.sh --scenarios <name> --agent <agent-name> --trials 5

# Batch: filter by tier
scripts/gym-batch.sh --tier smoke --agent coder --trials 3

# Batch: filter by category
scripts/gym-batch.sh --category verification --agent may --trials 5

# Batch: A/B comparison (baseline vs lab fork)
scripts/gym-batch.sh --scenarios <name> --agent coder --lab <fork-name>

# List scenarios
scripts/gym-run.sh --list
scripts/gym-run.sh --list --tier smoke
scripts/gym-run.sh --list --category bug-fixing
```

**ALWAYS prefer `scripts/gym-batch.sh` over manual loops of `scripts/gym-run.sh`.** Batch handles trial aggregation, comparison tables, and DB recording automatically.

### Valid Agents for Gym

Agents that have successfully run gym scenarios: **bob, coder, may, optimizer, scout, coach**.

The `--agent` flag takes any agent name from `agents/`. The agent must have a SOUL.md. There is no separate "registration" step.

### Lab Forks for Experiments

```bash
# Create a fork (manual — copy the agent directory)
cp -r agents/coder agents/.lab/coder-with-skill
# Modify the fork
echo "new context" >> agents/.lab/coder-with-skill/context.md
# Test the fork
scripts/gym-run.sh <scenario> --agent coder --lab coder-with-skill
# Compare
scripts/gym-batch.sh --scenarios <scenario> --agent coder --lab coder-with-skill --trials 5
```

### A/B Experiments via Lab Scripts

```bash
# Create experiment design at shared/knowledge/experiments/EXP-XXX/design.json
# Run it:
scripts/lab-run.sh EXP-XXX
scripts/lab-run.sh EXP-XXX --dry-run  # preview
```

### State and Results

| What | Where | How to Query |
|------|-------|-------------|
| Gym results DB | `database (query_db tool)` table `gym_runs` | `bun -e "import{Database}from'bun:sqlite'; ..."` |
| gym_runs columns | `agent_name`, `scenario`, `passed`, `duration_ms`, `total_ops`, `cost_usd`, `session_id`, `lab_fork`, `batch_id` | See column list below |
| Gym state dirs | Ephemeral — cleaned up after each run | Use `--keep` to preserve work dir (NOT transcripts) |
| Transcripts | Stored in `gym_runs.transcript` column (if `--with-history`) | Query from DB, not filesystem |
| Legacy stats.db | `test/gym/stats.db` — may be empty | Prefer `database (query_db tool)` |

### Querying Gym Results

```bash
export PATH=".state/.bun/bin:$PATH"
# Recent runs
bun -e "import{Database}from'bun:sqlite';const db=new Database('database (query_db tool)',{readonly:true});console.table(db.query('SELECT agent_name,scenario,passed,total_ops FROM gym_runs ORDER BY rowid DESC LIMIT 10').all())"

# Pass rate for a scenario
bun -e "import{Database}from'bun:sqlite';const db=new Database('database (query_db tool)',{readonly:true});console.table(db.query(\"SELECT agent_name,COUNT(*)as n,SUM(passed)as wins,ROUND(100.0*SUM(passed)/COUNT(*),1)as pct FROM gym_runs WHERE scenario=? GROUP BY agent_name\").all('convention-verify-edit'))"

# Aggregate stats
bun scripts/gym-stats.ts
```

### Common Mistakes to Avoid

- ❌ `sqlite3 database (query_db tool)` — sqlite3 CLI is NOT available. Use `bun -e` with `bun:sqlite`.
- ❌ `test/gym/run-gym.sh` as the only path — works, but `scripts/gym-run.sh` is canonical.
- ❌ Running gym scenarios inline in a heartbeat — always fork to a work session.
- ❌ Looking for gym results on the filesystem — they're in `database (query_db tool)` table `gym_runs`.
- ❌ Trying to register agents for gym — no registration needed, just pass `--agent <name>`.

---

## 3. Database Access Patterns

```bash
# Always set PATH first
export PATH=".state/.bun/bin:$PATH"

# Sessions query
bun -e "import{Database}from'bun:sqlite';const db=new Database('database (query_db tool)',{readonly:true});console.table(db.query('SELECT agent,status,opCount,durationMs FROM sessions ORDER BY startedAt DESC LIMIT 10').all())"

# Convention checks
bun -e "import{Database}from'bun:sqlite';const db=new Database('database (query_db tool)',{readonly:true});console.table(db.query('SELECT convention,passed,total FROM convention_checks ORDER BY rowid DESC LIMIT 10').all())"

# Available tables
bun -e "import{Database}from'bun:sqlite';const db=new Database('database (query_db tool)',{readonly:true});console.log(db.query(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t=>t.name))"
```

**Database tables**: `sessions`, `evaluations`, `convention_checks`, `convention_maturity`, `gym_runs`, `gym_checks`, `gym_prompts`, `session_digests`, `knowledge_entries`, `hypotheses`, `experiments`, `requests`.

---

## 4. Key Environment Facts

- **bun** is at `.state/.bun/bin/bun` — always `export PATH=".state/.bun/bin:$PATH"` first
- **npx** is NOT available — use `./node_modules/.bin/<tool>` or `bun x <tool>`
- **Use query_db tool for database queries
- **agents/** is a separate git repo — commit from `agents/` directory
- **Project root** is `/app` — no `/home/`, `/Users/`, `/root/`, or `~/` paths exist
