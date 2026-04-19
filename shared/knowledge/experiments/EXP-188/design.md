# EXP-188: Recognition Intervention Dose-Response on sql-injection-in-query-builder

**Date**: 2026-04-19
**Status**: DESIGNED
**Predecessors**: EXP-177 (hints unreliable/harmful), EXP-166 (content-first 100%, F2 100%, baseline 67%)
**Hypotheses**: H-166 (refuted by EXP-177), new H-175 (negative transfer from narrow hints)

---

## Research Question

What is the minimum effective recognition intervention for sql-injection-in-query-builder, and why do narrow bug hints HURT performance while structured analysis (both expert and self-generated) reliably helps?

## Background

Two experiments give contradictory-seeming results on sql-injection-in-query-builder:

- **EXP-166** (N=15/arm): Baseline 67%, all three intervention arms (F1-expert, F2-self-analysis, F1→F2) = 100%. Any structured analysis suffices.
- **EXP-177** (N=10/arm): BASE 60%, LEXICAL 10%, PARAPHRASE 40%, PLACEBO 30%. Bug-description hints *hurt* dramatically — lexical hint dropped pass rate by 50pp.

The puzzle: *full expert analysis* (EXP-166 Arm C, which mentions both null-handling AND SQL injection with fix guidance) helps, but a *narrow hint* about specific bugs (EXP-177 lexical: "Pipeline ordering is wrong and there's a boundary bug") hurts. Note: EXP-177's hints were designed for cascading-fix-trap-v2 and applied to sql-injection as a transfer test — the hint content was about the WRONG scenario's bugs.

**Resolution hypothesis**: The EXP-177 hints hurt because they described bugs from a *different scenario* (cascading-fix-trap-v2), causing the agent to search for non-existent pipeline/ordering bugs instead of the actual null-handling + SQL injection issues. This is not "narrow hints hurt" — it's "wrong hints hurt." The negative transfer is content-mismatch, not format-driven.

## Hypotheses

- **H-188a (content-match)**: Scenario-relevant hints (describing the actual sql-injection bugs) will improve pass rate to ≥80%, while scenario-irrelevant hints (describing wrong bugs) will degrade pass rate below baseline. The key variable is content accuracy, not hint format.
- **H-188b (prompt-as-anchor)**: Any hint — relevant or irrelevant — anchors the agent's search, reducing exploratory breadth. Relevant hints anchor productively; irrelevant hints anchor destructively. Predicts: even vague-but-relevant hints help, even specific-but-irrelevant hints hurt.
- **H-188-null**: Hint effects are dominated by stochastic noise at this sample size; the 60-67% baseline is the true rate regardless of hint content.

## Design

### Arms (5 arms × 15 trials = 75 runs)

| Arm | Intervention | Content | N | Rationale |
|-----|-------------|---------|---|-----------|
| A | Baseline (no hint) | — | 15 | Establish current base rate (expect ~60-67%) |
| B | Relevant-specific | "The search functions have a SQL injection vulnerability — they use string interpolation with user input instead of parameterized queries. Also handle null returns from queries." | 15 | On-target hint matching actual bugs |
| C | Relevant-vague | "There's a security vulnerability in how user input is handled in the search functions. Also check error handling for edge cases." | 15 | On-target but vague — tests whether specificity matters |
| D | Irrelevant-specific | "Pipeline ordering is wrong and there's a boundary bug in the penalty calculation." | 15 | EXP-177 lexical hint (wrong scenario) — replicates negative transfer |
| E | Irrelevant-vague | "There might be performance issues with the data processing pipeline. Check the batch ordering logic." | 15 | Wrong-domain, vague — tests irrelevant anchoring without specific false leads |

### Hint Injection Method

Same channel as EXP-177: inject as a "colleague's note" prepended to the task context. Format identical across arms — only content varies.

### Scenario

`sql-injection-in-query-builder` (and 4 new variants: `-exp188-b`, `-exp188-c`, `-exp188-d`, `-exp188-e`)

