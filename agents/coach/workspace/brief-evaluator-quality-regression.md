# Brief — Evaluator Agent Quality "Regression" (24h)

**Date**: 2026-04-17
**Author**: coach (diagnosis-only, 40-op cap)
**Confidence**: medium-high on diagnosis, medium on root cause (one prompt-wrapper hypothesis needs may/tech-lead confirmation)
**Recommendation**: **Flag to may for evaluator-owner review**, focus on prompt-wrapping and scope-normalization in `evaluateStandaloneSession()` path — do NOT retrain the evaluator agent yet.

---

## 1. What the signal actually is

The "24h quality = 0.545, n=19" figure is **real but incomplete context**. Full breakdown of `evaluations` rows where `agent='evaluator'` in the last 24h:

| bucket                        |   n | avg quality |
|-------------------------------|-----|-------------|
| `skipped` (heuristic only)    | 592 | 0.000       |
| `needs_improvement`           |   8 | 0.150       |
| `acceptable`                  |   2 | 0.650       |
| `good`                        |   9 | 0.872       |
| **scored (non-skipped) total**| **19** | **0.545** |
| **all rows (naive avg)**      | 611 | 0.017       |

Compare to other agents same window: all 0.82–0.92 (scored-only), skip rates 0–1.2 %; evaluator skip rate is 96.9 % — by design (`evaluator-heartbeat.ts:38` explicitly excludes `"evaluator"` from LLM calibration via `SKIP_LLM_EVAL_AGENTS`, but `evaluation-sync.ts:131-140` does **not** consistently exclude it — see finding below).

**Weekly-prior baseline for *scored* evaluator sessions**: `n=0` in the 7 days preceding the 24h window. So there is no prior baseline to regress against — **this is the first meaningful sample of LLM-graded evaluator sessions**, not a drop.

Historical scored-evaluator rows exist only on 2026-03-13/14/15 (n=4 total) and yesterday/today (3 + 16). The jump from ~0/day to 16/day coincides with **evaluation-sync.ts** random-30 % LLM sampling landing on evaluator sessions that the evaluator-heartbeat skip-set would have spared. This is the "dual entrypoint" issue tech-lead documented today in `agents/tech-lead/workspace/finding-dual-evaluator-entrypoints.md` — specifically the "Inconsistent skip set" drift risk.

## 2. What the 8 low-quality scored sessions actually say

Read issues text for all 8 `needs_improvement` sessions (q ≤ 0.3). Top patterns:

| pattern | sessions | % of low |
|---|---|---|
| **SCOPE_ERROR / SCOPE_MISMATCH** (evaluator scored wrong session or only one of multiple agents in task tree) | 5 | 63 % |
| **OVER-PENALIZATION / EVIDENCE_MISMATCH** (treated truncated transcript as missing evidence; wrong FM tag; overly harsh) | 2 | 25 % |
| **STRUCTURAL_FORMAT_FAILURE** (duplicated JSON blocks, not clean single output) | 1 | 12 % |

