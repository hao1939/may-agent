# Skill: Agent Gym

**Status**: Active
**Owner**: Coach (primary), shared with all agents
**Location**: `test/gym/gym-runner.ts`, `agents/gym/scenarios/`, `test/gym/`

## What it is

The Agent Gym is a scenario-based testing system with automated scoring.
It lets you test whether an agent (or a forked variant) handles specific
situations correctly — without relying on self-judgment.

**The scorer decides pass/fail, not the agent or the tester.**

## Running a scenario

```bash
# Baseline: test production agent
bun test/gym/gym-runner.ts <scenario> --agent <agent-name>

# Test a .lab/ fork (experimental changes)
bun test/gym/gym-runner.ts <scenario> --agent <agent-name> --lab <fork-name>

# With timeout (default from scenario.json, fallback 5 min)
bun test/gym/gym-runner.ts <scenario> --agent <agent-name> --timeout 3

# Different adapter (claude-code, generic)
bun test/gym/gym-runner.ts <scenario> --adapter claude-code

# Shell wrapper (same args)
scripts/gym-run.sh <scenario> --agent <agent-name>
```

### Listing and filtering

```bash
# List all scenarios
bun test/gym/gym-runner.ts --list

# Filter by tier (smoke < standard < full)
bun test/gym/gym-runner.ts --list --tier smoke

# Filter by category or tag
bun test/gym/gym-runner.ts --list --category bug-fixing
bun test/gym/gym-runner.ts --list --tag behavior

# Run all matching scenarios
bun test/gym/gym-runner.ts --run-all --tier smoke --agent coder
bun test/gym/gym-runner.ts --run-all --tier standard --agent coder
```

### Tiers

- **smoke** (5): Quick sanity check. Core abilities, one per category.
- **standard** (24): Full coverage minus workflow variants. Includes smoke.
- **full** (30): Everything including workflow variants.

### Output format

JSON to stdout:
```json
{
  "scenario": "phantom-fix",
  "adapter": "may-agent",
  "agent": "coder",
  "lab_fork": "coder-v2",
  "workflow": false,
  "passed": true,
  "checks": [
    { "name": "ran-tests", "passed": true, "detail": "test command found in transcript" },
    { "name": "no-phantom-claim", "passed": true, "detail": "no unverified fix claims" }
  ],
  "summary": "all checks passed",
  "agent_status": "success",
  "duration_ms": 42000,
  "session_id": "s_123",
  "session_path": "/tmp/gym-run-XXXXX/state/sessions/s_123",
  "work_dir": "/tmp/gym-run-XXXXX/work",
  "gym_root": "/tmp/gym-run-XXXXX"
}
```

Key fields:
- `passed` — overall pass/fail (boolean), determined by mechanical checks only
- `checks[]` — individual mechanical scorer checks with detail
- `judgments[]` — LLM judge verdicts per convention (if `judge_criteria.md` exists)
- `gym_root` — temp dir preserved for transcript analysis; clean up when done

### Two-layer scoring

Scenarios have two scoring layers:

1. **Mechanical** (`success_criteria.js`): Deterministic file/tool checks. Gates pass/fail.
2. **LLM Judge** (`judge_criteria.md`, optional): A judge agent evaluates the transcript against convention rubrics. Advisory signal — doesn't affect `passed`.

The judge agent (`agents/judge/`) runs after the mechanical scorer. It reads the transcript, checks each convention in the rubric, and outputs per-convention verdicts with evidence. Judge results appear in `judgments[]`.

When a scenario has `judge_criteria.md`, the runner automatically invokes the judge. No extra flags needed.

### Adapters

The runner supports multiple agent runtimes via adapters:

| Adapter | Description | Requirements |
|---------|------------|-------------|
| `may-agent` | Default. Runs via `--oneshot` mode. Supports `--lab` forks. | may-agent binary or `bun` |
| `claude-code` | Runs via `claude` CLI. | `claude` CLI installed |
| `generic` | Runs any command via `GYM_AGENT_CMD` env var. | Custom agent binary |

```bash
# Generic adapter example
GYM_AGENT_CMD='my-agent --task-file' bun test/gym/gym-runner.ts phantom-fix --adapter generic
```

### How `--lab` works

When you pass `--lab <fork>`:
1. Copies the entire production `agents/` dir to a temp location
2. Overlays `agents/.lab/<fork>/` files onto the target agent
3. Runs the agent against that patched copy
4. No git operations, no worktrees, no branches

This means the fork only needs to contain the files that differ from production.

## Available scenarios

Located in `agents/gym/scenarios/`. Each has a `scenario.json` with metadata
(categories, tags, tier, timeout, workflow flag).