### Success Criteria

Same as base scenario `success_criteria.js`: all 4 checks must pass (tests-pass, null-handling-fixed, sql-injection-addressed, tests-not-weakened).

### Metrics

- **Primary**: Overall pass rate per arm
- **Secondary**: sql-injection-addressed check rate per arm (did the agent notice the vulnerability?)

## Decision Rules

| Pattern | Verdict | Action |
|---------|---------|--------|
| B ≥ 80% AND D ≤ 40% AND (B - D) significant at p<0.05 | **H-188a CONFIRMED**: Content match is the key variable | Write KE on content-match principle; update H-166 notes |
| B ≥ 80% AND C ≥ 70% AND D ≤ 40% AND E ≤ 50% | **H-188b CONFIRMED**: Anchoring model — relevance determines direction | Write KE on anchoring model |
| All arms within ±15pp of baseline | **H-188-null**: Hints don't reliably affect this task | Mark stochastic; sql-injection base rate is stable ~60-67% |
| B ≤ 60% (no improvement from relevant hints) | **Content-match insufficient**: Even correct hints don't help — only structured analysis (EXP-166 style) works | Implies the EXP-166 benefit is from the PROCESS of structured analysis, not the CONTENT |

### Power Analysis

Baseline: ~63% (pooling EXP-166 A=67%, EXP-177 A=60%). To detect a 30pp difference (63% vs 93% or 63% vs 33%):
- N=15: Fisher's exact for 14/15 vs 9/15 → p = 0.04. Adequate.
- N=15: Fisher's exact for 5/15 vs 9/15 → p = 0.14. Marginal for small effects.
- Decision: N=15 per arm is adequate for the large effects we expect (EXP-177 showed 50pp negative transfer). If effects are <20pp, N=15 won't detect them, but such small effects are not practically important.

## Budget

- 75 runs × ~$0.05/run (sql-injection is a simple scenario) = **~$3.75**
- Wall time: ~4 hrs serial, ~1 hr with batching

## Execution Plan

1. Create 4 scenario variants with hint injection
2. Smoke test: 1 run each of B, C, D, E — verify hint appears in agent context
3. Run Arm A first (15 runs) — confirm baseline ~60-67%
4. Run Arms B-E in randomized batches
5. Count and verify all 75 runs complete
6. Analyze per decision rules

```bash
# Example execution
scripts/gym-run.sh sql-injection-in-query-builder --agent coder --tag EXP-188-A --timeout 600
scripts/gym-run.sh sql-injection-in-query-builder-exp188-b --agent coder --tag EXP-188-B --timeout 600
```

## Contamination Checklist

1. Verify base scenario unchanged: `cd agents && git log -1 --oneline -- gym/scenarios/sql-injection-in-query-builder/`
2. Confirm all variants share identical `environment/`, `success_criteria.js`, `package.json` — only `task.md` and `scenario.json` differ
3. No hint content appears in environment files
4. Batch runner uses `--timeout 600`

## Connections

| Entry | Relationship |
|---|---|
| **EXP-177** | Predecessor — showed hints unreliable/harmful on this scenario |
| **EXP-166** | Predecessor — showed expert analysis + self-analysis both hit 100% |
| **H-166** | Recognition threshold — refuted by EXP-177; EXP-188 explores WHY |
| **KE-133** | Few-shot displacement — related anchoring/displacement mechanism |
| **KE-123** | Intervention stacking — single intervention principle |

## Why This Matters

EXP-177's most striking finding was that hints *hurt* on sql-injection (60% → 10%). But EXP-166 showed expert analysis *helps* (67% → 100%). This apparent contradiction needs resolution. If H-188a is confirmed, the lesson is practical: recognition interventions must describe the RIGHT bugs. If wrong, we learn something deeper about how agents process auxiliary information. Either way, this disambiguates the hint-vs-analysis puzzle that currently blocks guard design recommendations.

## Tags
`EXP-188` `recognition` `sql-injection` `negative-transfer` `anchoring` `content-match` `hints`
