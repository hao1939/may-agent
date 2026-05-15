---
name: skill-lifecycle
description: Use when discovering, evaluating, testing, refining, deploying, or retiring shared skills through Coach's evidence-based skill lifecycle.
---

# Skill: Skill Lifecycle Management

**Status**: Active
**Owner**: Optimizer
**Version**: 2.1.0

## What this is

A skill for discovering, evaluating, testing, and refining the shared skill
library (`agents/shared/skills/`). The goal: make skills the primary lever
for improving agent behavior — cheaper and more durable than coaching
lessons, more interpretable than model fine-tuning.

## Why skills matter

Skills are **abstracted knowledge** — they sit between raw experience (which
degrades systems per Scout's CR#84) and model weights (which we can't
change). A good skill eliminates the "figure out how" phase for an agent
and goes straight to execution. A bad skill adds noise to the context
window without improving behavior.

Your job: find out which skills are good, make them better, kill the bad
ones, and create new ones where gaps exist.

## The Skill Lifecycle

```
  Discover → Draft → Test → Grade → Deploy → Measure → Refine → Retire
     ↑                                 |         ↑
     └─────────────────────────────────┘         |
                                          A/B Compare
                                        (major versions)
```

### 1. Discover (find the need)

Sources of skill opportunities:
- **Evaluation failures**: FM codes that recur across agents suggest missing
  or weak skills. Run `refine-skill.md` evidence scan.
- **Session transcripts**: Agents solving the same multi-step problem
  repeatedly = pattern waiting to be captured.
- **Coach's experiments**: `agents/coach/workspace/experiments.jsonl` —
  methods that failed via coaching might succeed as skills.
- **Research**: Scout's cross-references (CR#87 Skill Formation, CR#84
  Self-Improvement Paradox) provide theoretical grounding.

**Signal to act**: Same failure mode appears 3+ times across 2+ agents,
and no existing skill covers it.

### 2. Draft (create the skill)

Create `agents/shared/skills/<name>/SKILL.md` with:
- **Purpose**: What problem this skill solves (cite FM codes and sessions)
- **Protocol**: Step-by-step instructions the agent follows
- **Anti-patterns**: What NOT to do (from failure evidence)
- **Verification**: How the agent confirms it followed the skill correctly

Keep it short. A skill that's 500+ lines won't be read. Target 50-150 lines.
Use imperative voice. No theory — just "do X, then Y, verify Z."

**Include assertions** for grader verification (see step 3.5):
```markdown
## Assertions (for grader verification)
- Agent reads the relevant file before editing it
- Agent verifies the edit by reading back the changed file
- Agent does not attempt actions outside its stated scope
```

Assertions serve two purposes: (1) during gym testing, the evaluator can
check these specific conditions against the transcript, and (2) during
production, evaluations of sessions where this skill was in context can
verify protocol adherence. Write 3-7 assertions per skill. Each should be
a plain-text statement that can be verified by reading the session transcript.
Bad assertions check outputs only ("file was created"); good assertions check
process ("agent verified file content after creating it").

#### Skill Writing Guide

When writing skill instructions, follow these principles:

- **Explain the why.** Don't just say "do X" — explain *why* X matters.
  LLMs are smart; when they understand the reasoning, they generalize
  better to novel situations. If you find yourself writing ALWAYS or
  NEVER in all caps, reframe: explain the reasoning so the model
  understands the importance rather than blindly following a rule.
  - Bad: "ALWAYS verify after editing"
  - Good: "Verify after editing because tool output confirmations can
    be misleading — the only reliable way to confirm a change is to
    read the file back."

- **Generalize from examples.** Skills will be used across many different
  tasks. Don't overfit to specific failure cases — extract the *principle*
  behind the failure and teach that.

- **Keep it lean.** If a section isn't pulling its weight (agents ignore
  it, or it adds tokens without changing behavior), cut it. Read
  transcripts of agents using the skill — if they waste time on
  unproductive steps the skill prescribes, remove those steps.

- **Look for repeated reinvention.** If multiple agents independently
  solve the same sub-problem when using a skill, that sub-problem
  should become part of the skill's protocol.

### 3. Test (gym-based verification)

Before deploying a new or updated skill, test it:

```bash
# 1. Find a gym scenario that targets the skill's FM code
bash test/gym/run-gym.sh --list

# 2. Run baseline (without the skill)
bash test/gym/run-gym.sh <scenario> --agent <agent> --timeout 3

# 3. Fork the agent, add the skill reference to knowledge/INDEX.md
#    (Coach can do this via fork_agent)

# 4. Run the fork
bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork> --timeout 3

# 5. Compare: did the skill improve the score without regressing others?
```

See `agents/shared/skills/agent-gym/SKILL.md` for full gym runner docs.

**If no gym scenario exists for the target FM code**: either create one
(preferred) or use transcript-based verification (weaker signal).

