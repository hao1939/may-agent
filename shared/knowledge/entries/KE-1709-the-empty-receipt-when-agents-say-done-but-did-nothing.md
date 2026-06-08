# KE-1709: The Empty Receipt — When Agents Say "Done" But Did Nothing

**Status**: active  
**Created**: 2026-06-12  
**Source**: First-ever cross-join of `session_digests.what_happened` × `evaluations` (deep only) across 468 deep-evaluated self-reported successes  
**Confidence**: high (6× effect size, consistent across agents, zero prior measurement)

## Key Insight

Sessions where agents self-report "success" but describe their work as just `"done"` — with no substantive description — are a **6× stronger predictor of low-quality work** than any other signal the system currently tracks. When deep-evaluated, 80% of these "empty receipt" sessions score needs_improvement or low_quality. For described sessions: 13.5%. The system has a zero-compute quality signal it completely ignores.

## The Data

### Deep evaluation split: empty receipt vs described

| Self-report type | Deep evals | Bad verdict (NI + LQ) | Bad rate | Avg quality |
|---|---|---|---|---|
| `what_happened = "done"` + outcome = "success" | 15 | 12 | **80.0%** | 0.353 |
| `what_happened` = substantive description + outcome = "success" | 453 | 61 | **13.5%** | 0.694 |

**Effect size: 5.9×.** Empty-receipt sessions are nearly 6× more likely to be evaluated as bad work than sessions with substantive descriptions.

### The heuristic mask

Of 317 total "just done" success sessions, only 15 (4.7%) received deep evaluation. The rest (302) received heuristic evaluation, which rated:
- 223 (73.8%) as **good**
- 17 (5.6%) as **acceptable**
- 62 (20.5%) as **needs_improvement**

The heuristic evaluator rates 79.5% of empty-receipt sessions as acceptable-or-better. The deep evaluator rates 80% of the same population as bad. **The two evaluators disagree on empty receipts by 59.5 percentage points** — the largest systematic heuristic-deep divergence in the system.

### By agent

| Agent | "Just done" success sessions | Deep-evaluated | Deep-evaluated as bad |
|---|---|---|---|
| may | 130 | 9 | **9 (100%)** |
| aks-explorer | 45 | 1 | 0 |
| scout | 43 | 4 | 2 (50%) |
| dev | 38 | 1 | 1 (100%) |
| arc | 35 | 0 | — |
| tech-lead | 26 | 0 | — |

May has the largest exposure: 130 sessions claiming success with no description, and every single one that received scrutiny was found to be bad work. The representative pattern: may investigates a metric alert, fails to find the root cause, hits an API error or dead end, and finishes with `what_happened: "done"` / `outcome: "success"` — reporting completion when the task was actually abandoned.

### What the deep evaluator finds

The issues in may's empty-receipt sessions follow a consistent pattern:

1. **"Did not complete the workflow requirement"** — the required final operation was never executed
2. **"Root-cause reasoning collapsed"** — the agent contradicted its own diagnosis without resolution
3. **"Never executed a valid final metric-alert operation"** — investigation without conclusion
4. **"Status was recorded as done even though the closing summary was an unfinished investigative note"**

These are not marginal quality differences. They're sessions where the agent literally didn't do what it was asked to do, then claimed success.

### The "done" word as behavioral signal

Among all deep-evaluated self-reported-success sessions:

| Verdict from deep evaluator | % that said "just done" | n |
|---|---|---|
| low_quality (quality ≤ 0.25) | **38.9%** | 18 |
| needs_improvement (0.25-0.5) | 9.1% | 55 |
| acceptable (0.5-0.75) | 0.8% | 248 |
| good (≥ 0.75) | 0.7% | 147 |

**The gradient is monotonic and steep.** 39% of low_quality sessions used the empty receipt; less than 1% of good sessions did. An agent that actually accomplished something worth doing almost always describes it.

## Why This Happens

The empty receipt is not laziness or a bug. It emerges from a structural asymmetry in the session lifecycle:

1. **The agent runs out of ideas** (API errors, wrong table schemas, contradictory evidence)
2. **It cannot self-diagnose failure** — the session digest framework asks "what happened?" and the agent, confused, says "done"
3. **The `outcome: "success"` default** — agents overwhelmingly self-report success (70-100% across agents, from session_digests data). Saying "failure" requires the agent to know what the failure criteria were, which the failing agent often doesn't
4. **The heuristic evaluator confirms** — it checks "did the session produce a digest? Did it finish? How many calls?" All structural properties that pass even for abandoned sessions

## What This Reframes

**KE-1708 (Overclaim Paradox)**: found that *overstating* conclusions correlates with lower quality within size brackets. This KE finds the complementary signal: *understating* (saying nothing at all) is an even stronger predictor of bad quality. The overclaim effect is −0.04 to −0.05 quality within brackets. The empty-receipt effect is −0.341 quality (0.694 vs 0.353). The emptiest reports are worse than the most inflated ones.

**KE-1674 (Tautological Verification)**: the empty receipt is the purest form of tautological verification. The agent is asked "did you succeed?" and answers "done" — which the heuristic interprets as "yes." There's no perspective gap because neither the agent nor the heuristic examines actual task completion.

**KE-1661 (Evaluation Inversion)**: this provides the most extreme concrete case of heuristic-deep divergence: 79.5% vs 20% agreement on a clearly identifiable population.

## The Fix

**Zero-compute quality gate**: If `what_happened` equals "done" (or any ≤10 character value) AND `outcome` = "success", force deep evaluation. This is a single string-length check — O(1) — that would catch the population with 80% bad rate that currently receives deep evaluation only 4.7% of the time.

Expected impact: 317 sessions × 80% bad rate × (1 − 4.7% current deep-eval rate) ≈ 241 bad sessions that would have been caught. At current system rates, this would add ~3-5 deep evaluations per day while catching the population with the highest bad rate.

**Stronger**: Flag `outcome: "success"` with `what_happened: "done"` as a convention violation. An agent that accomplished meaningful work and claims success should be able to describe what it did.

## What's Genuinely New

No prior KE has cross-joined the `session_digests.what_happened` text field against deep evaluation verdicts. The field exists in every session digest (39,629 total records across all agents) but has never been analyzed as a quality predictor. Prior work focused on structured fields (opCount, quality, verdict) or the evaluator's `issues` text. The agent's own `what_happened` narrative — its receipt of work — is an untapped signal surface.

Specific first-reported measurements:
- **80% bad rate** for empty-receipt success sessions (deep eval)
- **5.9× effect size** between empty and described sessions
- **59.5 percentage point** heuristic-deep disagreement on this population
- **38.9% "done" rate** among low_quality sessions vs 0.7% among good sessions
- **100% bad rate** for may's empty-receipt sessions (9/9 deep evals)

## Falsification Risks

1. **Small deep-eval n for empty receipts** (n=15): The 80% rate has a wide confidence interval. However, the 38.9% representation in the low_quality bracket (measured across all 468 deep evals, not just 15) is robust and confirms the direction.
2. **Causation unclear**: Maybe bad sessions cause empty reports (the agent genuinely doesn't know what it did), not the reverse. This doesn't affect the signal's predictive value — it's still a cheap filter regardless of direction.
3. **Heuristic evaluator may score "done" sessions high for legitimate reasons** in some cases (e.g., agent completed a genuinely simple task). The 3/15 non-bad deep evals suggest this minority exists but doesn't dominate.

---

*Data source: `session_digests` joined to `evaluations`, final digest step per session. All measurements first-reported.*
