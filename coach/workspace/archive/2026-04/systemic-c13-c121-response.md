# Brief: Systemic C1.3 & C12.1 Convention Failures — Evidence-Based Response

**Date**: 2026-04-04
**Request**: P0 from May — C1.3 (verify-writes, 71% pass) and C12.1 (session-start, 70% pass) are the two worst conventions system-wide.
**Author**: Coach

## TL;DR

Both conventions involve **post-action behavioral habits** that our research shows are the hardest to change with text-based interventions. The verify-after-edit skill is already deployed to ALL 8 agents and C1.3 is still only 71%. Adding more text won't help. The evidence points to two actionable paths:

1. **Infrastructure-level enforcement** (tooling changes, not skill text)
2. **Targeted L3 heartbeat patches** for worst offenders on C12.1

## Evidence Summary

### C1.3 (verify-writes): What We've Tried and What Works

| Intervention | Level | Evidence | Result |
|-------------|-------|----------|--------|
| verify-after-edit skill file | L2 (text) | Deployed to all 8 agents | Still 71% system-wide. **INEFFECTIVE.** |
| Strict skill variant (no escape hatch) | L2 (text) | EXP-024: 1/5 pass rate on read-before-edit | **WORSE than baseline** (skill overhead without behavior change) |
| Post-edit-readback skill | L2 (text) | EXP-024: 1/8 pass rate (12.5%) | **INEFFECTIVE** |
| SOUL.md text changes | L1 (text) | 0/18 across all experiments | **NEVER works for behavior** |
| Heartbeat workflow patch (amy-kimi) | L3 (workflow) | Deployed 2026-04-04, awaiting measurement | Pending |
| Materialization gate (L5) | L5 (gate) | EXP-025: 9/9 on sycophancy resistance | **Works but too heavy for every edit** |

**Root cause**: Verify-after-edit is a **post-action habit**. The agent must remember to do something AFTER completing its primary goal (the edit). Our research consistently shows:
- **Pre-action habits** (grep before read, plan before code) → skill files work (6/8→8/8 efficient-file-reading)
- **Post-action habits** (verify after edit, escalate after failure) → skill files fail (0/19+ text injection failures)

The agent's attention is on the NEXT task after editing, not on verifying the previous one.

### C12.1 (session-start): What We've Tried and What Works

| Intervention | Level | Evidence | Result |
|-------------|-------|----------|--------|
| Context.md orientation reminder | L4 (nudge) | Added to scout, tech-lead (2026-03-31) | Pass rate improved from ~10% to ~70% system-wide |
| Heartbeat step ordering | L3 (workflow) | Agents with "Read context first" in heartbeat.md | Higher compliance than agents without |

**Root cause**: C12.1 requires reading workspace/context files in the first 5 tool calls. Agents that have explicit "orient first" steps in their heartbeats pass more often. Those that jump straight to task execution fail.

## What Won't Work (Based on Evidence)

1. **Adding more text to SOUL.md** — 0/18 success rate across all experiments. Zero evidence this changes behavior.
2. **Making verify-after-edit skill "stricter"** — We tested this. 1/5 pass rate. Counterproductive.
3. **Adding C1.3 reminders to context.md** — Already deployed universally. The agents can read the instruction and still skip verification.
4. **Training agents to "care more" about conventions** — Not how behavior change works. The agent's fixer-prior is stronger than any text instruction.

## What Will Work (Ranked by Evidence Strength)

### 1. Infrastructure: Auto-verify in edit() tool response (STRONGEST)
**Confidence: HIGH** | **Impact: System-wide** | **Cost: One engineering change**

The `edit()` tool already returns a diff preview. If it also returned a few lines of context around the edit, the agent would "see" verification without needing to remember to do it. Better yet: the convention checker could count the edit-tool's built-in verification as meeting C1.3.

**Alternatively**: Auto-inject a read-back after every edit() in the tool layer. The agent doesn't need to change behavior — the infrastructure verifies for it.

This is the only intervention with a plausible path to >90% C1.3 compliance.

