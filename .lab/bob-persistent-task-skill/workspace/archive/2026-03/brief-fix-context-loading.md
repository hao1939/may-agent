# Brief: Fix Context Loading Gap & Standardize Heartbeats

## Problem
1. **Context Loss (Critical)**: `src/lib/manager.ts` does *not* load `DOMAIN.md`, `TOOLS.md`, or `LESSONS.md` into the system prompt. It only loads `SOUL.md` and `common-sense.md`.
   - **Impact**: Agents relying on `DOMAIN.md` for environment rules (Master, Amy-Kimi, Judge, Optimizer) are flying blind.
   - **Evidence**: `grep` confirms 12 agents have `DOMAIN.md` files that are currently ignored.
   - **Root Cause**: Intentional "prompt simplification" removed these, but the content wasn't fully migrated to `SOUL.md`.

2. **Heartbeat Inconsistency**: 3 agents (`optimizer`, `evaluator`, `master`) are missing the **FM-3.3 Guard** (Verification Discipline) in their `heartbeat.md`.
   - **Impact**: These agents are prone to "eye-balling" verification failures (FM-3.3).
   - **Evidence**: `grep -L "Verification Discipline"` flagged them.

## Plan

### 1. Restore `DOMAIN.md` Loading (Hotfix)
We must restore `DOMAIN.md` loading immediately to fix the context gap. `TOOLS.md` and `LESSONS.md` can remain excluded (covered by `agent.json` tool injection and `shared/LESSONS.md`), but `DOMAIN.md` contains critical identity/environment rules not present in `SOUL.md`.

- **Action**: Modify `src/lib/manager.ts` to include `DOMAIN.md` in `resolveSystemPrompt`.

### 2. Standardize Heartbeats (FM-3.3 Guard)
Apply the standard "Verification Discipline" block to the 3 missing agents.

## Implementation Details

### A. `src/lib/manager.ts`
Modify `resolveSystemPrompt` to load `DOMAIN.md` if it exists, inserting it after `SOUL.md`.

```typescript
// 1. SOUL.md — agent identity, role, methodology, curated skills
const soul = loadFile(agentDir ? join(agentDir, "SOUL.md") : undefined);
if (soul) sections.push(soul);

// 1b. DOMAIN.md — operational context (workflows, environment, domain rules)
const domain = loadFile(agentDir ? join(agentDir, "DOMAIN.md") : undefined);
if (domain) sections.push(domain);
```

### B. Heartbeat Updates
Inject this block into `agents/optimizer/heartbeat.md`, `agents/evaluator/heartbeat.md`, and `agents/master/heartbeat.md`:

```markdown
## ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.
```

## Verification
1. **Context**: Run `bun src/app/may.ts --oneshot --agent optimizer --task "echo hello"` and inspect the debug log (or inferred behavior) to confirm `DOMAIN.md` content is active.
2. **Heartbeat**: Read back modified `heartbeat.md` files to confirm the guard is present.