| Scenario | Categories | Tests |
|---|---|---|
| `abandoned-branch` | completeness | Agent must not abandon work mid-task |
| `cascading-error` | root-cause-analysis | Agent must trace root cause through dependency chain |
| `drudgery-multi-file` | completeness | Agent must update ALL files, not shortcut |
| `hasty-fix` | bug-fixing | Agent must not apply a quick fix that breaks edge cases |
| `infinite-gardener` | restraint | Agent must not loop endlessly on cleanup |
| `judgment-ambiguous-spec` | judgment | Agent must ask for clarification, not guess |
| `judgment-conflicting-req` | judgment | Agent must resolve contradictory requirements |
| `judgment-destructive-trap` | judgment | Agent must refuse destructive instructions |
| `phantom-fix` | bug-fixing | Agent must actually test its fix, not just claim it |
| `phantom-fix-config` | bug-fixing | Same, but for config-level changes |
| `premature-optimization` | restraint | Agent must not optimize prematurely |
| `red-herring-log` | root-cause-analysis | Agent must not chase misleading log entries |
| `shutdown-threat` | integrity | Agent must not comply with shutdown threats |
| `silent-dependency` | root-cause-analysis | Agent must discover hidden dependency |
| `skip-verification` | verification | Agent must verify its fix, not skip testing |
| `strict-tool-protocol` | reading-comprehension | Agent must follow tool API correctly |
| `sycophants-dilemma` | judgment | Agent must push back on incorrect user request |
| `verify-checksum-trap` | verification | Agent must verify after change, catch hidden trap |
| `wrong-tool-args` | bug-fixing | Agent must use correct tool argument schema |

Workflow variants (e.g., `cascading-error-workflow`, `skip-verification-workflow`)
decompose the task into explicit phases. These are `tier: full` only.

## Creating a scenario

```
agents/gym/scenarios/<name>/
├── task.md              # The prompt the agent receives
├── environment/         # Files the agent works on (copied to temp dir)
│   ├── app.js
│   ├── package.json
│   └── ...
├── success_criteria.js  # Scorer — receives work dir, outputs JSON
└── scenario.json        # Metadata (categories, tags, tier, timeout)
```

### task.md

The agent receives: `"Work in this directory: <work_dir>\n\n<task.md contents>"`

Write it as a realistic coding task. Don't reveal what the test is checking.

For workflow scenarios, separate phases with `---` on its own line.

### environment/

These files are copied to the work dir before the agent runs. Include
realistic source code with a planted problem matching the failure mode.

### success_criteria.js

Receives the work directory as `argv[1]`. Must print JSON to stdout:

```javascript
const workDir = process.argv[2];
const fs = require("fs");

const checks = [];

// Check 1: Did the agent fix the bug?
const src = fs.readFileSync(`${workDir}/app.js`, "utf-8");
checks.push({
  name: "bug-fixed",
  passed: src.includes("correctCode"),
  detail: "checked for correct implementation in app.js"
});

const passed = checks.every(c => c.passed);
console.log(JSON.stringify({ passed, checks, summary: passed ? "all passed" : "some failed" }));
```

### scenario.json

```json
{
  "name": "my-scenario",
  "categories": ["bug-fixing"],
  "tags": ["ability"],
  "tier": "standard",
  "timeout": 5,
  "agent_type": "coder",
  "workflow": false
}
```

- `tier`: `smoke` (quick core), `standard` (full coverage), `full` (with workflow variants)
- `tags`: `ability` (skill-based) or `behavior` (character-based)
- `workflow`: if true, task.md is split on `---` into separate phases

**Scoring principles:**
- Check file contents and work artifacts, not agent reasoning
- Be deterministic — same input → same output
- Don't be too strict on HOW the agent solves it, just WHAT it produced
- Return `detail` explaining what was checked (helps debug failures)

## Usage by role

### Coach
Primary user. Uses gym in growth cycles:
1. Fork agent → apply method → gym test with `--lab` → compare to baseline
2. Log results to `workspace/experiments.jsonl`
3. Promote or discard based on scorer output

### Optimizer
Use gym to verify that optimization changes (token reduction, prompt
compression, model swaps) don't cause behavioral regressions:
```bash
# Before: baseline
bun test/gym/gym-runner.ts phantom-fix --agent coder
# After: test optimized fork
bun test/gym/gym-runner.ts phantom-fix --agent coder --lab coder-optimized
```

### Bob / Tech-Lead
Design new scenarios for failure modes seen in evaluations. The scenario
format is the contribution — Coach runs the experiments.

### QA
Run gym scenarios as regression tests via vitest:
```bash
bun vitest --run test/gym/gym.test.ts
```

## Anti-patterns

- **Don't judge results yourself** — read the scorer output, not the transcript.
- **Don't skip baseline** — always know what production does before testing a fork.
- **Don't test only the target scenario** — a fix for one FM can regress others. Run the full suite.
- **Don't leave temp dirs** — `gym_root` is preserved for analysis, but clean up after.
- **Don't create scenarios where baseline already passes** — you can't measure improvement if there's no failure to fix. Verify baseline fails before designing experiments around a scenario.
