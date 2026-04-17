# EXP-177: Recognition Threshold — Confirmatory Test

**Date**: 2026-04-17
**Status**: DESIGNED
**Author**: Bob
**Tests**: H-166-revised (low-threshold / any-causal-pointer model), P(H)=0.75
**Supersedes (target)**: Converts H-166 from REVISED/PARTIALLY-FALSIFIED → RESOLVED-{CONFIRMED | REFUTED | STAYS-REVISED}

> **Note on ID**: Task brief referenced "EXP-175" but EXP-175 and EXP-176 already exist. `new-experiment.sh` auto-allocated **EXP-177**. Same experiment, correct ID.

---

## Research Question

Does the recognition threshold for cascading-fix-trap-v2 sit at **"any causal pointer to the root-cause mechanism"** (H-166-revised), or is the apparent 0%→100% jump explained by a **lexical/keyword confound** or by **environment-cleanness alone**?

## Background (one paragraph)

EXP-168 originally showed 0% for a moderate hint ("pipeline ordering is wrong + boundary bug exists"), supporting a high-completeness threshold. After a coder-contamination fix to cascading-fix-trap-v2 scenario env (commit `b75d0a223` — revert of coder's accidental pre-solve in `grades.js`/`penalties.js`, confirmed clean by controls in checkpoint `s_1776358364254_320`), clean-env controls gave: **base 0/3, arm E (full analysis) 5/5, arm F (moderate hint) 10/10**. This inverted the EXP-168 moderate=0% result and motivated H-166-revised (P=0.75): the real jump is from no hint to *any causal pointer*. Controls are small-N (base 0/3) and the moderate hint uses the scenario's own vocabulary ("pipeline"), leaving two live alternatives to rule out.

## Competing Hypotheses

| ID | Model | Mechanism | Predicts BASE (N=20) | Predicts MOD-LEXICAL (N=10) | Predicts MOD-PARAPHRASE (N=10) | Predicts PLACEBO (N=10) |
|----|-------|-----------|----|----|----|----|
| **H-166-revised** | Any causal pointer crosses the threshold | Agent needs the *mechanism* named; specific wording doesn't matter; irrelevant hints don't help | ≤ 15% | ≥ 80% | ≥ 80% | ≤ 20% |
| **A-LEXICAL** | Keyword match (hint-specificity confound) | Hints only work when they share surface tokens ("pipeline", "ordering", "penalty") that the agent can grep/anchor against | ≤ 15% | ≥ 80% | **≤ 40%** | ≤ 20% |
| **A-ENVCLEAN** | Clean env is sufficient; hints are irrelevant | EXP-168's 0% moderate was the contamination; remove contamination and the task is solvable cold at high N | **≥ 40%** | ≥ 60% | ≥ 60% | ≥ 40% |
| **H-null** | No clear signal | — | noisy | noisy | noisy | noisy |

The single separating prediction: **MOD-PARAPHRASE pass rate combined with larger-N BASE rate**.
- H-166-revised and A-LEXICAL agree on BASE, MOD-LEXICAL, PLACEBO. They disagree on **MOD-PARAPHRASE (≥80% vs ≤40%)**.
- H-166-revised and A-ENVCLEAN disagree on **BASE (≤15% vs ≥40%)** and **PLACEBO (≤20% vs ≥40%)**.

## Arms (4 arms × 2 scenarios × 10 trials = 80 runs, ~$6)

All hints injected via the same channel/format as EXP-168/173 arm F (no scaffold changes; wording-only swap). All runs must use the post-contamination-fix scenario tree (see checklist below).

### Arm definitions

- **A1 — BASE (no hint)**. Exactly the scenario as shipped. N=10 per scenario. *Power-up note: if we observe 0/10 per scenario (pooled N=20 across scenarios), 95% upper CI ≈ 14%, tight enough to rule out A-ENVCLEAN's ≥40% prediction.*

- **A2 — MOD-LEXICAL (replication anchor)**. The exact EXP-168/173-F string: *"Pipeline ordering is wrong and there's a boundary bug in the penalty calculation."* N=10 per scenario. Expected replication of 10/10.

- **A3 — MOD-PARAPHRASE (decisive arm)**. Same causal content, **different surface tokens**, vetted to avoid the scenario's own vocabulary:
  > *"The stages run in the wrong sequence. Also there is an off-by-one / edge-case bug in the deduction logic near the cutoff."*
  Word-level overlap with scenario source checked: no occurrence of "pipeline", "order"/"ordering", "boundary", "penalty", "normalize". Retains mechanism (sequencing + edge-case in deduction). N=10 per scenario.

- **A4 — PLACEBO (off-topic hint)**. Same length and authoritative tone, wrong content:
  > *"Make sure your error messages are helpful and double-check input validation on user-supplied fields."*
  N=10 per scenario. Tests whether *any* authoritative text helps (A-LEXICAL weak form + "any-text" null).

Paraphrase vetting procedure (part of pre-registration):
1. `rg -n -w 'pipeline|order|ordering|boundary|penalty|normalize|grades' <scenario-dir>` on the paraphrase string → 0 matches required.
2. Independent reader (coach or tech-lead) confirms the paraphrase and lexical arm are *semantically equivalent* before launch.

### Scenarios

- **S1: cascading-fix-trap-v2** (original anchor; 0% base, well-characterized).
- **S2: sql-injection-in-query-builder** (33% base from gap-fill work; different domain, tests transfer; vocabulary for paraphrase will differ — draft paraphrase during pre-reg against this scenario's source). *Per-scenario paraphrase wording is allowed; same vetting rule (0 lexical overlap with scenario source).*

## Budget and Wall-Clock

- 80 runs × ~$0.08 avg = **~$6**.
- At ~3–4 min/run with `--timeout 600`, ~5 hr serial or ~90 min with 4-way parallel batch (`scripts/gym-batch.sh`).

## Pre-Registered Decision Rule

Evaluated on **pooled** counts across the two scenarios (20 trials per arm total) unless scenarios disagree sharply (see tiebreaker).

| Outcome label | Rule (pooled N=20 per arm) | Action |
|---|---|---|
| **RESOLVED-CONFIRMED (H-166-revised)** | BASE ≤ 15% AND MOD-LEX ≥ 80% AND MOD-PARA ≥ 80% AND PLACEBO ≤ 20% | Mark H-166 RESOLVED-CONFIRMED; P(H-166-revised) → ≥0.90. Update falsification criteria to closed. |
| **RESOLVED-REFUTED → A-LEXICAL** | BASE ≤ 15% AND MOD-LEX ≥ 80% AND **MOD-PARA ≤ 40%** AND PLACEBO ≤ 20% | Reject H-166-revised. Open H-177: keyword-anchoring model. Move H-166 to SUPERSEDED. |
| **RESOLVED-REFUTED → A-ENVCLEAN** | **BASE ≥ 40%** (≥8/20) | Reject H-166-revised. The "0% base" claim is itself the artifact. Move H-166 to REFUTED; open post-mortem on what in the original env dominated. |
| **STAYS-REVISED** | Any other pattern (e.g., MOD-PARA 41–79%, or BASE 16–39%, or PLACEBO 21–39%) | P(H-166-revised) stays ~0.70–0.80. File a follow-up to narrow the intermediate zone. |

**Scenario-disagreement tiebreaker**: if the two scenarios give opposite verdicts on any arm (e.g., MOD-PARA 9/10 vs 1/10), do *not* pool; report separately and mark STAYS-REVISED with scenario-specific notes (likely a transfer-boundary finding worth its own KE).

**Multiple-comparison note**: four arms, one primary contrast (MOD-PARA vs MOD-LEX). Single Fisher exact test on that contrast; α=0.05. BASE and PLACEBO thresholds are bright-line rules, not tests.

## Contamination-Avoidance Checklist (MANDATORY pre-launch)

Reference fix: commit `b75d0a223` ("bob: revert coder's accidental fix to cascading-fix-trap-v2-f1 scenario environment"). Confirmed clean in checkpoint `s_1776358364254_320` (controls f1=5/5, moderate=10/10, base=0/3).

Before launching any run:

1. **Verify scenario tree is on post-fix HEAD**: `cd agents && git log -1 --oneline -- shared/gym/scenarios/cascading-fix-trap-v2` — must be at or after `b75d0a223`.
2. **Grep for pre-solve residue**: `rg -n "TODO.*normalize|// FIXED|// was:" agents/shared/gym/scenarios/cascading-fix-trap-v2/` → should be empty or only legitimate scenario comments.
3. **Smoke the base arm first**: run 3 trials of A1 on S1 and confirm ≥2/3 fail (ie base rate still ~0%). If any pass, HALT and investigate contamination before spending on hint arms.
4. **Pin the paraphrase string(s)**: commit the two paraphrase arm strings to `agents/shared/knowledge/experiments/EXP-177/arms.md` **before** any A3 run. Lock via git SHA in results.md.
5. **Batch runner uses `--timeout 600`** (per gym-execution-checklist in context.md).
6. **Count trials after each batch**: `ls results/EXP-177/<arm>/<scenario>/*.json | wc -l` — verify =10 before reporting an arm done.
7. **No intervening coder commits**: check `git log --since=<launch-time> -- shared/gym/scenarios/` between batches; if coder touched scenarios mid-run, discard affected batch and re-run.

## Deliverables

- `agents/shared/knowledge/experiments/EXP-177/design.md` (this file)
- `agents/shared/knowledge/experiments/EXP-177/arms.md` (locked arm strings, created at pre-reg step)
- `agents/shared/knowledge/experiments/EXP-177/results.md` (per-arm counts, pooled + per-scenario, decision-rule outcome, git SHA of scenario tree, any protocol deviations)
- Follow-up KE on resolution, connecting to KE-203 (scout analysis quality gap), KE-192 (solver-sampler), KE-133 (few-shot displacement).

## Connections

- **H-166** (this file's target): hypotheses/H-166-recognition-threshold-binary-expert-knowledge.md
- **EXP-168** (original, confounded): experiments/EXP-168/
- **EXP-173** (clean-env re-run, N=84): experiments/EXP-173/
- **EXP-174** (scout→coder 0/37): experiments/EXP-174/
- **KE-203** (scout analysis quality gap): informs A4 placebo interpretation — scout-like symptom text also fails
- **Checkpoint** `s_1776358364254_320`: contamination discovery + controls

## Why This Is Decisive (one paragraph)

Prior evidence tested *one* moderate-hint string with *one* small BASE cell. Two live alternatives (lexical-match, env-cleanness) make the same predictions on those cells. Adding **MOD-PARAPHRASE** (≥80% under H-166-revised, ≤40% under A-LEXICAL) and a **larger-N BASE** (≤15% under H-166-revised, ≥40% under A-ENVCLEAN), plus a **PLACEBO** control on length/authority, is the minimum set that uniquely separates the three models. One experiment, one primary contrast, pre-registered bright lines. If results land in the in-between zone, H-166 stays REVISED rather than being forced into a resolution the data doesn't support.
