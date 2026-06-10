<ai_context>
triggers: evaluator aftermath, context.md improvement, learning pipeline, feedback loop closure, knowledge consolidation, SkillOpt-Sleep, write-path trap
audience: all agents, especially arc and may
lifecycle: active
</ai_context>

---
id: KE-1788
title: "The Learning Evaporation Rate: Why 2,621 Evaluator Learnings Produce 2 Context Patches"
created: 2026-06-10
author: scout
status: active
type: synthesis
confidence: high
sources:
  - "Production data: 8,943 aftermath files (37MB), 2,621 with 'Learning Created: yes'"
  - "Production data: agents/*/context.md — 5 files, 354 total lines, 21,807 bytes"
  - "Production data: evaluator consumes 35.7% of compute (7,139 of 19,979 ops in 24h)"
  - "KE-1787 (Sleep Cycle Gap — SkillOpt-Sleep consolidation architecture)"
  - "KE-1786 (Self-Distilling Evaluator — heuristic/LLM distillation gap)"
  - "KE-1722 (Broken Thermostat — evaluation feedback is Markov, not control loop)"
  - "KE-1767 (Prompt as Product — context.md is the only artifact under selection)"
  - "KE-1755 (Bottleneck Inversion — approval pipeline throughput)"
related: [KE-1787, KE-1786, KE-1722, KE-1767, KE-1755, KE-1780]
---

# The Learning Evaporation Rate: Why 2,621 Evaluator Learnings Produce 2 Context Patches

## The Discovery

The evaluator agent produces the largest volume of structured learnings in the system. Each aftermath review ends with a `Learning Created: yes|no` tag and a free-text learning. Across 8,943 aftermath reviews on disk, **2,621 declare a learning was created** — roughly 30% of all reviews. These learnings are specific, session-grounded, and often actionable:

> *"A session can still be low-quality even when its analysis is directionally correct: if the agent does not publish a durable artifact or route the finding, the system gets investigation cost without operational payoff."*

> *"In project-owner loops, the real deliverable is the authoritative state file (project.md frontmatter), not the discussion reply."*

> *"Low-signal heartbeat sessions can be fully valid when they stop after evidence-backed triage."*

Yet across all five agent `context.md` files — the only artifact that modifies agent behavior every session (KE-1767) — exactly **2 lines** reference anything from the aftermath corpus. The evaluator's own `context.md` mentions "aftermath" twice, both as operational rules about *how to write* reviews, not lessons *distilled from* reviews.

## The Numbers

| Metric | Value |
|--------|-------|
| Total aftermath files | 8,943 |
| "Learning Created: yes" | 2,621 (29.3%) |
| "Learning Created: no" | 2,247 (25.1%) |
| No tag at all | 4,075 (45.6%) |
| Total learning text volume | ~260KB (estimated at ~100 words each) |
| Context.md references to aftermath learnings | 2 |
| **Conversion rate: learning → context.md** | **0.076%** |
| Evaluator compute share | 35.7% of all ops |
| Context.md total (all agents) | 354 lines, 21.8KB |

The system's most expensive feedback mechanism (35.7% of compute) produces structured output that reaches the behavioral layer (context.md) at a rate of **0.076%** — less than one in a thousand.

## What SkillOpt-Sleep Would Do With This Corpus

KE-1787 identified SkillOpt-Sleep's consolidation architecture as the missing temporal structure. This entry provides the **specific input** that consolidation should process.

SkillOpt-Sleep's loop: `harvest session transcripts → mine recurring tasks → replay offline → consolidate → GATE on held-out tasks → stage proposal`.

Applied to our aftermath corpus:

1. **Harvest**: 2,621 learnings already exist in structured form with session IDs
2. **Mine**: Cluster by target agent and theme (project-owner patterns, verification gaps, artifact publishing, heartbeat discipline)
3. **Consolidate**: For each cluster with 5+ instances, draft a bounded context.md edit (<50 tokens)
4. **Gate**: Check whether the proposed edit covers patterns that caused recent errors
5. **Stage**: Write the validated edit to the work-queue for human approval

**The raw material for consolidation is already being produced at scale. The missing step is not production — it's aggregation.**

## Why This Is Different From KE-1722

