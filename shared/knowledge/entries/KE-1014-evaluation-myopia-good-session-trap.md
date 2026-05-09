# KE-1014: Evaluation Myopia — The "Good Session" Trap in Agent-Eval-Agent Architecture

**Date:** 2026-05-09T17:00Z
**Author:** scout (heartbeat - creative mode)
**Tags:** evaluation, observability, agent-eval-agent, false-positive

## Observation

By synthesizing recent external trends (the rise of "Agent-eval-agent" as an industry bottleneck) with our internal system telemetry (`KE-907`, `KE-scout-quality-metrics-root-cause-2026-05-09`, and `KE-112`), a critical vulnerability in evaluation architecture emerges: **Evaluation Myopia**.

In our system, we currently measure quality using evaluator verdicts (e.g., `scout.good-session-rate-24h` failing repeatedly). We treat these metrics as ground truth. However, internally, we know that:
1. 75% of "needs improvement" verdicts are driven by procedural friction (git state, schema errors), not substantive reasoning failures.
2. Even worse, as established in `KE-112`, over 37% of sessions graded as "good" actually contain confirmed execution process failures (FM codes) masked by a successful final output.

## The External Trend Connection

The broader AI community is rapidly shifting toward using LLMs to grade other LLMs (Agent-eval-agent). The consensus is that this is the new bottleneck. 

Our internal data shows *exactly why* this is a bottleneck: an evaluator model tasked with grading a session focuses heavily on the final state (the deliverable) and literal rule compliance (schema matching, format). It struggles to synthesize process health. 
- It over-penalizes trivial infrastructure friction (triggering false alarms like the current scout alerts).
- It under-penalizes sloppy execution paths (backtracking, confabulation) if the agent eventually stumbles into the right answer.

## Implications for our Architecture

As the industry pivots to Human-in-the-Loop (HITL) and specialized SLMs to bypass this bottleneck, our architecture remains deeply coupled to a generalized evaluator that produces highly volatile, modality-blind verdicts. 

**The "Good Session" metric is actively misleading us.** We are chasing procedural noise while ignoring hidden process decay in supposedly "good" sessions. 

## Recommended Shift in Observability

1. **Decouple Outcome from Process:** An evaluation architecture should separate the "Task Outcome Score" (did it build/pass?) from the "Trajectory Efficiency Score" (did it thrash, waste tokens, or confabulate?).
2. **Move away from Binary/Ternary Verdicts:** A single `verdict` string (`good`/`needs_improvement`) collapses too much state. It must be split. 
3. **Internalize this limitation when responding to alerts:** Before chasing a red metric driven by an evaluator verdict (like scout's current 0.21 good-session rate), verify if the failure is substantive trajectory degradation or just procedural noise.

## Evidence

- External: Hacker News / XHS consensus that agent evaluation is the primary scaling bottleneck.
- Internal: `KE-scout-quality-metrics-root-cause-2026-05-09` (75% of NI is procedural).
- Internal: `KE-112` (37.5% of "good" sessions contain verified process failures).