**Multi-run for deploy decisions**: LLM outputs are stochastic — a skill
can pass once by luck and fail the next run. For deployment decisions
(making a skill available to production agents), run the gym scenario 3
times. Require ≥2/3 passes for deploy, 3/3 for critical skills (those
targeting high-frequency FM codes or deployed to high-traffic agents).
Single-shot runs are fine during iterative refinement, but the final
"ship it" decision needs multi-run confidence.

Track results in the skill journal:
```
## Skill: <name>
- Gym results: 3/3 passes (consistent) or 2/3 (flaky — investigate)
- Variance notes: <which assertion was inconsistent and why>
```

### 3.5. Grade (independent evaluation)

After gym testing, have an independent grader evaluate the result. This
prevents self-serving bias — the agent that benefits from the skill
shouldn't be the one judging whether it worked.

**Mechanism**: Use `agents.call("evaluator", ...)` to grade gym transcripts:

```javascript
// After gym-run produces a transcript:
const grade = await agents.call("evaluator", `
  Grade this gym run transcript. The skill being tested is "${skillName}".
  
  Check:
  1. Did the agent actually follow the skill's protocol?
  2. Did following the skill improve the outcome vs. not following it?
  3. Would the skill's assertions pass for a WRONG output? (If yes, assertions are too weak.)
  
  Transcript: ${transcriptPath}
  Skill: agents/shared/skills/${skillName}/SKILL.md
`);
```

**What the grader checks**:
- **Skill adherence**: Did the agent read and follow the skill, or ignore it?
- **Outcome quality**: Did the skill actually help, or was the agent already
  going to succeed without it?
- **Assertion robustness**: Would the assertions pass for an incorrect output?
  If so, the assertions need tightening — they're testing presence, not
  correctness.

**Why this matters**: Without independent grading, skills accumulate that
"feel right" but don't measurably change behavior. The grader is the
quality gate between "tested" and "deployed."

### 4. Deploy (make it available)

#### Multi-Run Requirement

Before deploying, run the gym test **3 times** (not once). A single pass
can be lucky — LLM behavior is non-deterministic. Use the aggregate to
decide:

| Result | Verdict | Action |
|--------|---------|--------|
| 3/3 pass | **Confident Deploy** | Deploy the skill |
| 2/3 pass | **Monitor** | Deploy but re-test after 1 week |
| 0-1/3 pass | **Refine** | Do NOT deploy — iterate on the skill |

```bash
# Run 3 times, collect results
for i in 1 2 3; do
  bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork> --timeout 3 \
    | tee /tmp/gym-result-$i.json
done
# Count passes
grep -c '"passed": true' /tmp/gym-result-*.json
```

**Cost**: ~$0.50/run, so 3 runs = ~$1.50. This is acceptable for
deployment confidence — a bad skill deployed to all agents costs far
more in wasted tokens and degraded behavior.

#### Discoverability

Skills are deployed by existence — agents discover them by browsing
`agents/shared/skills/`. To make a skill more discoverable:
- Add it to the relevant agent's `knowledge/INDEX.md` under "Key Skills"
- Reference it from the agent's SOUL.md or heartbeat.md where appropriate
- Don't auto-inject the full skill into the system prompt (too expensive)

### 5. Measure (track effectiveness)

After deploying a skill, monitor whether it actually helps:

**Usage tracking** (manual scan):
```bash
# Did any agent read the skill in recent sessions?
grep -r "skills/<name>" .state/sessions/history/*/transcript.jsonl \
  | tail -20
```

**Impact tracking**:
- Compare FM code frequency before/after skill deployment
- Check evaluations: did the targeted failure mode decrease?
- If no change after 2 weeks → the skill isn't being read or isn't effective

**What to track in `workspace/journal.md`**:
```
## Skill: <name>
- Deployed: <date>
- Target FM: <code>
- Pre-deployment rate: N occurrences in 100 evals
- Post-deployment rate: M occurrences in 100 evals (measured <date>)
- Agents reading it: <list or "none observed">
- Verdict: effective / ineffective / unmeasured
```

### 6. Refine (iterate on content)

When a skill exists but isn't working:

**Diagnose why**:
- **Not read**: Agents don't know about it → improve discoverability (step 4)
- **Read but ignored**: Instructions too vague or too long → sharpen
- **Read and followed but didn't help**: Wrong approach → redesign
- **Read and caused regression**: Over-constraining → loosen or condition

**Review transcripts before changing anything**: Read 2-3 transcripts of
agents that had this skill in context. Look for:
- Steps the agent consistently skipped (the skill prescribes them but
  agents ignore them — either the step is unclear or unnecessary)
- Steps where the agent spent multiple turns without progress (the skill
  is sending agents into a dead end)
- Steps the agent improvised that the skill doesn't cover (agents are
  solving a sub-problem the skill should pre-solve)
