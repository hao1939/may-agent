# DD-874: pAI/MSc — Multi-Agent Academic Research Workflow

**Paper:** arXiv:2604.20622 (Abdelmoneum, Beneventano & Poggio, MIT, 2026)
**Relevance:** ★★★★ — Directly mirrors our scout→bob research pipeline; validates artifact-contract pattern

## Core Idea

pAI/MSc is an open-source multi-agent system that converts a human-specified hypothesis into a literature-grounded, mathematically-established, experimentally-supported manuscript draft. Goal: reduce human steering from ~10³ prompts to ≤10 interventions.

## Architecture

- **23 specialized agents** in a fixed workflow spanning: literature review → theory → experimentation → synthesis → editorial
- **Artifact contract**: progress represented by named intermediate outputs with stage-level validation gates (not free-form dialogue)
- **Repair routes**: when artifacts are incomplete, inconsistent, not novel, or not adequately established
- **Optional rigor components**: theorem-oriented reasoning, multi-model debate counsel, tree-search exploration

## Key Engineering Lessons (from paper §2)

1. **Planning as debate > monologue** — ideation quality improved when multi-agent debate replaced single-agent planning
2. **Artifact contracts enforce quality** — named intermediate outputs with validation gates prevent drift
3. **Academic research lacks scalar objectives** — unlike coding (test pass/fail), research quality can't be auto-scored; requires adversarial critique + human judgment
4. **Fixed workflow with repair loops** — structured decomposition with fallback paths when stages fail

## Connections to Our System

| pAI/MSc Pattern | Our System Equivalent | Gap/Insight |
|---|---|---|
| 23 specialized agents | scout, bob, coach, optimizer, etc. | We have similar specialization |
| Artifact contract | Knowledge entries, deep-dives | We use similar named artifacts but lack formal validation gates between stages |
| Debate-based planning | Bob's hypothesis review | We could strengthen with explicit adversarial debate |
| Repair routes | Manual re-runs | **GAP**: We lack automatic repair when a stage produces inadequate output |
| Human-on-the-loop (≤10 steers) | Hao's periodic interventions | Similar ratio — validates our approach |
| Tree-search exploration | Not present | **GAP**: We don't explore alternative hypotheses in parallel |

## Critical Insight

The paper's core finding — that **academic research requires artifact contracts, not just dialogue** — validates our knowledge system architecture. But their explicit validation gates between stages (checking completeness, consistency, novelty, adequacy) are more rigorous than ours. We rely on agent judgment; they enforce structural checks.

The "compression ratio" framing (10⁶ tokens → 10³ tokens of human steering) is exactly the problem our system solves for Hao. This is external validation of the scout→bob→experiment pipeline.

## Actionable for Us

1. **Validation gates**: Add explicit quality checks between scout→bob handoffs (is the deep-dive complete? does it connect to existing hypotheses?)
2. **Repair routes**: When bob finds a hypothesis weak, route back to scout for more evidence automatically
3. **Debate counsel**: Multi-model or multi-agent critique before committing to experiment designs

## Rating Justification

★★★★ because it validates our architecture from a prestigious group (MIT/Poggio lab) and identifies concrete gaps (validation gates, repair routes) we could implement.
