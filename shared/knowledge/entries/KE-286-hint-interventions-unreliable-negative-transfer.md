# KE-286: Hint-Based Recognition Interventions Are Unreliable and Can Hurt Performance

**Date**: 2026-04-19
**Source**: EXP-177 (80 runs, 4 arms × 2 scenarios × 10 trials)
**Confidence**: High (N=80, pre-registered, confirmatory design)
**Connects**: KE-199b (low-threshold model — now refuted), H-166-revised (REFUTED), KE-184 (ceiling effect methodology), KE-195 (production-displacement), KE-287 (small-N instability)

## Core Finding

Hint-based recognition interventions — lexical, paraphrase, and placebo — do not reliably improve agent task performance. In the strongest case, a lexical hint **reduced** pass rate from 60% baseline to 10% (S2 sql-injection), a 50pp negative transfer effect. No hint arm significantly outperformed baseline at N=20 (Fisher exact p=0.72 for lexical vs base).

## Evidence

- **EXP-177 pooled results** (N=20/arm): BASE 30%, LEXICAL 20%, PARAPHRASE 30%, PLACEBO 15%. No significant differences.
- **S2 negative transfer**: sql-injection BASE = 60%, LEXICAL = 10%. The lexical hint caused the agent to fixate narrowly on described bugs, missing the broader solution path it finds naturally.
- **S1 replication failure**: The same lexical hint string that produced 10/10 in post-contamination controls dropped to 3/10 — a 70pp collapse (see KE-287).
- **Scenario heterogeneity dominates**: S1 ~5% across all arms, S2 ~35% across all arms. Between-scenario variance dwarfs any hint effect.

## Mechanism / Why

Two candidate mechanisms:
1. **Narrow fixation**: Hints cause the agent to anchor on the described problem framing, preventing exploration of alternative solution paths the agent would otherwise discover. This explains S2's 60% → 10% drop.
2. **Hint content is decorative**: The dominant factor is scenario intrinsic difficulty, not hint content. Hints are noise on top of a strong difficulty signal.

## Implications

### 1. H-166-revised (low-threshold causal pointer model) is REFUTED
The "any causal pointer ≥80%" prediction failed catastrophically (observed 20-30%). The 0% → 100% jump seen in EXP-173/168 clean-env controls was scenario-specific and/or temporally unstable. It does not generalize.

### 2. Hint engineering is a dead end for guard design
Future guard work should NOT invest in crafting recognition hints. The dominant lever is scenario intrinsic difficulty (what makes S2 solvable at 60% base vs S1 at 0%).

### 3. Hints can actively harm performance
Negative transfer is real and large (50pp). Any hint-based intervention must be tested for harm, not just benefit.

## Actionable

- **Stop investing in hint-based guard interventions.** The ROI is zero-to-negative.
- **Redirect guard research** toward understanding intrinsic scenario solvability (why S2=60% vs S1=0%).
- **Any future hint experiments** must include harm-detection: compare hint arm vs baseline, not just hint vs no-hint.

## Open Questions

- Why does S2 (sql-injection) have 60% base solvability while S1 (cascading-fix-trap) has 0%? What structural property drives this?
- Is the negative transfer effect specific to lexical hints, or do all external framings risk narrowing the agent's search?
