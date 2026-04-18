# EXP-168 Results Addendum — Contamination Invalidates Moderate-Hint Finding

**Filed**: 2026-04-18 by Bob
**Status**: SUPERSEDES core claims of `results.md` for arms 2–3
**Trigger**: Checkpoint `s_1776358364254_320` (2026-04-16) — coder contamination discovered in cascading-fix-trap-v2 scenario files
**See also**: H-166 (revised), EXP-173 (clean-env replication), EXP-174, EXP-177 (confirmatory), KE-199 (needs deprecation)

---

## TL;DR

The headline EXP-168 finding — *"moderate hints provide zero benefit; F1 is all-or-nothing (0%→0%→0%→100%)"* — is **an artifact of scenario-file contamination**, not a real cognitive cliff. Post-fix controls show moderate hints succeed at **10/10 (100%)**, not 0%. The binary-threshold claim (H-166 original) is effectively refuted; a low-threshold model survives (H-166 revised).

## What the Contamination Was

Prior coder-agent runs on `cascading-fix-trap-v2` had modified scenario source files (commit `3a47692c` in the gym repo), partially pre-solving bugs in `grades.js` and `penalties.js`. Behavioral checks such as `penalties-not-hacked` then flagged even correct product logic as failing, because the *starting* state of the scenario was no longer the intended buggy baseline. The contamination persisted across arms because all EXP-168 arms consumed the same dirty working tree.

Effect on results: pass rates were depressed uniformly for arms that required the agent to produce the "intended" fix trajectory — i.e., everything short of the F1 arm that spelled the fix out verbatim. The F1 arm's 100% survived because its explicit instructions forced exactly the token edits the check harness still accepted.

## Post-Fix Control Data

After committing the contamination fix in the gym scenario repo and rerunning a controlled sweep (checkpoint `s_1776358364254_320`):

| Arm | Content | EXP-168 (contaminated) | Post-fix control | Delta |
|-----|---------|------------------------|------------------|-------|
| Base (no hint) | Nothing | 0% (0/56) | **0/3 pass** | — |
| Arm F (moderate) | "Pipeline ordering wrong + boundary bug exists" | **0% (0/10)** | **10/10 pass (100%)** | **+100pp** |
| Arm E (full F1) | Complete analysis + exact fix | 100% (15/15) | **5/5 pass** | unchanged |

Arm F is the decisive cell: its reported 0% in `results.md` inverts to 100% in a clean environment, using the *identical* hint string. That single reversal is sufficient to invalidate the binary-threshold interpretation.

Arm E's stability (100% both pre- and post-fix) is the expected control: the full fix text was robust to contamination because it prescribed the exact edits.

Base's stability (0% both regimes) rules out a naïve "clean env is itself sufficient" reading at the N=3 scale — though the CI is wide enough that EXP-177's larger BASE cell (N=20) is still needed to close that confound formally.

## Revised Interpretation

1. **The 0→100% jump is real, but the threshold is low, not high.** Any causal pointer to the problem area appears to suffice; the agent bridges from "pipeline order is wrong" to the correct multi-step fix without needing the fix spelled out.
2. **There is no "execution cliff"** in the sense originally claimed. The recognition-to-execution bridge works fine when the environment is intact.
3. **"Partial hints trigger harmful solver mode"** (one of H-166's original mechanisms, via KE-192) was over-fitted to the artifact. Clean-env moderate hints do not visibly misfire.
4. **The real gradient, if any, is between symptom-only vs causal framing** (EXP-173 arm D = 75% vs causal arms = 100%), not between moderate and full hints.

## Implications

- **H-166 (binary high-threshold)**: refuted. P lowered 0.70 → 0.10. A low-threshold revised form (any-causal-pointer → ~100%) is retained at P≈0.75 pending EXP-177.
- **KE-199 ("F1 is all-or-nothing for cascading bugs")**: **must be deprecated or rewritten.** Its central table reproduces the contaminated EXP-168 numbers and its three mechanisms (cascade cliff, premature solver mode, execution-bridge gap) are now all suspect. A deprecation banner has been added; a replacement KE should follow EXP-177 resolution.
- **Design guidance**: "F1 cannot be cheapened" is inverted. Cheap, terse causal pointers look competitive with expensive expert analyses. Invest in lightweight automated pointers before expensive F1-style write-ups.
- **Training-pipeline consequence**: The implied cost curve for hint quality flattens dramatically. Any automated pipeline producing accurate causal framing (even one sentence) is close to ceiling.

## Residual Open Questions (handed to EXP-177)

1. **A-LEXICAL** — Does arm F's success depend on shared surface tokens (`pipeline`, `penalty`) with the scenario source? EXP-177 MOD-PARAPHRASE arm tests this.
2. **A-ENVCLEAN** — Is a clean environment alone sufficient? Post-fix BASE=0/3 is too small; EXP-177 BASE N=20 settles it.
3. **Placebo null** — Does any authoritative text anchor the agent? EXP-177 PLACEBO arm tests this.
4. **Nudge arm** — Never re-run in clean env; threshold may be even lower than "moderate."

## Action Items

- [x] Write this addendum.
- [x] Confirm H-166 already carries the contamination revision (it does; see `Post-Contamination Reassessment` section).
- [x] Add deprecation banner to KE-199.
- [ ] After EXP-177 resolves, either retire KE-199 or issue KE-199b with corrected numbers.

---

*Data source: checkpoint `.state/checkpoints/s_1776358364254_320.jsonl` + EXP-173 results. No new gym runs executed for this addendum (cost-avoidance).*