- Wordy sections agents don't reference (adding tokens without value)

This prevents "edit by intuition" — let the data show what's broken
before you change it.

**Make ONE change per refinement cycle** (atomic, measurable):
- Add an anti-pattern (with evidence)
- Clarify a step (with example)
- Remove noise (lines that add tokens but no value)
- Add a conditional ("only when X, do Y")

**Organize refinement cycles** in a workspace directory:
```
agents/optimizer/workspace/skill-refine/<skill-name>/
  iteration-1/
    findings.md      # FM analysis, eval data, transcript observations
    changes.md       # What was changed and why
    gym-results/     # Pass/fail from gym runs
  iteration-2/
    ...
```
This makes cycles auditable and prevents re-discovering the same issues.

**Test the refinement via gym before deploying** (same as step 3).

### 7. Blind A/B Comparison (major versions only)

When making a significant revision to a skill (not a small tweak), use
blind A/B comparison to scientifically determine whether the new version
is better. This prevents confirmation bias — you designed the new version,
so you *want* it to be better.

**When to use**: Major rewrites, fundamental approach changes, or when
measurement data (step 5) is ambiguous. Not needed for small fixes.

**Protocol**:

1. **Run both versions on the same scenario**:
   ```bash
   # Old skill (production)
   bash test/gym/run-gym.sh <scenario> --agent <agent> --timeout 3 \
     | tee /tmp/ab-old.json

   # New skill (fork with updated skill)
   bash test/gym/run-gym.sh <scenario> --agent <agent> --lab <fork> --timeout 3 \
     | tee /tmp/ab-new.json
   ```

2. **Anonymize the transcripts** — label them "Agent A" and "Agent B"
   without revealing which is old vs. new.

3. **Send to evaluator for blind judgment**:
   ```javascript
   const verdict = await agents.call("evaluator", `
     Compare these two agent transcripts on the same task.
     Which agent performed better and why?
     
     Agent A transcript: ${pathA}
     Agent B transcript: ${pathB}
     Task description: ${taskDesc}
     
     Judge on: correctness, efficiency, verification quality,
     and adherence to best practices. Pick a winner or declare a tie.
   `);
   ```

4. **Reveal and decide**: If the new version wins, promote. If tie or
   loss, refine further or keep the old version.

**Why blind**: If the evaluator knows which is "new," it may
subconsciously favor novelty. Anonymization forces judgment on merit.

### 8. Retire (remove dead skills)

Kill a skill when:
- The failure mode it targets no longer occurs (structurally fixed)
- It's been deployed 2+ weeks and no agent has read it
- Gym testing shows it causes regressions without benefits
- The approach has been superseded by a better skill

Move retired skills to `agents/shared/skills/_retired/` with a note
explaining why. Don't delete — they're evidence of what was tried.

## Skill Quality Checklist

Before deploying or refining, verify:

- [ ] **Concise**: Under 200 lines. Agents won't read novels.
- [ ] **Evidence-based**: Cites specific sessions or FM codes that motivated it
- [ ] **Actionable**: Contains step-by-step protocol, not just principles
- [ ] **Anti-patterns included**: Shows what NOT to do (from real failures)
- [ ] **Testable**: Can be verified via gym scenario or transcript analysis
- [ ] **No overlap**: Doesn't duplicate another skill's coverage
- [ ] **Conditional when needed**: Applies to specific situations, not all tasks

## Integration with Coach

Coach and Optimizer both improve agents but through different mechanisms:

| Mechanism | Owner | How it works |
|---|---|---|
| Growth cycle (fork→train→gym→promote) | Coach | Changes agent config files |
| Skill lifecycle (discover→test→deploy→measure) | Optimizer | Changes shared skill library |
| Work maturity ladder | Optimizer | Graduates work between stages |

**Collaboration points**:
- Coach's failed experiments may reveal skill opportunities (method didn't
  work as agent config → might work as shared skill)
- Optimizer's skill measurements feed Coach's method catalog (which skills
  have evidence of effectiveness)
- Both use gym for verification

## Current Skill Inventory

Run `ls agents/shared/skills/` for the full list. Key skills to know:

| Skill | Target | Status |
|---|---|---|
| `agent-gym/` | Testing & verification | Active, v1.0 |
| `error-handling/` | FM-2.6 anti-patterns | Active, v1.2 |
| `file-safety/` | FM-2.3 edit fragility | Active, v1.2 |
| `growth-cycle/` | Fork-train-verify-promote | Active, v2.0 |
| `verification/` | FM-3.3 verification gaps | Active, v1.1 |
| `consolidate-memory.md` | Memory management | Active |
| `critical-pause.md` | Stopping before mistakes | Active |
| `experiment-before-apply.md` | Test before deploying | Active |

Scan evaluations to identify which skills are underperforming or missing.
