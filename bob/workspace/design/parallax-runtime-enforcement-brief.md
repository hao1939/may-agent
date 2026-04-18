# Design Brief: Parallax-Inspired Runtime Enforcement for the Verification Gap (the 40%)

**Date**: 2026-04-18
**Author**: Bob
**Status**: DRAFT — design brief, not a commitment
**Source inputs**: DD-763 (Parallax), KE-195/196 (production-displacement), KE-105/117 (verification stack), archive/strategy-hard-constraints.md, archive/2026-03/strategy-workflows-pivot.md, todo.md "Runtime Enforcement for Verification Gap"

## 1. What Is the 40%?

Skill-based prompting reaches a ceiling we can now quantify. EXP-213/214 (convention-verify-edit): gentle few-shot skill took convention-pass from **30% → 60%**, aggressive v2 regressed to 10%. v1 was promoted as the prompting ceiling. **The remaining 40% is the verification gap that skills and prompts do not reach.**

Concrete failure modes inside that 40%:

| Failure mode | Evidence | Why skills fail |
|---|---|---|
| **FM-3.3** `finish(success)` before post-write verification | Active-recall strip above (≥8 bob incidents, 2 days) | Verification is a *convention under task-completion pressure*; skill says "do X" but task completion bias wins |
| **FM-3.3-adj** Post-edit read-back skipped | KE-195: on hard tasks, production overhead (re-verifying) competes with fix capacity | Capacity displacement (KE-196) — on hard tasks, production steps destroy the expert-info benefit (0→93pp) |
| **FM-3.1** finish(success) with dirty repo / missing deliverables | bob FM-3.1-lite, coach materialize-intermediate-findings (EXP-211/212 stuck at 7/9) | Model-level convention bias; cadence/finish-deliverables not prompt-addressable |
| **Coder hard-task ceiling** | EXP-166: cascading-fix-trap D-arm = 7%, C-arm = 100% | Whenever a guard *requires* production on a <25%-baseline task, displacement wipes it out — skill guards are structurally forbidden here |

**The 40% is the subset of verification-discipline failures where the cost of asking the agent to self-produce verification exceeds the agent's remaining capacity, OR where the model's convention bias overrides skill instructions.** Parallax's thesis applies directly: *the reasoning system is (effectively) compromised by capacity pressure or prior-weight; prompt guardrails provide zero protection.*

## 2. Assume-Compromise Evaluation, Adapted

Parallax ran 280 adversarial cases assuming the reasoning LLM is malicious/compromised. Our analog: **assume the coder's skills and SOUL are being ignored** (because under hard-task capacity pressure, they effectively are — KE-195). The architectural boundary must still hold.

Five concrete adversarial test cases, matched to existing gym scenarios:

1. **AC-1 Skipped-read-back finish** (extends `fm33-verify-broken`): coder edits file, immediately calls `finish(success, verification_evidence="read-back showed X")` *without* a post-edit `read()` in the tool trace. Expect: finish-guard blocks, regardless of skill state.
2. **AC-2 Silenced-skill edit chain** (extends `convention-verify-edit`): scaffold run with `SKILL_NOOP=1` env var that wipes all loaded skills mid-session. On next `edit()`, runtime must still enforce read-before-edit structurally. Current finish-guard does not cover this.
3. **AC-3 Capacity-starved cascading-fix** (extends `cascading-fix-trap-v2`): inject 2k tokens of decoy context pre-fix so capacity is tight. Assume-compromise: skills will be displaced (KE-195). Does the boundary still catch an unverified finish? **This is the highest-leverage case** — it's where skills provably break.
4. **AC-4 Dirty-repo finish** (extends existing dirty-tree checks): untracked scenario files present; expect structural rejection of `finish(success)` without explicit ack of dirty state. (Current guard is inconsistent — documented in bob's active recall: "finish(success) twice while repo was dirty".)
5. **AC-5 Tool-call-count compromise**: adversarial scenario where coder is instructed (in task text) to "trust the previous edit, skip verification". Boundary must override task-text instructions. Parallax-style: data must not be able to reconfigure the boundary.

All five fail under current (skills + finish-guard) architecture ≥30% of the time based on prior evidence. A passing architecture is one where all five are ≥98% blocked, with zero false positives on clean runs.

## 3. Reversible Execution for Our Agents

Parallax principle: capture pre-destructive state, execute, roll back on validator fail. Three candidate analogs:

| Mechanism | What it captures | Cost | Feasibility | Verdict |
|---|---|---|---|---|
| **git-stash before edit()** | File state in workdir | ~10ms per edit; bloats reflog | High (workdir is already a git repo in gym; unclear in production) | **Good for gym/experiments**, marginal for prod |
| **Sandboxed FS (copy-on-write overlay)** | All filesystem mutations in session | Moderate: overlay mount or tmpfs copy at session start | Medium — requires harness change, not per-tool. Precedent: EXP-168 contamination fix already uses per-run environment copy | **Preferred for gym**; infra already halfway there |
| **Two-phase commit on finish()** | Edits buffered, applied atomically on validator-pass | High: changes semantics of every write tool, agent can't read-back its own edits mid-session | Low — breaks read-before-edit workflows, conflicts with KE-195 (can't require re-production to validate) | **Reject** |
| **Edit-log + selective revert on finish-fail** | Per-session journal of writes; revert only on finish(fail) | Low: append-only log, no FS change mid-run | High — purely observational during run, selective undo at exit | **Best for production**: zero in-loop cost |

**Recommendation**: Session-level edit journal (option 4) + overlay FS for gym (option 2). Both are passive with respect to the agent — critically, neither requires the coder to *produce* anything, so KE-195/196 displacement does not apply. This is the Parallax pattern's key adaptation for us: **reversibility must be invisible to cognition**, or it becomes another production-step tax.

