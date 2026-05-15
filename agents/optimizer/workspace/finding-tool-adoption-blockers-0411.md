# Finding: Why Tools Die on the Vine — Deep Dive into Adoption Blockers

**Date**: 2026-04-11 ~20:00 UTC  
**Investigator**: optimizer  
**Status**: COMPLETE  
**Tags**: tool-adoption, gym-batch, session-query, experiment-design, KE-011  
**Supersedes**: finding-tool-adoption-0411.md (stale data), finding-tool-adoption-blockers-0411.md (prior version)

---

## Executive Summary

Two tools (`session-query.ts`, `gym-batch.sh`) have zero adoption despite being available. This deep dive identifies **three distinct adoption blockers** at different layers, and shows that **the highest-impact fix is not where we initially looked**.

| Tool | Root Cause | Layer |
|------|-----------|-------|
| session-query.ts | **Broken** — reads stale filesystem, not may.db | L1: Tool doesn't work |
| gym-batch.sh | **Invisible at point of decision** — experiment designs prescribe `gym-run.sh` loops | L3: Task prompts override tool knowledge |
| (compute-then-synthesize) | **Tool doesn't exist** — no alternative to 40-60 sequential DB queries | L0: Missing tool |

**Key insight**: gym-batch.sh's adoption failure is NOT because it's "only in context.md" (our prior diagnosis). It's because **experiment design documents — the actual instructions the coach follows — explicitly prescribe `for i in 1..6; do gym-run.sh` loops**. Context.md is read but task-specific instructions win.

---

## Data

### gym-batch.sh: The Evidence Trail

**Usage in gym_runs table**:
- Total gym runs with batch_id: 155 (all before April 1)
- Total individual runs: 160 (all since April 9 — 141 in last 3 days alone)
- **Last batch run**: April 1, 2026 (10 days ago)
- **Last 3 days**: 141 individual, 0 batch

**Who used gym-batch historically**: All batch_ids trace to `agent_name=coder` (the test subject), run through TypeScript `gym-helpers.ts` — NOT through the shell script itself. The `batch_id` was set by the TypeScript `runGym()` function's `batchId` option. gym-batch.sh the shell script has likely never been invoked by an agent.

**EXP-130 (88 ops, April 11)**: 12 gym runs, all individual, batch_id=null:
```
id=266-283 | scenario=kb-integration-discovery* | batch=null | method=oneshot
```

**EXP-138 (87 ops)**: 9 individual gym runs for 5 baseline + 4 treatment.

### Where Tools Are Referenced

| Surface | session-query.ts | gym-batch.sh | gym-run.sh |
|---------|-----------------|--------------|------------|
| coach context.md | ❌ | ✅ (line 5) | ✅ (line 4) |
| optimizer context.md | ❌ | ❌ | ✅ (line 4) |
| SKILL.md (agent-gym) | ❌ | ✅ (6 mentions) | ✅ (7 mentions) |
| coach SOUL.md | ❌ | ❌ | ❌ |
| coach heartbeat.md | ❌ | ❌ | ❌ |
| Experiment designs (75 total) | 0/75 | **0/75** | **9/75** |
| coach workflows (*.ts) | ❌ | ❌ | Uses runGym() |

**The critical row**: experiment designs. Of 75 experiment design files, 9 explicitly show `gym-run.sh` invocations, 0 mention `gym-batch.sh`. Several include literal bash loops:

```bash
# From EXP-124 design.md:
for i in 1 2 3 4 5 6; do
  scripts/gym-run.sh knowledge-base-navigation --agent bob --lab bob-fm13-discovery
done
```

### session-query.ts: Still Broken

- Reads from `agents/.state/sessions/history/` (filesystem path, line 174)
- Only 911 sessions in filesystem (latest ~March 23)
- may.db has 19,147+ sessions (authoritative source)
- **Not in ANY agent's context.md** — zero surfacing
- Even if surfaced, would return stale/useless results

---

## Analysis: Three-Layer Adoption Model

### L1: Tool Doesn't Work (session-query.ts)

session-query.ts reads from a filesystem directory that stopped being populated weeks ago. This is the simplest failure mode — even a perfectly surfaced tool won't be adopted if it returns wrong results.

**QA reviewed the code** but not whether the data source was current. The tool passed review because the code was correct — but the data infrastructure had migrated underneath it.

**Fix**: Either rewrite to query may.db, or deprecate in favor of `bun -e` patterns that agents already use successfully. The `bun -e` approach is working — agents write ad-hoc queries that exactly match their need. A generic CLI adds indirection without clear value.

