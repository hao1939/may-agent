# EXP-031: On-Demand Workflow Discovery — Can Agents Find and Use Workflows at Runtime?

**Date**: 2026-04-05
**Author**: Optimizer
**Status**: Designed (ready for execution)
**Tags**: workflow, discovery, delivery-mechanism, runtime

## Research Question

Can agents discover and successfully apply workflows at runtime without pre-loading instructions — and what is the **minimum prompt intervention** needed to activate this behavior?

## Background

### What We Know
1. **EXP-028**: Removing workflow.run() instructions from coach heartbeat → 0% workflow usage within 24h, 51pp done rate collapse. Agents don't spontaneously discover workflows.
2. **REGISTRY audit**: 9/11 shared workflows had exactly 0 production runs. They existed but were never found by any agent.
3. **Training-sprint cron**: Embeds `workflow.run()` in task string, but the LLM ignores it — only heartbeat instructions are followed.
4. **Post-fix observation (Apr 4-5)**: Even after restoring workflow instructions as Options E-F in coach heartbeat, workflow usage remained 0%. Coach consistently picks Options A-D instead.
5. **Workflow tool exists**: All agents have `workflow({action: "list"})` available. It returns names + descriptions. No agent has ever spontaneously called it.

### Key Insight from EXP-028
There are three distinct failure modes:
- **F1: Awareness failure** — Agent doesn't know workflows exist (no mention in context)
- **F2: Discovery failure** — Agent knows workflows exist but doesn't call `workflow.list()` to find them
- **F3: Selection failure** — Agent calls `workflow.list()`, sees options, but doesn't use one

This experiment isolates each failure mode.

### Relationship to EXP-030 (Coach's Skill Discovery)
EXP-030 tests whether a common-sense.md nudge triggers **skill** discovery via LIBRARY.md reading. This experiment (EXP-031) tests whether various prompt interventions trigger **workflow** discovery via the `workflow.list()` tool. Different mechanism, complementary results. Together they answer: "What's the minimum intervention for runtime tool/resource discovery?"

---

## Experiment Design

### Overview: 5 Arms Testing Escalating Interventions

| Arm | Intervention Level | What's Added | Tests |
|-----|-------------------|--------------|-------|
| A | **Baseline** (L0) | Nothing — standard agent context | F1 (awareness) |
| B | **Common-sense nudge** (L2) | One line in common-sense.md: "Check available workflows with workflow.list() before starting complex tasks" | F1→F2 (does awareness → discovery?) |
| C | **Heartbeat hint** (L2.5) | Workflow section in heartbeat with example: "For multi-step work: `workflow({action: 'list'})` to see available workflows" | F2→F3 (does discovery → selection?) |
| D | **Heartbeat directive** (L3) | Strong instruction: "BEFORE starting, run workflow({action: 'list'}) and use a matching workflow if one exists" | F3 (does strong instruction → actual use?) |
| E | **JS-level injection** (L5) | Cron handler automatically prepends workflow.list() output to task context | Bypasses F1-F2, tests F3 only |

### Test Scenarios

We need scenarios where a workflow EXISTS that would help, and where the baseline (no workflow) is measurably worse. From REGISTRY and gym data:

**Scenario Set 1: Production-like tasks (gym scenarios with workflow variants)**

| Scenario | Baseline Score | With Workflow | Available Workflow | Why Workflow Helps |
|----------|---------------|---------------|-------------------|-------------------|
| behavior-escalation-stubborn | 0/3 escalation | 3/3 (100%) | obstacle-pivot pattern | Forces assess→act structure |
| misleading-test-fix | 5/8 | 11/11 | evidence-over-narrative | Forces independent calculation |
| context-npx-avoidance | 0% npx-check | 100% | tool-discipline | Forces discover→execute phases |

These are NON-CEILING scenarios where workflows provide a proven benefit. The question is whether agents can FIND the workflow themselves.

**Scenario Set 2: Multi-step tasks where `implement-and-review` would help**

For any coding task, `implement-and-review` (coder→QA→fix) provides structure. We can test whether agents discover it for standard fix/build tasks.

### Measurement Protocol

For EACH run, record:
1. **Called workflow.list()?** (yes/no) — search transcript for `workflow.*list`
2. **Called workflow.run()?** (yes/no) — search for `workflow.*run`  
3. **Which workflow selected?** (name or none)
4. **Task outcome** (pass/fail per scenario scorer)
5. **Ops used** (efficiency)
6. **Time to first workflow call** (if any — which turn?)