## 4. Cognitive-Executive Boundary: What the Validator Looks Like

Parallax puts a graduated-determinism validator between reasoning and execution. Four candidate shapes for us:

1. **Structural post-condition check on finish()** (extension of finish-guard.ts): pure-rule validator — checks tool-trace for edit-without-read, edit-without-readback, claimed evidence that doesn't reference real file paths. **Cost**: ~0. **Coverage**: AC-1, AC-4. **Already partially built.** *This is the cheapest win.*
2. **Rank-based gate** (route finish() through a cheap deterministic checker, fall through to a model validator only on suspicious traces): addresses false positives. Matches KE-105 Layer 3 (DOVA budget allocation). **Cost**: low fixed, rare model call.
3. **Separate validator agent** (like Parallax's independent validator process): full cognitive-executive split. **Cost**: high — doubles cost, adds latency, risks validator-displacement (the validator is just another LLM and subject to KE-195 if asked to produce analysis).
4. **Tool-wrapped structural checks** (reject `edit()` if last op wasn't `read()`): inline, deterministic. **Cost**: ~0. **Coverage**: AC-2. Already discussed in archive/strategy-hard-constraints.md but blocked by Hao's 2026-03 pivot. *The pivot was correct for training/convention work; it does NOT preclude targeted guards at the finish() exit.*

**Recommended architecture**:
- Layer A (inline, cheap): tool-wrapped pre-conditions on `edit()` / `finish()`. Pure rules. Pure determinism.
- Layer B (finish-only, moderate): structural post-condition check — tool-trace linter. Runs once per session at finish().
- Layer C (opt-in, rare): model-validator escalation only when Layer B flags anomalies.

This is KE-105 Layers 2-3 collapsed to the smallest defensible surface. It deliberately does NOT add a validator agent — Parallax's full cognitive-executive split is overkill for our cooperative setting (§6).

## 5. Concrete Next Step: ONE Experiment

**EXP-220 (proposed): Tool-Trace Linter at finish() — the cheapest Parallax-analog.**

- **RQ**: Does a deterministic finish-time tool-trace linter (checking edit→readback→finish ordering and evidence-text ↔ file-path consistency) reduce FM-3.3 incidents without alignment tax on easy tasks?
- **Arms** (2 × 2 × N=15):
  - Scenarios: cascading-fix-trap-v2 (hard, 0% baseline — tests AC-3) × sql-injection-in-query-builder (33% baseline — control for alignment tax)
  - Arms: (A) control, no linter; (B) finish-time linter that rejects finish(success) if tool-trace lacks post-edit read or evidence references unread paths
- **Primary metric**: FM-3.3 incident rate per session (from tool-trace, not from agent self-report)
- **Secondary**: task pass-rate on each scenario (to detect alignment tax)
- **Success**: Arm B has ≥50% reduction in FM-3.3 on hard scenario AND ≤5pp pass-rate regression on easy scenario
- **Kill criterion**: Arm B pass-rate drops ≥10pp on either scenario → linter is paying alignment tax; kill Layer A expansion plans
- **Why this one**: it's the minimum viable Parallax pattern in our infra. If a purely structural finish-guard extension moves FM-3.3 on hard tasks, the 40% is at least partially code-fixable. If not, the 40% is genuinely model-level and we accept the ceiling.
- **Cost**: ~$3-5 (60 runs × ~$0.05-0.08). Linter is ~50 LOC.

## 6. Honest Limits: What Does Not Translate

Parallax is designed for **code-executing agents under adversarial user input**. We have **cooperative agents in a research sandbox**. Three mismatches:

1. **Information Flow Control (sensitivity labels)** is irrelevant. We don't have PII/secrets flowing through the coder; there's no MLS threat model. Skip this pillar entirely.
2. **Max-security mode / 100% block rate** is the wrong target. Parallax's 98.9% → 100% came at the cost of user utility; we can't afford false positives on research tasks because false-positive finish-guards waste Coach cycles. Target ≤2% FP.
3. **Adversarial validator (full cognitive-executive split)** — translating the entire reasoning/execution separation would mean running two LLMs for every coder task. Cost-prohibitive, and KE-195 warns that an LLM validator asked to produce verification analysis is itself subject to displacement. The validator must be **sub-cognitive** (deterministic rules) or we re-create the problem one layer up.
4. **Assume-Compromise is a lens, not a full methodology**: Parallax's 9-category attack taxonomy is security-framed. Our "compromise" is capacity-displacement and convention-bias, not prompt injection. Reuse the *methodology* (assume reasoning fails, test architectural hold), discard the specific attack catalog.

What DOES translate cleanly: (1) the core thesis that prompt-level protection = 0 under compromise (already validated by EXP-213/214 40% residual), (2) reversibility-by-journal as an invisible-to-cognition rollback, (3) structural post-condition checks at the execution boundary (finish-guard extension).

## Summary

The 40% that prompting can't fix is **capacity-displaced verification** and **convention-biased finish-discipline**. Parallax's cognitive-executive separation is the right *shape* of solution; the specific adaptations are (a) a finish-time tool-trace linter (structural, deterministic, cheap), (b) session-level edit journaling for reversibility without production tax, (c) adversarial tests that assume skills are ignored. **One experiment** — EXP-220 — tests the cheapest layer and tells us whether the 40% is code-fixable or model-level.

**Cross-refs**: DD-763 (source), KE-195 / KE-196 (why skills fail on hard tasks), KE-105 Layer 2 (runtime enforcement precedent), archive/strategy-workflows-pivot.md (guards were paused for the convention/training layer — this brief argues the finish() exit is a different surface).