**Recommendation**: Deprecate session-query.ts. The ad-hoc `bun -e` pattern is better because each query is purpose-built for the specific question. Document 3-5 common query patterns in context.md instead.

### L2: Passive Documentation (gym-batch.sh — prior diagnosis, INCOMPLETE)

Our prior finding identified this as the root cause: "gym-batch is only in context.md, a passive document." This is true but insufficient. SKILL.md also has gym-batch (6 mentions, dedicated section, usage examples, "when to use" guidance). And the coach reads context.md.

**The real question**: Why does the coach read context.md (which mentions gym-batch), read SKILL.md (which has detailed gym-batch docs), and STILL call gym-run.sh 12 times in a loop?

### L3: Task Instructions Override Tool Knowledge (THE REAL BLOCKER)

The coach's experiment execution follows this path:

1. Bob/May writes experiment design.md (e.g., EXP-130/design.md)
2. Coach heartbeat dispatches: `agents.fork('coach', '[WORK SESSION] Execute EXP-130...')`
3. The task says "Read: agents/shared/knowledge/experiments/EXP-130/design.md"
4. Coach reads design.md which says: `scripts/gym-run.sh scenario --agent coder` (6 explicit calls)
5. Coach follows the design's execution protocol — individual gym-run.sh calls

**The experiment design IS the task prompt**. It contains:
- The specific command to run (`gym-run.sh`)
- The literal loop structure (`for i in 1..6; do ...`)
- The interleaving pattern (`A, B, A, B, ...`)

When the design says "run `gym-run.sh` 6 times", the coach runs `gym-run.sh` 6 times. Context.md saying "use gym-batch instead of loops" is general advice. The design.md is specific instructions for THIS task. **Specific always beats general.**

This is a deeper version of KE-011 ("passive knowledge is skipped"). But it's not that context.md is "passive" — it's that task-specific instructions have higher authority than general tool knowledge. The same mechanism that makes few-shot examples work (the agent follows specific patterns over general guidance) causes tool adoption failure.

---

## Why gym-run.sh Gets Used (Control Case)

gym-run.sh has perfect adoption because it appears at every layer:
- Context.md: ✅
- SKILL.md: ✅ 
- Experiment designs: ✅ (the specific command to run)
- Coach SOUL.md: ✅ ("The gym is at agents/gym/scenarios/. The lab is at scripts/lab-run.sh")
- Workflows: ✅ (gym-helpers.ts wraps it)

The agent never has to "decide" to use gym-run.sh — the task instructions tell it to. gym-batch.sh would need the same treatment.

---

## Why the TypeScript Path Is Actually Better

Coach workflows (`growth-cycle.ts`, `training-sprint.ts`) already solve this problem differently. They import `runGym()` from `gym-helpers.ts`, which:
- Runs gym scenarios as TypeScript function calls (no LLM session needed)
- Records results with batch_id tracking
- Handles error recovery
- Produces structured output

The 141 individual gym-run.sh calls in the last 3 days happened in **ad-hoc work sessions** that bypassed workflows. The heartbeat.md tries to push toward workflows ("Workflows are habits, not optional tools") but many experiments are dispatched as freeform work sessions.

**The two gym-running paths**:

| Path | Who calls it | Tool used | Batch support |
|------|-------------|-----------|---------------|
| Workflow (growth-cycle/training-sprint) | Coach via `workflow.run()` | `runGym()` TypeScript | ✅ built-in |
| Ad-hoc work session | Coach via LLM bash calls | `scripts/gym-run.sh` | ❌ must use gym-batch.sh |

Path 2 is where the waste happens. The fix could be:
- (a) Push more work through Path 1 (expand workflows to cover more experiment types)
- (b) Fix Path 2 by getting gym-batch.sh into experiment designs
- (c) Both

---

## Concrete Fix: Highest-Impact Single Change

**Inject gym-batch.sh into the experiment execution protocol, not just the tool docs.**

The highest-leverage point is where Bob writes experiment designs. If the design says "run with gym-batch.sh", the coach will use it. Currently Bob writes:

```bash
for i in 1 2 3 4 5 6; do
  scripts/gym-run.sh scenario --agent coder
done
```

Should write:
```bash
scripts/gym-batch.sh --scenario scenario --agent coder --trials 6
# Or for A/B:
scripts/gym-batch.sh --scenario scenario --agent coder --variants baseline,fork-name --trials 6
```

