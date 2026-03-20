---
name: growth-cycle
description: Standard workflow for evolving agents (Fork-Train-Verify-Promote).
version: 2.0.0
tools: [agent-growth]
---

# Skill: Agent Growth Cycle

**Status**: Verified (2026-03-14)
**Owner**: Coach

The Growth Cycle is the standard mechanism for safely evolving agents.
It replaces "editing live agents" with a rigorous **Fork → Train → Gym Test → Promote** workflow.

## The Principle
**P51 The Growth Cycle**: Evolution requires isolation. Never practice on production.
1. **Fork**: Create a safe lab copy.
2. **Train**: Apply changes (prompts, knowledge, skills).
3. **Gym Test**: Prove it works with automated scoring.
4. **Promote**: Apply to production.

## The Workflow

### 1. Identify the Need
- **Trigger**: A recurring failure pattern, a missing skill, or a directive to improve an agent.
- **Output**: A clear hypothesis. "If I add X to Coder, it will stop doing Y."

### 2. Fork (`fork_agent`)
Create an isolated clone.
```bash
fork_agent('coder', 'coder-v2')
# Creates agents/.lab/coder-v2/
```
- The fork inherits the parent's config, so it has all current context.
- ⚠️ **NEVER change the `name` field in agent.json.** The Ghost Bug (exp-001 through exp-008) proved that renaming the agent in the fork causes invariant regressions unrelated to your edit. Keep the original name.

### 3. Train (Edit the Fork)
Modify the fork — one method at a time.
- Edit: `agents/.lab/coder-v2/SOUL.md`, `knowledge/`, `heartbeat.md`, etc.
- **One change per experiment.** Multiple changes make results uninterpretable.
- Consult `knowledge/method-catalog.md` for the right method.

### 4. Gym Test (`test/gym/gym-runner.ts`)
Run the forked agent against gym scenarios with automated scoring.
```bash
# Test the fork
bash test/gym/run-gym.sh <scenario> --agent coder --lab coder-v2 --timeout 3

# Baseline comparison (no --lab)
bash test/gym/run-gym.sh <scenario> --agent coder --timeout 3

# Run all smoke-tier scenarios
bash test/gym/run-gym.sh --run-all --tier smoke --agent coder
```

Output is JSON: `{ passed, checks[], summary }`.

- **The scorer decides**, not you. If the scorer says fail, the fix didn't work.
- **Always run baseline** for comparison if you don't have one yet.
- **Do NOT use git stash, git checkout, or git branch.** The `--lab` flag handles isolation by copying production agents/ and overlaying the fork.

### 5. Decide & Record
- **Pass**: Promote the fork. Log to `workspace/experiments.jsonl`.
- **Fail**: Iterate on step 3 or discard. Log the failure too.

### 6. Promote (`promote_agent`) or Discard (`discard_agent`)
```bash
# If verified:
promote_agent('coder-v2', 'coder')
# Overwrites config/knowledge. Does NOT overwrite agent.json or workspace.

# If failed:
discard_agent('coder-v2')
```
Always clean up. Don't leave dead forks.

## Example: Fixing "Shotgun Debugging"
1. **Observe**: Coder guesses at fixes without reading errors.
2. **Fork**: `fork_agent('coder', 'coder-strict')`.
3. **Train**: Add "Debug Protocol" to `coder-strict/SOUL.md`.
4. **Gym Test**: `bash test/gym/run-gym.sh phantom-fix --agent coder --lab coder-strict`.
5. **Compare**: Baseline fails, patched passes → promote.
6. **Promote**: `promote_agent('coder-strict', 'coder')`.

## Constraints
- **Never edit live agents** for behavioral changes. Fork first.
- **Gym verification is mandatory.** No promotion without a passing gym run.
- **One method per experiment.** For interpretable results.
- **Clean up.** Always promote or discard.
- **Check shared LESSONS before writing agent LESSONS.** Before adding a convention (C26, C40, C24, C23, C25, C22, etc.) to an agent's LESSONS.md, check `agents/shared/LESSONS.md` first. If the convention already exists there, don't duplicate it — shared LESSONS apply to all agents automatically.

## Lessons Learned (2026-03-17)

1. **Baseline-passing scenarios are useless for behavioral fixes.** If the
   baseline agent already passes a gym scenario, you can't measure whether
   your fix helped. Before running experiments, verify that the scenario
   actually triggers the target failure pattern. If all scenarios pass
   baseline, you need harder scenarios first.

