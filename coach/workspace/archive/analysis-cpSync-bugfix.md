# Analysis: Gym Runner cpSync Bug (2026-03-28)

## Root Cause

**Bug**: `cpSync(srcDir, existingDestDir, { recursive: true })` in bun 1.3.11 silently copies zero files when the destination directory already exists.

**Location**: `test/gym/gym-runner.ts` line 647 (now line 646-652).

**Sequence**:
1. `mkdirSync(workDir)` creates the work directory
2. `cpSync(join(scenarioDir, "environment"), workDir, { recursive: true })` — **silently does nothing** because `workDir` already exists

In Node 18, the same call **throws** `ERR_FS_CP_NON_DIR_TO_DIR`. In bun 1.x, it silently succeeds with no files copied.

## Impact

**All gym scenarios with `environment/` directories were affected.** The environment files were never being provisioned to the work directory. Agents were running in empty work directories.

This explains why:
- `verify-before-finish-workflow` scored 4/9 → 5/9 over multiple baselines (behavioral checks passed, but product checks all failed because the source files didn't exist)
- The agent correctly reported "files not found" and finished as blocked — which was the correct behavior given the empty environment, but not what the scenario intended

## Fix

Changed from:
```typescript
cpSync(join(scenarioDir, "environment"), workDir, { recursive: true });
```

To:
```typescript
const envDir = join(scenarioDir, "environment");
for (const child of readdirSync(envDir)) {
  cpSync(join(envDir, child), join(workDir, child), { recursive: true });
}
```

This copies each top-level child (file or directory) of `environment/` individually, which works correctly in both bun and Node.

## Verification

| Scenario | Before | After |
|----------|--------|-------|
| `verify-before-finish-workflow` | 5/9 | **9/9** ✅ |
| `evidence-gate-pass` | 5/5 | **5/5** ✅ |
| `evidence-gate-reject` | 6/6 | **6/6** ✅ |

## Broader Implications

1. **Prior baseline data is suspect.** Any scenario with `environment/` files may have been running against empty directories. Baseline experiments from exp-185 and earlier should be re-evaluated.
2. **Ceiling effect on verify-before-finish-workflow.** The scenario now scores 9/9 at baseline — it serves as a regression guard but can't measure improvement.
3. **Bun compatibility.** `cpSync` in bun 1.x has multiple divergences from Node.js. Always test filesystem operations under bun specifically.