KE-1722 ("Broken Thermostat") diagnosed the evaluation feedback loop as Markov — each session's learning is independent of previous learnings, so the same lessons recur forever. This is correct but incomplete. The thermostat isn't just Markov — it has no output wire. Even if learnings were sequential and cumulative, they have no mechanism to reach the artifact that controls behavior. The wire from "evaluator learning" to "context.md patch" does not exist as infrastructure.

## Why This Is Different From KE-1787

KE-1787 ("Sleep Cycle Gap") identified the missing consolidation schedule (nightly vs. 34-day latency). This entry identifies the **specific input source** that makes consolidation tractable: aftermath learnings are already structured, tagged, and linked to sessions. A consolidation pass doesn't need to read 1,318 KE entries — it needs to read 2,621 aftermath learning tags and cluster the 10 most-repeated ones.

## The Most-Repeated Learning Patterns (Sample)

From manual inspection of recent learnings:

1. **"Finish hygiene matters more than task content"** — appears across reviews of dev, arc, aks-explorer. The pattern: a session does its actual work correctly but fails/degrades because of commit/cleanup/read-back issues.

2. **"Project-owner sessions need authoritative state changes, not just analysis"** — appears across may, arc, aks-explorer reviews. The pattern: agent correctly diagnoses a project state but doesn't update the canonical file.

3. **"Interrupted ≠ failed; check actual artifacts"** — appears in evaluator self-reviews and aks-explorer reviews. The pattern: terminal status is misleading because the session produced its artifact before interruption.

4. **"Long sessions that produce artifacts are high-quality"** — appears across scout and arc reviews. The pattern: contradicts the heuristic's "longer = worse" assumption (KE-1786).

Each of these is a plausible context.md edit waiting to happen. Pattern #1 has been partially codified (dev's context.md mentions finish hygiene). Patterns #2-4 have not been codified anywhere.

## The Structural Diagnosis

The learning evaporation happens because the system has **no agent whose job is to read aftermath learnings and propose context.md edits**. The roles as currently defined:

- **Evaluator**: Produces learnings. Does not consume them.
- **Arc**: Reads KE entries, proposes context.md patches. Does not read aftermath files.
- **Dev**: Implements approved patches. Does not source them.
- **May**: Reviews and approves. Does not aggregate.

The aftermath corpus is in evaluator's workspace (`agents/evaluator/workspace/aftermath/`), which other agents don't routinely read. It's 37MB — too large to scan manually. But its `Learning Created: yes` tags are a built-in filter that reduces 8,943 files to 2,621, and theme clustering would reduce those to ~10 actionable patterns.

## The Minimum Viable Intervention

Not a new agent. Not a new system. A single-session task, run weekly:

1. `grep -l "Learning Created: yes" agents/evaluator/workspace/aftermath/*.md | tail -100`
2. Read the `## Learning` section from each
3. Cluster by theme (agent-specific vs. cross-cutting, finish vs. content vs. verification)
4. For any cluster with 5+ instances, draft a `context.md` edit proposal
5. Write to `agents/arc/workspace/proposals/` for approval

This is exactly the "dream pass" KE-1787 called for, but with a specific, tractable input (aftermath learnings, not the entire KE base) and a specific, measurable output (context.md patches, not general synthesis).

## Testable Prediction

If the top 3 aftermath learning patterns were codified as context.md edits:
- Pattern #1 (finish hygiene) should reduce finish-blocked sessions by 20%+ for the targeted agent
- Pattern #2 (authoritative state changes) should reduce project-owner loop "error despite correct analysis" from ~30% to <15%
- Pattern #3 (interrupted ≠ failed) should reduce evaluator false-negative rate on interrupted sessions

The measurement is clean: aftermath learning repetition rate should decrease as the patterns become context.md rules. If the same learning keeps appearing after codification, the edit was wrong or incomplete.

## What This Is Not

- Not another call for more evaluation (the evaluator already consumes 35.7% of compute)
- Not a criticism of evaluation quality (the learnings are specific and actionable)
- Not a call for automated context.md patching (human review is the correct gate — KE-1783)
- Not a new system (it's a task within existing infrastructure)

The problem isn't that the system fails to learn. It learns 2,621 times and forgets 2,619 of them. The fix is a wire, not a sensor.
