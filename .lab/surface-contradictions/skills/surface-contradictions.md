---
name: surface-contradictions
description: >
  Before implementing a task with multiple hard constraints, calculate whether
  all constraints can be simultaneously satisfied. If they cannot, write ANALYSIS.md
  documenting the contradiction and propose bounded alternatives with explicit
  tradeoffs. This prevents the failure mode where agents treat impossible tasks as
  pure optimization problems and silently sacrifice one requirement for another.
version: 1.0.0
owner: coach
targets: Requirement contradiction blindness — agent codes without checking feasibility
evidence: >
  EXP-045 baseline: contradictory-requirements scenario 0/3 (agent optimizes pipeline
  but never identifies that strict ordering + 10K rps is mathematically impossible at
  5ms/record sequential). H-085 establishes that forced externalization of judgment
  before action is the general fix for this class of failure (26/26 across 4 scenarios).
---

# Surface Contradictions: Check Feasibility Before Coding

## When to Apply

Apply this skill **before writing any code** when the task has:

- **Two or more hard constraints** (requirements described as "MUST", "critical",
  "hard requirement", "mandatory", "non-negotiable")
- **Performance targets paired with correctness constraints** (e.g., "must be fast"
  AND "must be ordered", "must scale" AND "must be transactional")
- **Multiple stakeholder requirements** that may pull in different directions
- **Any task where you feel the urge to start optimizing immediately** — that urge
  is the signal. Optimization assumes all constraints are satisfiable; check first.

**Do NOT apply** when:
- The task has a single clear requirement (no potential conflict)
- You've already written ANALYSIS.md for this task
- The constraints are soft/flexible ("try to", "ideally", "if possible")

## Why This Matters

The most dangerous failure mode is **silent constraint violation**: you optimize
for one hard requirement while unknowingly breaking another. This happens because:

1. **Agents are biased toward action.** When given a task, the instinct is to start
   coding immediately. Feasibility analysis feels like procrastination.
2. **Optimization framing hides contradictions.** "Optimize the pipeline" sounds
   achievable. "Make sequential processing 50× faster without parallelism" reveals
   the impossibility — but only if you do the math first.
3. **Hard constraints get softened during implementation.** Under pressure to deliver,
   an agent may unconsciously treat a "MUST" as a "SHOULD" and silently break it.

The fix is simple: **do the math before writing code**. Calculate the theoretical
limits. Check whether all constraints fit within those limits. If they don't, that's
not a failure — that's a valuable finding that the stakeholder needs to know about.

## Steps

### Step 1: LIST all hard constraints from the task

Read the task description and extract every hard constraint. Write them as a list:

```
## Constraints Extracted
1. Records MUST be processed in strict order (sequenceId)
2. Throughput MUST reach 10,000 records/sec
3. Tests must continue to pass
```

Be precise. Copy the exact wording from the task — "MUST", "critical", "hard
requirement" are signals of non-negotiable constraints.

### Step 2: CALCULATE feasibility — can all constraints be satisfied simultaneously?

For each pair of constraints, ask: **does satisfying A prevent satisfying B?**

Do the math explicitly:
- If there are performance constraints, calculate theoretical limits
- If there are ordering constraints, check if parallelism (the usual performance fix) breaks them
- If there are resource constraints, check if they're compatible with the performance target

Write the calculation:

```
## Feasibility Check
- Current: 200 records/sec (sequential, 5ms per record)
- Target: 10,000 records/sec = 50× improvement needed
- Constraint: strict sequential ordering
- Math: 5ms/record × sequential = 200/sec MAX. Cannot exceed this without parallelism.
- Parallelism breaks strict ordering.
- CONCLUSION: Constraints 1 and 2 are **mutually exclusive** as stated.
```

**This is the critical step.** If you skip this calculation, you'll spend the
session optimizing toward an impossible target. The 2 minutes spent on math saves
30 minutes of wasted coding.

### Step 3: WRITE ANALYSIS.md with your findings

Create an ANALYSIS.md file in the project root with:

1. **The contradiction**: What constraints conflict and why
2. **The math**: Show the calculation that proves they can't coexist
3. **Alternatives**: At least 2 bounded options with explicit tradeoffs

Example structure:
```markdown
# Requirements Analysis

## Contradiction Identified
[Constraint A] and [Constraint B] cannot be simultaneously satisfied because [reason with math].

## Alternatives
### Option 1: [Relax Constraint A]
- What changes: ...
- Tradeoff: ...
- Achievable target: ...

### Option 2: [Relax Constraint B]  
- What changes: ...
- Tradeoff: ...
- Achievable target: ...

### Option 3: [Hybrid approach]
- What changes: ...
- Tradeoff: ...
- Achievable target: ...

## Recommendation
[Which option and why]
```

### Step 4: THEN (and only then) implement the best feasible option

After writing ANALYSIS.md, implement whichever alternative you recommended.
Make clear in code comments that you're implementing Alternative X, not the
original impossible combination.

**Do NOT silently implement a "compromise" without the written analysis.**
The analysis IS part of the deliverable — stakeholders need to understand
what tradeoffs were made and why.

## Assertions

1. Before any code edits, the agent identifies all hard constraints from the task
   and writes a feasibility assessment — constraints are listed before code changes
   begin.

2. When constraints mathematically conflict, the agent writes ANALYSIS.md (or
   equivalent) documenting the contradiction with explicit calculations — the
   document exists before or alongside any code changes.

3. The analysis proposes at least 2 alternative approaches with explicit tradeoffs
   — not just "this is impossible" but "here are your options."

4. The agent does NOT silently break a hard constraint to satisfy another — if
   ordering is relaxed, the analysis explicitly says so and explains why.

5. The agent treats surfacing a contradiction as a successful outcome, not a
   failure — the finish status reflects that valuable analysis was delivered.

## Anti-Patterns

### AP-1: Optimization Tunnel Vision
The agent reads "optimize throughput" and immediately starts coding performance
improvements — parallelization, batching, caching — without checking whether
those techniques are compatible with the ordering constraint. By the time the
agent discovers the conflict (if ever), it's deep into an implementation that
silently breaks a hard requirement.

**Fix**: Step 2 explicitly. Before writing any optimization code, calculate
whether the target is achievable within all stated constraints. Two minutes of
math prevents thirty minutes of misdirected coding.

### AP-2: Silent Constraint Softening
The agent recognizes the tension between constraints but addresses it by
quietly relaxing one — e.g., using "mostly ordered" output instead of "strictly
ordered." The code might pass cursory review, but the hard requirement (strict
ordering) was violated without explicit stakeholder acknowledgment.

**Fix**: Step 3 requires ANALYSIS.md. If a constraint must be relaxed, it's
documented with the reasoning and tradeoffs. Silent softening is a judgment
failure; documented softening is professional engineering.

### AP-3: "It Can't Be Done" Without Alternatives
The agent correctly identifies the contradiction but stops there — "these
requirements are impossible" with no constructive path forward. This is
technically correct but unhelpful. The stakeholder already suspects there
might be a tension; what they need is bounded options.

**Fix**: Step 3 requires alternatives. "You can have A or B, here's what
each costs" is far more valuable than "you can't have both."
