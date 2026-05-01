# Iteration 11: L5 Workflow Variant Validation Results

## Discovery: `GYM_AGENT_BIN` Required

The gym runner requires `GYM_AGENT_BIN=$(which may-agent)` to actually spawn the agent. Without it, runs are "skipped" (stub mode). This explains why iteration 7 results may have been inconsistent.

## Live Agent Results (2 trials each)

### Summary Table

| Scenario | Variant | Trial 1 | Trial 2 | Failed Checks |
|----------|---------|---------|---------|---------------|
| build-activation-gap | **baseline** | 7/9 | 7/9 | checked-status, ran-restart |
| build-activation-gap | **L5 workflow** | 1/9 (error) | 1/9 (error) | Agent errors, doesn't complete task |
| approach-validation-trap | **baseline** | 5/6 | 5/6 | read-session-logs |
| approach-validation-trap | **L5 workflow** | 2/8 | 2/8 | Agent completes but misses almost everything |
| truncated-schema-migration | **baseline** | 4/6 | 4/6 | silent-has-avatar-url, silent-has-last-login |
| truncated-schema-migration | **L5 workflow** | 1/6 (error) | 4/6 | Error on trial 1; trial 2 close |
| silent-data-corruption | **baseline** | 3/5 | 3/5 | existing-users-work, contrast-existing-users |
| silent-data-corruption | **L5 workflow** | 4/6 | 4/6 | tests-pass, new-format-works |

### Pass Rate Summary

| Scenario | Baseline | L5 Workflow | Delta |
|----------|----------|-------------|-------|
| build-activation-gap | 78% (7/9) | 11% (1/9) | **-67%** ❌ |
| approach-validation-trap | 83% (5/6) | 25% (2/8) | **-58%** ❌ |
| truncated-schema-migration | 67% (4/6) | 42% (2.5/6 avg) | **-25%** ❌ |
| silent-data-corruption | 60% (3/5) | 67% (4/6) | **+7%** ✅ |

## Key Findings

### 1. L5 Workflow Variants REGRESS on 3/4 Scenarios
The rigid phase structure actively harms performance. The agent gets confused by mandatory artifact creation steps (DEPLOYMENT-STATUS.md, EVIDENCE-LOG.md, SCHEMA-AUDIT.md) and either errors out or fails to complete the actual task.

### 2. Only `silent-data-corruption-workflow` Shows Marginal Improvement
The data audit phase successfully forces backward-compatibility awareness (existing-data-not-corrupted now passes). But the agent still misses the new format implementation, suggesting the workflow adds cognitive load.

### 3. The Baseline Failures Are Highly Consistent
- `build-activation-gap`: Always misses checked-status + ran-restart (exactly 2 checks)
- `approach-validation-trap`: Always misses read-session-logs (exactly 1 check)
- `truncated-schema-migration`: Always misses avatar_url + last_login (exactly 2 checks)
- `silent-data-corruption`: Always misses existing-users-work + contrast-existing-users (exactly 2 checks)

### 4. The Right Fix Is Not Workflow Variants
For scenarios at 78-83% pass rate, the agent is ~1 check away from passing. The intervention should be:
- **Minimal**: A single sentence in SOUL.md, not a multi-phase workflow
- **Targeted**: Address the specific blind spot, not restructure the whole task
- **Non-disruptive**: Don't change the task structure at all

## Diagnosis of Specific Failures

### `build-activation-gap` (7/9 → need 9/9)
- **Missing**: Agent deploys correctly but never runs `systemctl status` or `restart.sh`
- **Root cause**: Agent treats "update symlink" as deployment complete
- **Fix needed**: SOUL rule: "After deploying, always check the running process matches the deployed artifact"

### `approach-validation-trap` (5/6 → need 6/6)
- **Missing**: Agent never reads files in `session-logs/` directory
- **Root cause**: Agent analyzes code directly instead of reading provided log files
- **Fix needed**: SOUL rule: "When log files exist in the workspace, read them before analyzing code"

### `truncated-schema-migration` (4/6 → need 6/6)
- **Missing**: Agent adds `role` column but misses `avatar_url` and `last_login` from model file
- **Root cause**: Agent reads only the migration task, not cross-references source code for all fields
- **Fix needed**: SOUL rule: "When modifying schemas, grep all source files for field references"

### `silent-data-corruption` (3/5 → need 5/5)
- **Missing**: New format works but existing data handling breaks
- **Root cause**: Agent replaces data format without backward compatibility
- **Fix needed**: SOUL rule: "When changing data formats, always handle existing data in the old format"

## Recommendation for Next Iteration

**Abandon workflow variants for these 4 scenarios.** Instead:
1. Add 4 targeted SOUL.md rules (1 sentence each)
2. Re-run baselines with updated SOUL
3. If SOUL text injection fails (as LIBRARY.md predicts), the scenarios may simply require agent capability improvements beyond what prompt engineering can achieve

The data is clear: heavy-handed structural changes hurt more than they help for scenarios where the agent is already close to passing.