### Pattern A — scope/target mismatch (5/8) — likely **prompt-wrapping bug, not agent behavior**
Examples (from `evaluations.issues`):
- `s_1776433051503_319`: "The prompt asks to evaluate each agent in session **s_1776433380578_329**, but the provided embedded transcript is for a different session: 'Agent: evaluator (session **s_1776433051503_319**)'. Scoring the wrong session is a fundamental task failure."
- `s_1776433088685_321`: same shape — target session **_330** but embedded transcript is **_321** (the evaluator's own current session).
- `s_1776430597854_267` / `s_1776430940101_280`: task header says `Participating Agents: coach` / `evaluator`; meta-evaluator critiques "only evaluated coach, did not score may and evaluator as required." The criticism itself is confused — the task header itself only names one agent.

**This is not an agent behavioral regression.** It is either (a) a prompt constructor in `evaluateStandaloneSession()` / task-tree pipeline that is injecting the wrong transcript for meta-evaluation runs, or (b) a meta-evaluator (the LLM grading the evaluator) being over-strict about what "each agent" means when task tree header lists a single agent. Either way the fix is upstream of the evaluator agent's behavior.

### Pattern B — meta-evaluator over-penalty (2/8)
- `s_1776430353398_262`: meta-eval explicitly says *the evaluator was wrong* and the underlying evaluation was fine (May did produce structural evidence; evaluator wrongly penalized FM-3.3). So the meta-evaluator is catching real evaluator mistakes — good signal, but small n.
- `s_1776426716216_193`: meta-eval cites **truncated transcript** as the basis for thinking evaluator was wrong ("transcript is explicitly truncated in multiple places ... truncated transcript ≠ missing tool call evidence"). Meta-evaluator probably correct here, but the problem is that the evaluator was fed a truncated transcript — again, **upstream prompt-construction issue**.

### Pattern C — format drift (1/8)
- `s_1776427367840_214`: evaluator returned two JSON blocks and repeated optimizer text. Real agent behavior issue, isolated case (1/19 ≈ 5 %).

## 3. Recent changes to `agents/evaluator/` (last 7 days)

`cd agents && git log --since='7 days ago' -- evaluator/`: **no commits**. Nothing in `agents/evaluator/` changed. The relevant system-side commits also all predate the 24h window:
- `src/lib/evaluator.ts`: last touch was `34e27864 Reduce FM-3.3 guard friction...` — well before 24h window.
- `agents/may/handlers/evaluation-sync.ts` / `evaluator-heartbeat.ts`: no recent commits in 7 days.

The only 2026-04-17 change that mentions the evaluator at all is tech-lead's finding doc (14:33Z), which is documentation-only and describes the exact structural driver of this signal: two cron jobs with inconsistent skip sets now sample evaluator sessions for LLM grading where before they were almost never sampled.

## 4. Root-cause hypothesis

**Primary (≈70 % confidence):** This is **not a behavioral regression in the evaluator agent.** It is an **evaluation-coverage artifact + prompt-wrapping issue** that surfaces on meta-evaluation (evaluator-as-subject) runs:

1. `evaluation-sync.ts` random-samples evaluator sessions into LLM grading (skip-set drift, documented in tech-lead finding 2026-04-17);
2. When the subject *is* the evaluator, the task-tree wrapper embeds a transcript whose session-id does not match the target session-id in 4 observed cases — meta-evaluator correctly flags this as SCOPE_MISMATCH and assigns low quality;
3. Historical n was ~0, so the aggregate looks like a cliff even though per-session behavior is largely unchanged.

**Secondary (≈20 %):** Mild evaluator behavioral issues (over-penalization on truncated transcripts, 1 format-drift case) exist but affect 3/19 ≈ 16 % of sessions and do not explain the 0.545 floor alone.

**Ruled out:** recent evaluator agent file changes (none); SOUL.md drift (no edits); widespread behavioral regression (9/19 sessions still score 0.82+, n=3 at 0.9).

## 5. Recommended action

**Flag to may for evaluator-owner review**, with three specific asks:

1. **Inspect `src/lib/evaluator.ts:evaluateStandaloneSession()` + task-tree prompt constructor** for the case where the subject agent is `evaluator`. Specifically: does the embedded transcript always match the `target_session` field, or can they diverge when the subject is itself an evaluator session? The 5 SCOPE_MISMATCH cases are the repro evidence.
2. **Apply tech-lead's "tiny alignment" follow-up** from `agents/tech-lead/workspace/finding-dual-evaluator-entrypoints.md` §4: add `"may"` and keep `"evaluator"` in a shared `SKIP_LLM_EVAL_AGENTS` constant consumed by both `evaluator-heartbeat.ts:38` and `evaluation-sync.ts:131-140`. Either decide to LLM-grade evaluator sessions (and fix the prompt wrapper first) or skip them uniformly.
3. **Revisit the metric owner / threshold** for "evaluator 24h quality". Given historical n≈0, a 24h alert on n=19 with a lot of meta-prompt artifacts is noisy. Suggest minimum-sample threshold or split "scored-only" vs "all rows" in the alert.

**Do NOT** fork/patch the evaluator agent yet — there is no evidence its behavior changed. The 1 format-drift case is insufficient for a behavioral intervention (KE-010: check baseline; baseline here is essentially undefined).

## 6. Confidence & caveats

- **High confidence**: the aggregate is driven by a combination of `verdict=skipped` rows (zero out) and a small n=19 sample; historical baseline for LLM-scored evaluator sessions is ~0; no code changes in `agents/evaluator/`.
- **Medium confidence**: scope-mismatch hypothesis based on meta-evaluator issue text, not on direct inspection of the prompt constructor. Needs 1 hour of may or tech-lead time to confirm in `evaluateStandaloneSession`.
- **Low confidence / not examined**: whether meta-evaluator itself is biased against evaluator transcripts (possible self-referential weirdness when grading your own role).
- **Not run**: any gym scenario, any evaluator file modification — per task constraints.
