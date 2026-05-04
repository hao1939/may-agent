# EXP-900: Pre-Finish Externalization Gate

**Date**: 2025-07-04
**Status**: DESIGNED — ready for Phase 0
**Owner**: coach
**Parent**: EXP-RECOGNITION (structural gates >> behavioral skills), KE-465 (anti-shallow), EXP-267 (verification_evidence)

**Hypothesis**: Requiring agents to write a `COMPLETION.md` file summarizing their work BEFORE calling finish() will increase finish() quality (summary specificity, deliverable completeness, verification evidence) by ≥30pp compared to the current text-only nudge.

## Background

Agents frequently produce low-quality finish() calls: vague summaries ("task completed"), missing deliverables, and weak verification evidence. EXP-267 showed that text nudges partially improve verification_evidence (0 violations vs 4/4 in control), but summaries and deliverables remain inconsistent.

EXP-RECOGNITION proved that structural gates (forcing externalization before action) achieve 100% compliance vs 0% for text skills. The mechanism: writing forces the agent to articulate what it actually did, which makes gaps obvious before the final output.

**Key prior findings:**
- EXP-RECOGNITION: Hard gates 100% vs text skills 0% for recognition tasks
- KE-180: Analysis gates can HARM if agent feels "done" after writing — must be a *completion* gate, not analysis
- KE-465: Anti-shallow rule works because it sets minimum effort floors
- EXP-267: Text nudge for verification_evidence partially effective (FM-3.3 rate 0% vs 25% baseline)
- KE-480: Text coaching has limits — complex behaviors need structural enforcement

## Design

### Arms

| Arm | Scenario | Treatment | N |
|-----|----------|-----------|---|
| A: Control | multi-file-refactor | Standard task (anti-shallow rule only) | 5 |
| B: Text nudge | multi-file-refactor | finish() quality instructions in context | 5 |
| C: Gate | multi-file-refactor | Must write COMPLETION.md before finish() | 5 |

**Total trials**: 15

### Treatment Details

**Arm A (Control)**: Standard task.md with anti-shallow rule. No finish() guidance beyond default.

**Arm B (Text Nudge)**: Add to injected_context.md:
```
When calling finish(), ensure:
- Summary is specific (mention files changed, tests passed)
- List all deliverables with descriptions
- Include verification_evidence citing specific tool outputs
```

**Arm C (Structural Gate)**: Add to task.md as a hard requirement:
```
⛔ COMPLETION GATE (MANDATORY — task fails without this):
Before calling finish(), you MUST write a file called COMPLETION.md containing:
1. FILES_CHANGED: list every file you created or modified
2. WHAT_I_DID: 2-3 sentences describing the specific changes (not "completed task")
3. VERIFICATION: for each file changed, what tool call confirmed it's correct
4. REMAINING: anything you couldn't complete and why

Then call finish() with summary/deliverables/verification_evidence that matches COMPLETION.md.
Your COMPLETION.md is graded — vague entries ("made changes") score 0.
```

### Primary Metrics

1. **Finish quality score** (0-4 rubric):
   - 0: No summary or completely vague
   - 1: Summary exists but generic ("task done")
   - 2: Summary mentions specifics but missing deliverables or evidence
   - 3: Good summary + deliverables but weak evidence
   - 4: Specific summary + complete deliverables + concrete verification evidence
2. **Deliverable completeness**: % of actual changed files listed in finish() deliverables
3. **Task completion**: Does the refactoring actually work? (guard metric)

### Scenario Details

**`multi-file-refactor`**: Agent must refactor a function across 3+ files, run tests, and report. Clear success criteria, multiple files to track, natural verification points.

If this scenario doesn't exist yet, create a simple variant:
- 3 TypeScript files with a shared utility function
- Task: extract utility to its own module, update imports, verify tests pass
- Success = tests pass + all imports updated + finish() quality measured

### Power Analysis

With N=5/arm, we can detect:
- Large effects (0% vs 60%+) at p<0.05 (Fisher exact)
- This is a signal experiment — if direction is clear, scale to N=12

## Execution Plan

1. Verify/create `multi-file-refactor` scenario with success_criteria.js
2. Run Arm A: 5 baseline trials, score finish() quality
3. Run Arm B: 5 text-nudge trials
4. Run Arm C: 5 gate trials
5. Score all 15 trials on the 0-4 rubric
6. Analyze: Fisher exact on binary (score ≥3 vs <3), Welch's t on continuous
7. Write results.md

## Pre-registered Decision Rules

- If C - A ≥ 30pp on "score ≥3" rate AND p<0.10 → **PROMOTE** gate to all agents
- If C - A < 15pp OR C = B (no structural advantage) → **REJECT**, confirms text-is-enough
- If B > A by ≥20pp → update: EXP-267's nudge may be sufficient, no gate needed
- Guard rail: If C reduces task completion by >20pp → REJECT (KE-180 harm pattern)

## Risk & Mitigations

- **Risk**: KE-180 — agent writes COMPLETION.md and feels "done," skips actual fix
  - **Mitigation**: Gate is at END of task (post-work), not beginning. COMPLETION.md is about reporting, not planning.
- **Risk**: Anti-shallow rule already forces 10+ tool calls, masking the effect
  - **Mitigation**: We're measuring finish() quality specifically, not effort
- **Risk**: 5 trials too few
  - **Mitigation**: Signal experiment. If Cohen's d > 0.8, scale up.

## Theoretical Contribution

This experiment tests whether the "forced externalization" mechanism (proven for judgment in EXP-RECOGNITION) generalizes to **self-reporting quality**. If yes:
- Deploy COMPLETION.md gate to all agents
- This creates an auditable trail (COMPLETION.md) beyond just finish() metadata
- May enable automated quality scoring of session outputs

If no:
- Confirms finish() quality is a model capability ceiling, not addressable by prompting
- Redirect effort to post-hoc automated quality checks instead
