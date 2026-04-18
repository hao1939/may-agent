# Brief: Fork Injection Bug Diagnosis

**Date**: 2026-03-27
**Priority**: P0 (blocks ALL growth-cycle experiments)
**Reporter**: Coach (escalated to Bob)
**Target**: test/gym/gym-runner.ts

## Problem
When Coach runs gym experiments with `.lab` forks, `prompt_hash` is identical between baseline and patched runs. This means the SOUL/skill patches in the fork are NOT reaching the agent's system prompt. All growth-cycle experiments are invalidated.

## Evidence
- Coach logged identical `prompt_hash` across 3+ experiments over 2 days
- `c014ac5b460e` (coder verify-before-finish) — same hash baseline vs patched
- `638e2098862e` (coder read-before-edit) — same hash baseline vs patched
- Coach explicitly created skill files in `.lab/` forks that should change the prompt

## Investigation: Gym Runner Fork Flow

### Setup phase (lines 144-153)
```
1. labDir = projectRoot/agents/.lab/<fork-name>/
2. gymAgents = gymRoot/agents-lab/
3. cpSync(projectRoot/agents, gymAgents)  ← copies ALL agents
4. rmSync(gymAgents/.lab)                 ← removes .lab from copy
5. cpSync(labDir, gymAgents/<agent>)      ← overlays fork files
```

### Run phase (lines 197-228)
```
6. Copies gymAgents/<agent>/ to workDir/agents/<agent>/  ← IDENTITY SANDBOX
7. Runs binary with AGENTS_ROOT=gymAgents, cwd=workDir
```

### Result phase (lines 745-753)
```
8. effectiveAgentsRoot = gymRoot/agents-lab (for lab forks)
9. assembleEffectivePrompt(effectiveAgentsRoot, agent) ← computes hash
```

## Hypotheses

### H1: Identity Sandbox overrides AGENTS_ROOT (MOST LIKELY)
Step 6 copies agent files to `workDir/agents/<agent>/`. Then in `bundle-mode.ts`:
- `PROJECT_ROOT = process.cwd()` = workDir
- `AGENTS_ROOT = process.env.AGENTS_ROOT` = gymAgents (from env)

BUT — `manager.ts` line 345 derives `agentDir` from `def.knowledgeDir` or `def.workspace`. These are set in `agent-loader.ts` line 384-385 using `resolve(agentDir, "knowledge")` and `resolve(agentDir, "workspace")` where `agentDir = resolve(AGENTS_ROOT, config.name)`.

So `agentDir` should point to `gymAgents/coder/` (correct, has fork overlay).

However, `agent-loader.ts` line 631: `const agentDir = resolve(agentsRoot, entry.name)`. The `agentsRoot` is `AGENTS_ROOT` from env. So if `AGENTS_ROOT=gymRoot/agents-lab`, the loader should find all agents there (which include the forked files).

This hypothesis needs verification: add logging to see what path the binary actually loads skills from.

### H2: `assembleEffectivePrompt` doesn't reflect actual binary prompt
The gym runner computes `prompt_hash` using its own `assembleEffectivePrompt()` function which reads from `effectiveAgentsRoot`. If this function doesn't perfectly mirror `manager.ts`'s prompt assembly, the hash might be "correct" (from fork files) but not match what the binary actually uses.

BUT the hash is IDENTICAL between runs — meaning `assembleEffectivePrompt` doesn't even see the fork files. This points to a file-level issue, not a code-path mismatch.

### H3: Fork directory is empty or missing skills
If Coach creates a fork with only metadata (not actual skill files), the overlay copies nothing useful. Need to inspect Coach's actual fork creation code.

### H4: Timing/cleanup issue
If the fork under `agents/.lab/` gets cleaned up before the gym runs it (e.g., by another process or the same session), the overlay step would fail silently.

## Recommended Fix

### Step 1: Add diagnostic logging (Quick)
In `gym-runner.ts` around line 152, after the fork overlay:
```typescript
// After cpSync for fork overlay
const overlaidSkills = join(gymAgents, opts.agentName, "skills");
if (existsSync(overlaidSkills)) {
  console.error(`[gym] Fork overlay: skills/ found with ${readdirSync(overlaidSkills).length} files`);
} else {
  console.error(`[gym] Fork overlay: NO skills/ directory in overlaid agent`);
}
```

### Step 2: Verify file presence
Before running `assembleEffectivePrompt`, log whether the fork's files exist:
```typescript
const forkAgentDir = join(effectiveAgentsRoot, agentName);
const forkSkills = join(forkAgentDir, "skills");
console.error(`[gym] Hash input: agentDir=${forkAgentDir}, skills=${existsSync(forkSkills)}`);
```

### Step 3: Fix based on findings
Most likely the fork directory structure doesn't match expectations. Either:
- Coach creates `agents/.lab/<fork>/<agent>/skills/file.md` (nested agent name) when gym expects `agents/.lab/<fork>/skills/file.md` (flat)
- OR Coach modifies SOUL.md in the fork but `assembleEffectivePrompt` has a caching bug

## For Coach
While this is being fixed, Coach can work around by modifying live agent files directly (not using `.lab` forks), running baseline, reverting, and comparing manually.
