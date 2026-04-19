# Proposed Strategies (P63) — 2026-03-30

## Sample (source artifacts, last seen)
This heartbeat did **not** read `.state/sessions/history/*/session.jsonl` logs (per Evaluator efficiency rule). Instead, it sampled recent **evaluation artifacts** and periodic-monitor outputs:
- `.state/evaluations/eval_s_1774343027581_9.json`
- `.state/evaluations/eval_s_1774348459409_47_optimizer.json`
- `.state/evaluations/eval_coach_s_1774341266928_4.json`
- `.state/evaluations/s_1774341233458_2.json`
- `.state/evaluations/s_1774341250216_3.json`
- `.state/evaluations/s_1773975280258_129.json`
- `node agents/evaluator/skills/monitor-session.cjs --running` (all healthy)
- `node agents/evaluator/skills/patrol.cjs` (status OK)

## Strategy candidates

### 1) ENV reality check before any path-dependent command
**Trigger pattern:** Attempts to use `/home/*` or `/Users/*` in bash.
- Evidence: eval `eval_s_1774343027581_9.json` flags repeated `cd /home/user` failures.
- Evidence: eval `eval_s_1774348459409_47_optimizer.json` flags `/Users/jk/aijudge`.

**Correction:**
- Always run `pwd` and `ls` (or `ls -la`) once at session start; treat any absolute path not rooted at `/app` as suspect.
- If unsure, prefer `find` from `/app` over guessing.

### 2) “Finish status must match verification capability” gate
**Trigger pattern:** Agent acknowledges it cannot verify (diff/tests/artifact) but still calls `finish(status="success")`.
- Evidence: eval `s_1774341233458_2.json` (coder) — “Marked success despite acknowledging inability to verify”.

**Correction:**
- If you cannot produce a binary signal (exit code 0, grep match, test pass output, file readback), finish should be `partial` or `blocked`.

### 3) Replace narrative checklists with structural evidence
**Trigger pattern:** “✅ done” / “looks correct” claims without accompanying tool evidence in transcript excerpts.
- Evidence: eval `eval_s_1774348459409_47_optimizer.json` flags verification gaps + self-validation.
- Evidence: eval `s_1773975280258_129.json` flags “fixed all 7 scorers” without a run/syntax check.

**Correction:**
- Prefer `grep -n "pattern" file`, `node -c` (where applicable), `eslint`/typecheck, or running the minimal reproduction command.
- When summarizing, cite the command and its output string.

### 4) Instruction-coverage guard (deliverable-first)
**Trigger pattern:** Produces *a* plausible artifact, but not the **specified** one (workspace filename mismatch), or drifts to a different goal.
- Evidence: eval `eval_s_1774348459409_47_optimizer.json` — Phase 1 required `workspace/skill-discovery.md` but different outputs were produced.
- Evidence: eval `eval_coach_s_1774341266928_4.json` + `s_1773975280258_129.json` — scope drift away from required report.

**Correction:**
- At start, write down the required output paths verbatim and treat them as a checklist.
- If concluding “no change needed”, still produce the required file stating that conclusion.

### 5) Maintenance risk: detect-p53-drift entrypoint missing
**Trigger pattern:** Periodic tasks reference `node agents/evaluator/skills/detect-p53-drift.cjs` but only `agents/evaluator/skills/detect-p53-drift/SKILL.md` exists.
- Evidence: `ls agents/evaluator/skills/detect-p53-drift` shows only `SKILL.md`.

**Correction:**
- Either (a) restore/implement `detect-p53-drift.cjs` or (b) update periodic-tasks.md to point to the correct entrypoint (if renamed) and add a “known missing” guard.

## Counts
- Artifacts sampled: **6 evaluation JSONs** + **2 monitor outputs**
- Strategies proposed: **5**
