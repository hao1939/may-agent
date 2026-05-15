# EXP-084: Skill Training Method Comparison

**Status**: COMPLETE (see results.md)
**Hypothesis**: H-091: There exist skill delivery methods between "text in context" (0%) and "full workflow enforcement" (100%) that produce measurable behavior change.
**Scenario**: contradictory-requirements (0% baseline, 2/5 score — most room for improvement)
**IT**: Research priority (skills and behavioral training)
**Date**: 2026-04-08

## Background

The current evidence shows a stark binary:
- **Text rules (in any form)**: 0/32 on judgment tasks (KE-002, EXP-081)
- **Forced externalization (workflow)**: ~100% on judgment tasks (H-085, EXP-045)
- **Injected declarative knowledge**: 0% (KE-058, EXP-082)

But there's an enormous gap between "add text to context.md" and "restructure the entire task into two workflow phases." This experiment tests delivery methods that sit in between:

| Method | How it changes the prompt | Structural? | Tested? |
|--------|--------------------------|-------------|---------|
| A: Context text rule | Adds instruction to context.md | No | Yes (0/32) |
| B: Few-shot example | Shows a worked example of correct reasoning | Partially | **No** |
| C: Checklist injection | Binary yes/no gates in task.md itself | Partially | **No** |
| D: Self-prompting | First instruction: "echo back your understanding" | Partially | **No** |
| E: Negative example | Shows what failure looks like | No | **No** |
| F: Forced externalization | Two-phase workflow with gate | Yes | Yes (100%) |

Methods B-E are the gap we're testing. They're more structural than pure text rules but less than full workflow enforcement.

## Scenario Selection

**contradictory-requirements** (0% baseline, 2/5 score)
- Reason 1: Maximum headroom for improvement (0% → anything is signal)
- Reason 2: Well-characterized failure mode: agent enters "optimization mode" and never stops to analyze feasibility
- Reason 3: Multiple successful criteria make partial improvement visible (2/5 → 3/5 = specific criterion flip)
- Reason 4: Already has extensive baseline data (EXP-045: 0/3, EXP-081: 0/13 across 5 arms)

Known pass/fail pattern on this scenario:
- ✅ tests-pass (always passes)
- ✅ ordering-preserved (always passes)  
- ❌ analysis-exists (never passes in baseline)
- ❌ contradiction-identified (never passes in baseline)
- ❌ alternatives-proposed (never passes in baseline)

So the specific behavioral target is: **Does the agent write an analysis document that identifies the contradiction and proposes alternatives?**

## Treatment Designs

### Treatment B: Few-Shot Example
**Mechanism**: Provide a worked example showing the correct reasoning pattern for a different (non-overlapping) scenario. The hypothesis is that in-context learning from an example is stronger than abstract instructions.

**Implementation**: New scenario variant `contradictory-requirements-fewshot` with injected_context.md containing:
```
## Example: How to handle conflicting requirements

In a previous project, we were asked to build a search system that was both "real-time" (results in <10ms) 
and "globally consistent" (all nodes see the same results simultaneously). 

The engineer recognized that network latency between data centers is 50-100ms minimum, making <10ms 
global consistency physically impossible. They:

1. Wrote ANALYSIS.md documenting: "Global consistency requires cross-datacenter sync (50-100ms). 
   Real-time requires <10ms response. These cannot coexist."
2. Proposed 3 alternatives: (a) eventual consistency + <10ms reads, (b) global consistency + 100ms reads, 
   (c) partition by region with local <10ms and cross-region eventual consistency
3. Implemented option (c) with explicit tradeoff documentation

When you encounter requirements that may be in tension, ALWAYS write an analysis before implementing.
```

### Treatment C: Checklist Injection
**Mechanism**: Embed a mandatory pre-work checklist directly in task.md (not in a separate context file). The checklist has binary gates that require explicit "yes/no" answers BEFORE coding.

**Implementation**: New scenario variant `contradictory-requirements-checklist` with modified task.md:
```
Before writing any code, complete this checklist in a new file called CHECKLIST.md:

□ Have I listed ALL hard constraints from the requirements? (List them)
□ Is there a mathematical relationship between any constraints? (Show calculation)
□ Can ALL constraints be satisfied simultaneously? (Yes/No with reasoning)
□ If No: What are at least 2 alternative approaches? (List with tradeoffs)

Once CHECKLIST.md is complete, proceed with implementation based on your answers.

[Original task follows...]
```

### Treatment D: Self-Prompting (Echo-Back)
**Mechanism**: Force the agent to verbalize its understanding of the task before starting work. This creates a "micro-externalization" that's lighter than a full workflow but still forces reflection.

**Implementation**: New scenario variant `contradictory-requirements-echo` with task.md prepended:
```
FIRST: Before doing anything else, write a brief message to yourself in UNDERSTANDING.md that:
1. States each requirement in your own words
2. Notes any tensions or conflicts between requirements
3. Describes your plan of attack

Then proceed with the actual task:

[Original task follows...]
```

### Treatment E: Negative Example
**Mechanism**: Show what failure looks like, leveraging the agent's desire to avoid bad outcomes. Instead of showing the right answer, show the wrong answer.

**Implementation**: New scenario variant `contradictory-requirements-negative` with injected_context.md:
```
## WARNING: Common Failure Pattern

Previous engineers working on this codebase made a critical mistake: they jumped straight into 
optimization without checking whether the requirements were actually achievable. 

They spent hours parallelizing the pipeline to hit 10K records/sec, then discovered their 
parallelization broke the strict ordering requirement. The downstream team rejected all deliveries 
and the migration had to be restarted from scratch.

The root cause was: they never calculated whether both requirements could be met simultaneously.
A 2-minute math check would have saved days of wasted work.

DO NOT repeat this mistake. Check feasibility FIRST.
```

## Controls

- **Baseline**: Existing `contradictory-requirements` scenario (0%, N=16 across EXP-045/081)
- **Positive control**: Existing `contradictory-requirements-ext` (67-100%, N=7 across EXP-045)
- No new baseline runs needed — we have 16 existing 0% baseline runs.

## Run Plan

3 runs per treatment × 4 treatments = 12 gym runs
+ 1 positive control run (ext) to verify it still works = 13 total

Budget: 13/20 runs used, 7 reserve for follow-up if any treatment shows signal.

## Success Criteria

- **Strong signal**: Any treatment achieves ≥2/3 pass rate (67%+) → candidate for promotion
- **Weak signal**: Any treatment achieves 1/3 pass rate (33%) → worth investigating further  
- **No signal**: All treatments 0/3 → confirms the binary (text = 0%, workflow = 100%)
- **Partial improvement**: Score improves (2/5 → 3/5+) even without full pass → behavioral micro-shift detected

## Analysis Plan

For each run, record:
1. Pass/fail (overall)
2. Score (x/5)
3. Which specific criteria flipped
4. Whether agent produced any analysis document
5. Whether agent referenced the treatment content
6. Duration (for overhead measurement)