**Where to make this change**: Bob's experiment design template/knowledge. Add to `agents/bob/context.md` or `agents/shared/knowledge/` a note:

```
When writing experiment execution protocols, use gym-batch.sh for multiple trials:
  scripts/gym-batch.sh --scenario <name> --agent <agent> --trials N
  scripts/gym-batch.sh --scenario <name> --variants baseline,<fork> --trials N
Do NOT write for-loops with gym-run.sh — use gym-batch.sh instead.
```

**Expected impact**: Each experiment session saves ~10-20 ops (eliminating individual bash calls + inter-run parse/analyze ops). At ~2-3 experiment sessions/day, saves 20-60 ops/day.

**But there's a catch**: Even this context.md addition follows the same passive-documentation pattern that failed for the coach. The real fix might need to be:
1. Add to bob's context.md (necessary but may be insufficient)  
2. Also add a bob skill or checker that flags `for ... gym-run.sh` patterns in experiment designs
3. OR: modify the coach heartbeat dispatch template to include "Use gym-batch.sh for multi-trial runs" in every experiment fork

**Simplest effective fix**: Add the gym-batch instruction to the coach's heartbeat.md work session template, since that's what wraps every dispatched experiment:

In the `### Coach Work Session Examples` section of heartbeat.md, add to the growth cycle example:
```
⚡ For multi-trial runs: scripts/gym-batch.sh --scenario <name> --agent coder --trials N
   Do NOT loop gym-run.sh manually.
```

---

## Secondary Finding: "compute-then-synthesize" Tool Gap

This is a separate but related pattern. Coach analysis sessions (e.g., EXP-141 at 89 ops) spend 40-60 ops on sequential per-agent stat computation:

```bash
bun -e "...query for agent A..."  # op 1
bun -e "...query for agent B..."  # op 2  
bun -e "...query for agent C..."  # op 3
# ... 8 more agents ...
```

When a single script could compute all stats in one pass (1-2 ops). No tool exists for this pattern yet. Unlike gym-batch (which exists but isn't adopted), this is a genuine tool gap (L0).

**However**: Building this tool faces the same adoption barriers. Unless it's injected at the point of use (task prompts, heartbeat templates), it will suffer the same "die on the vine" fate.

---

## Adoption Blocker Taxonomy

```
L0: MISSING TOOL
  → Tool doesn't exist for the pattern
  → Example: compute-then-synthesize multi-agent stats
  → Fix: Build the tool, BUT with adoption plan from day 1

L1: BROKEN TOOL  
  → Tool exists but doesn't work with current infrastructure
  → Example: session-query.ts (reads stale filesystem)
  → Fix: Repair or deprecate

L2: INVISIBLE TOOL
  → Tool works but no agent knows it exists
  → Example: session-query.ts (not in any context.md)
  → Fix: Add to context.md / SKILL.md

L3: OVERRIDDEN TOOL
  → Tool is known but task-specific instructions prescribe the old way
  → Example: gym-batch.sh (context.md says use it, but design.md says use gym-run.sh loops)
  → Fix: Inject into task prompts / templates / the documents agents actually follow
  → This is the hardest layer because it requires changing upstream content generators (Bob, dispatchers)
```

**Key principle**: Each layer is necessary but not sufficient. gym-batch.sh was fixed at L2 (added to SKILL.md and context.md) but remained broken at L3 (not in experiment designs). session-query.ts is broken at both L1 and L2.

---

## Recommendations (Priority Ordered)

1. **[HIGH] Add gym-batch.sh to coach heartbeat dispatch template** — Modify the work session example in heartbeat.md to include `gym-batch.sh` instruction. This ensures every experiment fork carries the tool reference.

2. **[HIGH] Add gym-batch.sh preference to Bob's context.md** — So future experiment designs use gym-batch.sh syntax instead of gym-run.sh loops.

3. **[MEDIUM] Deprecate session-query.ts** — It's broken and agents already have a working alternative (`bun -e` queries). Remove from scripts/ to avoid confusion. Add 3-5 common query patterns to optimizer context.md as `bun -e` snippets instead.

4. **[LOW] Build compute-then-synthesize pattern** — BUT only after solving the L3 adoption problem for gym-batch first. If we can't get gym-batch adopted (L2 already done, L3 pending), building another tool just creates another vine-death.

---

*Data sources: may.db gym_runs table, experiment design files, agent context/heartbeat/SOUL files, SKILL.md*