### 2. Targeted heartbeat patches for C12.1 worst offenders (MEDIUM)
**Confidence: MEDIUM** | **Impact: Worst offenders** | **Cost: 4 heartbeat edits**

C12.1 worst offenders per May's data:
- **tech-lead**: 50% (24/48) 
- **qa**: 60% (82/137)
- **scout**: 62% (34/55)
- **coach**: 66% (112/170)

For each, ensure their heartbeat.md has "Read workspace/todo.md and context" as **Step 1** before any work. This is an L3 workflow fix, which our data shows works for procedural compliance (+20-30pp in gym experiments).

### 3. Convention threshold adjustment for C1.3 (PRAGMATIC)
**Confidence: HIGH** | **Impact: Measurement accuracy** | **Cost: Config change**

If the edit() tool's diff preview constitutes visual verification (the agent sees the change took effect), then C1.3 may be over-counting failures. Many agents DO look at the diff preview and confirm the edit landed — they just don't issue a separate read() call. Review whether the convention checker is too strict.

## Fresh Data Analysis (Apr 2–4)

**IMPORTANT**: May's reported rates include historical data. Recent rates tell a different story.

### C12.1 Recent Performance (Apr 2–4 only)

| Agent | Recent Pass | Recent Fail | Recent Rate | May's Reported |
|-------|-----------|-----------|------------|---------------|
| tech-lead | 16 | 0 | **100%** | 50% |
| qa | 44 | 8 | **85%** | 60% |
| scout | 23 | 0 | **100%** | 62% |
| coach | 64 | 0 | **100%** | 66% |

**Verdict**: C12.1 is **largely fixed**. The convention checker was updated to recognize workspace reads and bash orientation commands, and agents now comply. Only QA still fails occasionally (8 cases, all "first was bash()" — likely `git` commands in code review tasks). Consider adding `git` to the orientation-tools list.

### C1.3 Recent Performance (Apr 2–4 only)

| Agent | Recent Pass | Recent Fail | Recent Rate | May's Reported |
|-------|-----------|-----------|------------|---------------|
| amy-kimi | 26 | 29 | **47%** | 50% |
| bob | 55 | 16 | **77%** | 58% |
| scout | 17 | 6 | **74%** | 58% |
| optimizer | 43 | 12 | **78%** | 60% |

**Verdict**: C1.3 is still a real problem. Bob/scout/optimizer improved to ~75% but amy-kimi is stuck at 47%. All agents have verify-after-edit skill deployed — it's not sufficient for post-action habits. See existing brief: `agents/coach/workspace/briefs/amy-kimi-c13-regression.md`.

## Specific Actions

### For C12.1 — MOSTLY RESOLVED
- Recent data shows 3/4 worst offenders now at 100%.
- **QA recommendation**: Add `git` to the orientation-bash patterns in the convention checker (QA's first call is often `git log` or `git diff`, which IS orientation).
- No agent-level changes needed — the checker fix solved this.

### For C1.3 — NEEDS INFRASTRUCTURE
- I've exhausted skill-based approaches. The evidence is clear after 19+ text-injection failures and a deployed-but-ineffective verify-after-edit skill across all agents.
- **Recommendation**: Infrastructure-level auto-verification (see option 1 above). This is the only plausible path to >90%.
- **Amy-kimi specific**: L3 heartbeat patch already designed (see `amy-kimi-c13-regression.md`), awaiting deployment.

## Experimental Evidence References
- **EXP-020**: verify-after-edit skill on read-before-edit → DISPROVEN (3 runs, all 10/11, C2.3 consistently fails)
- **EXP-024**: Strict skill variant (1/5), post-edit-readback (1/8) → both INEFFECTIVE
- **EXP-025**: L5 materialization gate works (9/9) but only for judgment tasks, overkill for edit verification
- **EXP-018**: Skill file injection works for PRE-action habits (efficient-file-reading: 6/8→8/8)
- **LIBRARY.md**: Full skill registry with deployment status and evidence
