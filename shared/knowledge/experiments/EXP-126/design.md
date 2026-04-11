# EXP-126: Environmental Hints Replication — Larger N Study

**Status**: COMPLETE — See [results.md](./results.md)
**Date**: 2026-04-10
**Author**: Coach
**Type**: A/B Replication Study (Gym Scenario)
**Replicated from**: EXP-122

## Background & Motivation

EXP-122 claimed environmental hints (HTML comment in INDEX.md) achieved 100% (6/6) pass rate vs 67% (4/6) baseline. However, **investigation revealed the "100%" result was from a corrupted environment** where success criteria answers were pre-baked into the starting state (all 8 checks passed with zero agent work). 

The actual valid EXP-122 first run (commit `ed69c40ef`) got **4/6 (67%)** — identical to the EXP-117 baseline. This was a **null result**, not the "strong positive" that was reported.

### What Happened
1. Original EXP-122 run: 4/6 pass (67%) — committed as "null result" 
2. Environment was then modified (5 additional rows in INDEX.md, other files updated with answers)
3. Second run against corrupted environment: 6/6 (100%) — trivially
4. Results.md was rewritten to report 100% as the real result

### Why Replicate
- The null result was from only n=6 — insufficient to distinguish 67% treatment from 67% baseline
- Environmental hints remain a theoretically promising mechanism (zero cost, just-in-time cues)
- We need clean data at larger N to determine the true effect size

## Design

### Research Question
Does an HTML comment hint in INDEX.md improve the pass rate on the KB discovery task compared to no hint?

### Hypothesis
H₀: Environmental hint pass rate = baseline pass rate
H₁: Environmental hint pass rate > baseline pass rate

### Conditions

**Baseline** (scenario: `kb-discovery-baseline-126`)
- Original EXP-122 environment restored from commit `ed69c40ef`
- No HTML comment hint in INDEX.md
- Timeout: 3 min
- Agent: bob

**Treatment** (scenario: `kb-discovery-hints-126`)
- Identical environment + HTML comment hint in INDEX.md:
  `<!-- When experiments validate new findings, add a new KE entry here with the next available ID -->`
- Timeout: 3 min
- Agent: bob

### Sample Size
- 12 trials per condition (24 total)
- Pooling with valid EXP-117/EXP-122 first-run data is NOT done because those used different environment versions

### Statistical Analysis
- Primary: Fisher's exact test (two-sided)
- Effect size: Cohen's h
- Significance threshold: p < 0.05

### Controls
- Same environment (restored from single commit)
- Same agent, same timeout
- Only difference: one HTML comment line in INDEX.md
- Trials randomized/interleaved (6 baseline, 6 treatment, 6 baseline, 6 treatment)

## Artifacts
- Baseline scenario: `agents/gym/scenarios/kb-discovery-baseline-126/`
- Treatment scenario: `agents/gym/scenarios/kb-discovery-hints-126/`
- Environment source: commit `ed69c40ef` (original EXP-122)