### Key Metrics
- **Discovery Rate**: % of runs where agent calls `workflow.list()`
- **Selection Rate**: % of discovery runs where agent then calls `workflow.run()`
- **Completion Rate**: % of workflow runs that complete successfully
- **Outcome Delta**: Score improvement vs baseline (does discovery → better results?)

---

## Detailed Arm Specifications

### Arm A: Baseline (no intervention)
- Standard agent context (SOUL.md + skills/ + common-sense.md as-is)
- No mention of workflows anywhere in prompt
- **Prediction**: 0% discovery rate (based on EXP-028: agents never spontaneously discover tools)

### Arm B: Common-Sense Nudge
Add to `common-sense.md` (last line of the file):
```
- **Workflow Discovery.** For complex multi-step tasks, run `workflow({action: "list"})` to see if a pre-built workflow can handle it more reliably.
```
- ~25 tokens added to context
- **Prediction**: 5-15% discovery rate. Common-sense.md is read but text nudges have 0/21 historical success rate. Slightly better odds because this points to a TOOL (concrete action) rather than a BEHAVIOR (vague instruction).

### Arm C: Heartbeat Hint
Add a section to the agent's heartbeat.md (after Section 1):
```
## Available Workflows
You have pre-built workflows for common task patterns. Check what's available:
```
workflow({action: "list"})
```
Workflows coordinate multi-agent pipelines (e.g., implement→review→fix) and have 84% done rate vs 74% standalone.
```
- ~50 tokens added to heartbeat
- **Prediction**: 20-40% discovery rate. Heartbeat instructions have moderate influence (EXP-028 showed they work when they specify exact workflow.run() calls, but the Options E-F restoration showed they DON'T work when presented as optional alternatives).

### Arm D: Heartbeat Directive
Replace Section 2 opening in heartbeat with:
```
## REQUIRED: Check Workflows First
BEFORE starting work, run: `workflow({action: "list"})`
If a matching workflow exists for your task, USE IT. Workflows have 0% error rate vs 10% standalone.
Then proceed with your chosen approach.
```
- ~40 tokens, but positioned as REQUIRED step
- **Prediction**: 50-70% discovery rate. Strong directives in heartbeats work (EXP-028 pre-rewrite had ~85% workflow usage with explicit instructions). But "check and decide" may be weaker than "run this specific workflow."

### Arm E: JS-Level Injection
Modify the cron handler to prepend workflow listing to the task context:
```typescript
// In the cron handler, before dispatching the task:
const workflows = await workflowTool.execute("", {action: "list"});
task = `## Available Workflows\n${workflows}\n\n---\n\n${task}`;
```
This bypasses the discovery step entirely — the agent SEES the workflows without needing to call workflow.list().
- **Prediction**: 30-50% selection rate. The agent sees the options but must still choose to use one. Based on EXP-028 follow-up (Options E-F in heartbeat = 0% usage), merely showing options isn't enough. But injecting into task context may be more salient than heartbeat options.

---

## Execution Plan

### Phase 1: Gym Validation (2-3 days)
Test Arms A-D in the gym with `behavior-escalation-stubborn` (strongest known workflow delta: 0→100%).

**Per arm**: n=3 runs
**Total runs**: 12 (4 arms × 3 runs)
**Cost estimate**: ~$1.40/run × 12 = ~$17

#### Gym Setup for Each Arm
- **Arm A**: Standard `scripts/gym-run.sh behavior-escalation-stubborn --agent coder`
- **Arm B**: Create lab fork with common-sense.md nudge added
- **Arm C**: Create lab fork with heartbeat hint added  
- **Arm D**: Create lab fork with heartbeat directive added

#### Success Criteria (Phase 1)
- Arm A: Confirm 0% workflow discovery (validate baseline)
- Arm B-D: Measure discovery rate; any arm >50% discovery triggers Phase 2

### Phase 2: Multi-Scenario Validation (3-5 days)
If Phase 1 finds a working intervention, test it across all 3 scenarios to check generalization.

**Per scenario per arm**: n=2 runs  
**Arms tested**: Winning arm from Phase 1 + baseline
**Total runs**: 12 (2 arms × 3 scenarios × 2 runs)

### Phase 3: Production Pilot (1 week)
Deploy winning intervention to one production agent (coach or tech-lead) and measure:
- Workflow discovery rate in real heartbeat sessions
- Done rate delta
- Error rate delta

---

## Lab Fork Design

### Fork Structure
```
agents/.lab/workflow-discovery-arm-B/
  common-sense.md    # Copy of shared/common-sense.md + nudge line
  
agents/.lab/workflow-discovery-arm-C/
  heartbeat.md       # Copy of coder/heartbeat.md + workflow section
  
agents/.lab/workflow-discovery-arm-D/
  heartbeat.md       # Copy of coder/heartbeat.md + directive section
```

### Important: Workflow Availability
The `workflow` tool is available to ALL agents by default (it's in the standard tool set). The gym scenarios that test workflow variants (e.g., `behavior-escalation-stubborn-workflow`) have `"workflow": true` in scenario.json, which makes the gym runner inject a specific workflow. 

For THIS experiment, we DON'T use the -workflow scenario variants. We use the BASE scenarios and test whether the agent discovers and applies a workflow ON ITS OWN.

However, we need to ensure the relevant workflows are actually available in the agent's workflow directory or shared directory. Currently:
- `implement-and-review` → shared/workflows/ ✅
- `skill-lifecycle` → shared/workflows/ ✅
- Coach workflows → coach/workflows/ only

**Issue**: The gym-scenario workflows (obstacle-pivot, evidence-over-narrative, tool-discipline) are **gym-specific workflow variants embedded in scenario.json** — they're NOT standalone workflow files agents can discover via `workflow.list()`. 

**This means**: For the gym test, the only discoverable workflow is `implement-and-review` and `skill-lifecycle`. Neither is task-specific enough to help with `behavior-escalation-stubborn`.

**Revised approach**: Use `implement-and-review` as the target workflow, with a coding task where it would help. OR create a simple discoverable workflow that maps to the scenario.

### Alternative: Test with Production-Style Tasks

Instead of gym scenarios (which have specialized workflow variants), test with a multi-step coding task where `implement-and-review` is the natural workflow:

**Scenario**: Give coder a task like "Fix the bug in X and add a test for it"
- Without workflow: coder fixes directly (baseline quality)
- With implement-and-review: coder→QA→fix cycle (better quality, 0% error rate)

This is more realistic — it tests whether an agent facing a code task discovers that `implement-and-review` exists and uses it.

---

## Predictions Summary

| Arm | Discovery Rate | Selection Rate | Outcome Improvement |
|-----|---------------|----------------|---------------------|
| A: Baseline | 0% | n/a | 0 (baseline) |
| B: CS nudge | 5-15% | 50% of discovered | Minimal (too few discover) |
| C: HB hint | 20-40% | 40-60% of discovered | Moderate where selected |
| D: HB directive | 50-70% | 60-80% of discovered | Significant where selected |
| E: JS injection | n/a (bypassed) | 30-50% | Moderate |

**Overall prediction**: Discovery requires at least L3 (heartbeat directive) to reach actionable rates. L2 nudges will largely fail, consistent with the 0/21 text-injection pattern. The key finding will be that **discovery and selection are separate problems** — even agents who discover workflows may not select them.

## Decision Points

1. If Arm D discovery rate >60% → Deploy directive approach to production agents
2. If Arm D discovery rate 30-60% → Investigate why agents discover but don't select; consider Arm E
3. If all arms <20% → Abandon prompt-based discovery; recommend JS-level workflow dispatch (P3 from EXP-028)
4. If Arm E selection rate >50% → JS injection is the viable delivery mechanism

## What This Experiment Does NOT Test
- Whether the workflow itself is good (already proven in prior experiments)
- Whether agents can CREATE workflows (out of scope — we test discovery of existing ones)
- Whether workflow completion rates change with discovery method (Phase 3 concern)

---

## Appendix: EXP-028 Timeline (Context)

| Date | Event | Workflow Usage | Coach Done% |
|------|-------|---------------|-------------|
| Mar 29-30 | Normal operations | 7-8/day | 84-89% |
| Apr 1 | Heartbeat rewrite removes workflow refs | 1 | 50% |
| Apr 2-3 | Post-rewrite | 0 | 28-39% |
| Apr 4 | Workflow refs restored as Options E-F | 0 | 68% |
| Apr 5 | Still Options E-F | 0 | — |

The Apr 4-5 data (restored but still 0%) is the strongest evidence that **optional listing is insufficient**. This experiment tests what IS sufficient.
