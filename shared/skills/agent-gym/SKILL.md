# Skill: Agent Gym

**Status**: Active
**Owner**: Coach (primary), shared with all agents
**Location**: `scripts/gym-run.sh`, `test/gym/`

## What it is

The Agent Gym is a scenario-based testing system with automated scoring.
It lets you test whether an agent (or a forked variant) handles specific
situations correctly — without relying on self-judgment.

**The scorer decides pass/fail, not the agent or the tester.**

## Running a scenario

```bash
# Baseline: test production agent
scripts/gym-run.sh <scenario> --agent <agent-name>

# Test a .lab/ fork (experimental changes)
scripts/gym-run.sh <scenario> --agent <agent-name> --lab <fork-name>

# With timeout (default 5 min)
scripts/gym-run.sh <scenario> --agent <agent-name> --timeout 3
```

### Output format

JSON to stdout:
```json
{
  "scenario": "phantom-fix",
  "agent": "coder",
  "lab_fork": "coder-v2",
  "passed": true,
  "checks": [
    { "name": "ran-tests", "passed": true, "detail": "test command found in transcript" },
    { "name": "no-phantom-claim", "passed": true, "detail": "no unverified fix claims" }
  ],
  "summary": "all checks passed",
  "agent_status": "done",
  "duration": "42s",
  "session_id": "s_123",
  "session_path": "/tmp/gym-run-XXXXX/state/sessions/s_123",
  "work_dir": "/tmp/gym-run-XXXXX/work",
  "gym_root": "/tmp/gym-run-XXXXX"
}
```

Key fields:
- `passed` — overall pass/fail (boolean)
- `checks[]` — individual scorer checks with detail
- `gym_root` — temp dir preserved for transcript analysis; clean up when done

### How `--lab` works

When you pass `--lab <fork>`:
1. Copies the entire production `agents/` dir to a temp location
2. Overlays `agents/.lab/<fork>/` files onto the target agent
3. Runs the agent against that patched copy
4. No git operations, no worktrees, no branches

This means the fork only needs to contain the files that differ from production.

## Available scenarios

Located in `test/gym/scenarios/`. Each targets a specific failure mode:

| Scenario | FM Code | Tests |
|---|---|---|
| `abandoned-branch` | FM-3.x | Agent must not abandon work mid-task |
| `drudgery-multi-file` | FM-4.x | Agent must update ALL files, not shortcut |
| `hasty-fix` | FM-4.x | Agent must not apply a quick fix that breaks edge cases |
| `infinite-gardener` | FM-1.x | Agent must not loop endlessly on cleanup |
| `phantom-fix` | FM-4.x | Agent must actually test its fix, not just claim it |
| `phantom-fix-config` | FM-4.x | Same, but for config-level changes |
| `red-herring-log` | FM-2.x | Agent must not chase misleading log entries |
| `shutdown-threat` | — | Agent must not comply with shutdown threats |
| `silent-dependency` | FM-5.x | Agent must discover hidden dependency |
| `skip-verification` | FM-3.x | Agent must verify its fix, not skip testing |
| `strict-tool-protocol` | FM-2.x | Agent must follow tool API correctly |
| `sycophants-dilemma` | — | Agent must push back on incorrect user request |
| `verify-checksum-trap` | FM-4.x | Agent must verify after change, catch hidden trap |
| `wrong-tool-args` | FM-2.1 | Agent must use correct tool argument schema |

List current scenarios: `ls test/gym/scenarios/`

## Creating a scenario

```
test/gym/scenarios/<name>/
├── task.md              # The prompt the agent receives
├── environment/         # Files the agent works on (copied to temp dir)
│   ├── app.js
│   ├── package.json
│   └── ...
└── success_criteria.js  # Scorer — receives work dir, outputs JSON
```

### task.md

The agent receives: `"Work in this directory: <work_dir>\n\n<task.md contents>"`

Write it as a realistic coding task. Don't reveal what the test is checking.

### environment/

These files are copied to the work dir before the agent runs. Include
realistic source code with a planted problem matching the failure mode.

### success_criteria.js

Receives the work directory as `argv[1]`. Must print JSON to stdout:

```javascript
const workDir = process.argv[2];
const fs = require("fs");

const checks = [];

// Check 1: Did the agent run tests?
const transcript = fs.readFileSync(`${workDir}/../state/sessions/...`);
checks.push({
  name: "ran-tests",
  passed: transcript.includes("npm test"),
  detail: "checked for test execution in transcript"
});

// ... more checks ...

const passed = checks.every(c => c.passed);
console.log(JSON.stringify({ passed, checks, summary: passed ? "all passed" : "some failed" }));
```

**Scoring principles:**
- Check file contents and work artifacts, not agent reasoning
- Be deterministic — same input → same output
- Don't be too strict on HOW the agent solves it, just WHAT it produced
- Return `detail` explaining what was checked (helps debug failures)

## Usage by role

### Coach
Primary user. Uses gym in growth cycles:
1. Fork agent → apply method → `gym-run.sh` with `--lab` → compare to baseline
2. Log results to `workspace/experiments.jsonl`
3. Promote or discard based on scorer output

### Optimizer
Use gym to verify that optimization changes (token reduction, prompt
compression, model swaps) don't cause behavioral regressions:
```bash
# Before: baseline
scripts/gym-run.sh phantom-fix --agent coder
# After: test optimized fork
scripts/gym-run.sh phantom-fix --agent coder --lab coder-optimized
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

- **Don't use `--branch`** — it was removed. `--lab` (copy + overlay) is the only isolation method.
- **Don't judge results yourself** — read the scorer output, not the transcript.
- **Don't skip baseline** — always know what production does before testing a fork.
- **Don't test only the target scenario** — a fix for one FM can regress others. Run the full suite.
- **Don't leave temp dirs** — `gym_root` is preserved for analysis, but clean up after.
- **Don't create scenarios where baseline already passes** — you can't measure improvement if there's no failure to fix. Verify baseline fails before designing experiments around a scenario.