2. **Gym infrastructure must be verified before running experiments.** Check
   that the agent is registered in the test env, worktrees set up correctly,
   and the gym runner produces valid output. Wasting experiments on infra
   failures is costly.

3. **NEVER change agent.json name in lab forks (Ghost Bug).** ALL Sprint 1
   and Sprint 2 regressions were caused by changing the `name` field in
   agent.json (e.g., `optimizer` → `optimizer-micro-edit`), NOT by text edits.
   The name change causes runtime behavior changes (session routing, state
   loading, identity resolution). When creating forks, keep the original name.
   This was the single most important methodology discovery — it invalidated
   8 experiments' regression conclusions.

4. **Text-based coaching methods are SAFE but INEFFECTIVE for judgment
   behaviors.** Post-Ghost-Bug, 13 clean experiments across 7 methods
   (SOUL Guard, Heartbeat Step, LESSONS Entry, Knowledge File, Negative
   Example, Conditional Guard, Micro-Edit, Subtractive Fix, Identity
   Exception, Inline SOUL Content) show ZERO regressions but also ZERO
   improvements on judgment scenarios (ambiguous-spec, sycophants-dilemma,
   skip-verification). Text coaching is a closed path for judgment.
   **Use Workflow Enforcement (#15) instead** — 16/16 (100%) across
   3 scenarios. See method-catalog.md for details.

5. **Test on BOTH target AND non-target scenarios.** Sprint 1's key failure
   was that methods improved the target scenario but regressed others. Always
   test the full scenario suite, not just the target.

6. **Advisory language over coercive language.** SOUL guards with "MUST
   do X within N steps" forced the agent to rush. Use advisory language
   ("prefer X", "consider Y") instead of mandates. (Note: this lesson
   was from a confounded experiment — re-verify with correct methodology.)

7. **Interrupted gym runs produce unreliable data.** Completed re-runs
   of the same experiment showed different results from interrupted ones.
   Always run experiments to completion. Discard interrupted session data.

8. **System prompt directives are ignored when task-anchoring is strong.**
   Code review of `resolveSystemPrompt()` confirms INDEX.md IS loaded into
   the system prompt for ALL sessions including oneshot. The combo fork's
   INDEX.md contained "READ THIS before finishing any bug-fix task" pointing
   to `verification-deep-scan.md`. The agent SAW this in its system prompt
   but chose not to read the referenced file. This is task-anchoring: the
   explicit task ("fix these 2 bugs") overrides system prompt directives.
   Prior claim that "agents don't consult INDEX.md" was WRONG — the content
   was visible, just ignored. Implication: the bottleneck is not delivery
   mechanism but the agent's prioritization of task over coaching.

9. **Task framing anchors behavior more than coaching text.** When a gym
   scenario says "fix exactly 2 bugs," agents stop after 2 fixes regardless
   of heartbeat reminders, negative examples, or knowledge files about
   looking deeper. The task prompt overwhelms coaching prompts. To test
   verification behavior, use open-ended scenarios ("fix all bugs") rather
   than bounded ones ("fix exactly N bugs").

10. **0/10 clean experiments = strong null result.** After eliminating the
    Ghost Bug confound, 10 clean experiments across 7 methods (SOUL Guard,
    Heartbeat Step, Knowledge File, Negative Example, Conditional Guard,
    Subtractive Fix, Micro-Edit) show ZERO behavioral improvements on
    judgment scenarios. Text-based coaching is confirmed SAFE but the
    improvement signal is consistently zero. The combination approach (#6+#2)
    was invalidated by the discovery that INDEX.md content was already
    visible in the system prompt. **Next phase**: (a) inline content directly
    into LESSONS.md/SOUL.md (no file reference hop), (b) design scenarios
    without count-anchoring ("fix all bugs" not "fix exactly N"), (c)
    structural/workflow enforcement if text remains ineffective.

11. **Workflow enforcement (#15) is the breakthrough method.** 20/20 (100%)
    across 4 scenarios. This is the ONLY method that reliably changes
    judgment behavior. But it requires architect/infra coordination to
    deploy operationally — the gym uses `agents.call()` to split phases,
    which needs workflow orchestration in production. Production deployment
    is the current highest priority.

12. **Growth cycles for cross-cutting patterns: classify root cause first.**
    When a cron trigger says "agent X has N errors of type Y," always read
    the actual error sessions before starting a growth cycle. Multiple
    FM codes may share a single root cause (e.g., coder FM-5.3: 1/3 was
    self-edit refusal, 2/3 were MISAPPLIED_REFUSAL = same as FM-2.1).
    Addressing the root cause is more efficient than treating each FM code
    separately.

13. **Text coaching has 0% success rate across ALL contexts now.** Updated
    from "0/13 judgment" to "0/18 total" (adding 0/5 procedural via Bob
    FM-2.6 exp-053). C39 (optimizer empty-args) remains the sole exception —
    likely because it was a tool-calling pattern, not a judgment/behavioral
    pattern. For ANY behavioral fix, skip text methods and go directly to
    workflow enforcement or infrastructure guards.

14. **Ceiling-effect gate: run baseline BEFORE forking.** Experiments
    exp-061 through exp-064 all hit ceiling effect — all agents passed all
    scenarios at baseline, making the experiments unmeasurable. Each wasted
    growth cycle burns ~4 LLM sessions (~1MB tokens). The gate is now
    mandatory in both growth-cycle.ts and training-sprint.ts: run baseline
    first, and if all scenarios pass, SKIP the experiment. When ceiling
    effect is detected on all scenarios, the priority shifts to scenario
    development (creating harder scenarios that expose real gaps).

15. **Workspace size is a health signal (StateLM / Active Memory Law).**
    Agents with growing journals (>500 lines) and unbounded workspace files
    suffer context rot — their injected context becomes noisier each session,
    degrading judgment. Weekly consolidation cron jobs (journal → knowledge
    → archive) are deployed for all agents. When diagnosing an agent's
    declining performance, check `wc -l agents/{agent}/workspace/journal.md`
    as a potential contributing factor. High signal density (small workspace,
    distilled knowledge) > raw volume. Source: arXiv:2602.12108 (StateLM),
    Bob brief `agents/bob/workspace/sent/brief-gus-statelm.md`.

16. **Growth-cycle scenario targeting is broken.** The growth-cycle workflow's
    test step runs a default set of 3 scenarios regardless of the diagnosed
    target scenario. Experiments exp-099 and exp-100 were both wasted because
    the coder C2.1 plan-before-acting fix was never tested on the actual
    target scenario (convention-verify-multi-edit). **Workaround**: Until
    fixed, run target scenarios manually (bypass growth-cycle for the testing
    phase). Escalated to May for fix.

17. **Scenario difficulty varies by agent — baseline ALL available agents.**
    The cascading-error scenario (exp-061) challenged coder (2/5) but was
    trivially easy for amy (5/5). Future scenario design should baseline all
    available agents to find which ones the scenario actually challenges.
    Don't assume a scenario that fails one agent will fail others.

18. **Judgment scenarios > technical scenarios for training signal.** All
    technical scenarios (bloated-refactor, hidden-dependency, red-herring-log,
    verify-checksum-trap, drudgery-multi-file, infinite-gardener) hit ceiling
    for all available agents. Only JUDGMENT scenarios (when NOT to act, when
    to push back, ambiguity recognition, restraint) produce real training
    signal. The premature-optimization scenario (exp-065) confirmed all agents
    compulsively optimize even when nothing needs it — a useful differentiator
    but not catastrophic. Design more scenarios testing restraint/pushback.

19. **Method #9 (Negative Example) is harmful for judgment scenarios.**
    Exp-092: May went from REFUSAL (4/6) to SYCOPHANCY (3/6) — the
    anti-refusal narrative overcorrected and caused file deletion. Negative
    examples may backfire by providing an alternative behavior template that
    the model follows. Method CLOSED.

20. **Method #10 (Conditional Guard) shows reasoning but not behavioral
    influence.** Identity-aligned conditional guards influenced internal
    reasoning (~30%) but produced 0% behavioral change in 2 completed
    experiments. This is the first text method to show ANY measurable
    reasoning signal. Not closed — worth preserving for combination
    experiments with workflow enforcement.

21. **Scorer bugs produce false negatives — verify scorers early.**
    Exp-104 scorer bugfix was the most valuable Sprint 5 output — revealed
    false negatives in 7 scenario scorers. When a scenario seems
    unreasonably hard (all agents fail), check the scorer first before
    assuming agents are broken.

22. **Cross-model generalization confirmed for Method #15.** Bob
    (gemini3pro) passes workflow enforcement on sycophants-dilemma (exp-073:
    7/7 EXCELLENT) alongside amy (opus) and coder. This is the first
    evidence that workflow enforcement works across model families, not
    just the opus family.
