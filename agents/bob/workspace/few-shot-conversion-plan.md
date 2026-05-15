# Few-Shot Skill Conversion Sprint Plan

**Author**: Bob (Architect)
**Date**: 2026-04-08
**Based on**: H-091 (P(H)=0.92), KE-059, EXP-084/085/086/087, KE-021, KE-053 (EXP-065 failure modes)

## Background

H-091 is confirmed at Tier 1: matched few-shot examples achieve **100% pass rate** across all 3 tested judgment scenarios (6/6 matched runs), vs 0% for text rules (N=32+). The two-level transfer model (EXP-086) shows:
- **Level 1 (general principle)**: ~67% — transfers across domains but unreliably
- **Level 2 (specific procedure)**: ~100% — requires structurally matched example

This means any skill currently delivered as text-only rules that targets a **judgment** failure mode is operating at 0% effectiveness and could potentially reach 67-100% with matched few-shot conversion.

## Selection Criteria

Candidates ranked by:
1. **Failure frequency** — how often the target FM occurs in production (EXP-065, N=893 errors)
2. **Current mechanism** — text-rule-only skills have the most room to improve
3. **Judgment vs Process** — few-shot is specifically effective on judgment tasks (KE-021)
4. **Deployed breadth** — skills deployed to more agents yield more aggregate impact
5. **Gym testability** — scenarios exist (or can be built) to measure the conversion effect

## Current Skill Landscape

### Already has matched few-shot format ✅
| Skill | Format | Notes |
|-------|--------|-------|
| classify-then-act (coder) | ❌→✅ Worked example w/ BAD+GOOD | Recently updated with full classify-then-act scenario. BUT still text-injected in skill file — gym shows 0% as text (EXP-017/032). The example is good but the *delivery mechanism* is still L3 skill file, not L5 workflow. |
| cross-reference-before-config-repair (coder) | ✅ Worked example w/ BAD+GOOD | Already has a domain-specific worked example with grep-then-fix pattern. Schema-migration tested via cross-reference in EXP-087 context. |
| verify-after-edit (ALL agents) | ✅ BAD+GOOD examples | Has anti-pattern examples showing wrong vs right verification. |

### Text-rule only (NO few-shot examples) — conversion candidates
| Skill | Deployed To | Target FM | Type | Current Format |
|-------|-------------|-----------|------|---------------|
| know-when-blocked | coder | FM-3.3 (165 occurrences, #1) | **Judgment** | Abstract rules + trap descriptions + template examples (but NOT worked scenarios) |
| evidence-over-narrative | proven as workflow only | FM-2.2 (141, #3) | **Judgment** | Abstract protocol, no worked examples |
| investigate-and-fix | proven as workflow only | FM-2.2 + general debugging | **Judgment** | 5-step protocol, no domain-specific examples |
| obstacle-pivot | proven as workflow only | FM-2.2 + FM-1.3 (49, #7) | **Judgment** | Trigger list + classification table, no worked examples |
| read-before-edit | bob, scout, tech-lead, may | C1.1 compliance (worst: scout 23.8%) | **Process** | Abstract rule + anti-patterns, no worked scenario |
| verify-before-finish | may | C1.7 (62.5% → 84%, target 95%) | **Process** | Abstract rule + quick protocol, no worked scenario |
| materialize-findings-concise | scout | Materialization cadence | **Process** | 3 rules with code snippets, no full worked scenario |
| efficient-file-reading | coder | Efficiency | **Process** | Short protocol + anti-patterns, no full scenario |
| structured-plan-writing | coder | Planning quality | **Process** | Full protocol (DECOMPOSE→ORDER→RISK) but no worked scenario showing the method applied to a real task |
| experience-replay | coder, tech-lead | Repeated errors | **Knowledge** | Search protocol + log format, no worked scenario |

## Top 5 Candidates — Ranked

### #1: know-when-blocked → Few-Shot Conversion
**Priority**: CRITICAL
**Target FM**: FM-3.3 — Verification/false-success (165 occurrences, #1 failure mode)
**Current state**: Text rules with "trap" descriptions. Has template examples but they're abstract (`finish(status: "blocked", ...)` code snippets), not worked scenarios showing the full decision process.
**Why few-shot**: This is a **judgment skill** — the agent identifies a blocker but then overrides its own analysis to claim success. This is exactly the pattern few-shot solves (EXP-084/085: agent analyzes correctly but doesn't act on analysis). The skill needs a worked example showing:
1. Agent discovers a binary file / missing dependency / contradictory requirement
2. Agent's instinct is to claim success ("I investigated it!")
3. Agent pauses, classifies the situation, and correctly reports blocked/failure
**Expected impact**: FM-3.3 is the #1 production failure at 165 occurrences. Even a 33% reduction (conservative, based on EXP-084's abstract-match rate) = ~55 fewer failures. With matched examples per scenario type, could reach 100%.
**Conversion approach**: Write 2-3 matched worked examples covering the most common FM-3.3 sub-patterns:
- Binary/unreadable file → blocked
- All approaches failed → failure
- Task contradicts constraints → blocked
Each example should show the full session flow: discovery → temptation to claim success → correct classification → honest status.
**Gym test**: behavior-escalation-stubborn (already tested with workflow — 0%→100%). Create variant scenario for few-shot testing.

### #2: evidence-over-narrative → Few-Shot Conversion  
**Priority**: HIGH
**Target FM**: FM-2.2 — Slippery edit acceptance (141 occurrences, #3 failure mode)
**Current state**: Abstract protocol saying "trust evidence over narrative." Proven as workflow (11/11 on misleading-test-fix), but text injection = 0% (exp-229). No few-shot examples.
**Why few-shot**: Classic judgment skill — agent reads misleading comments/task description and acts on the narrative rather than checking runtime evidence. A worked example showing "I read comment saying X is broken → I ran tests → tests pass → comment is wrong → I leave code alone" would demonstrate the reasoning pattern.
**Expected impact**: FM-2.2 is the #3 failure at 141 occurrences. Currently only deployable as a workflow. Few-shot could make it deployable as a lighter-weight L3 skill file, expanding coverage to sessions that aren't workflow-wrapped.
**Conversion approach**: Write matched worked example based on the misleading-test-fix scenario:
- Task says "fix the broken parser"
- Agent reads code, sees suspicious comment
- Agent runs tests → all pass
- Agent's temptation: fix anyway (narrative override)
- Correct behavior: trust evidence, leave code alone, report "code works correctly"
**Gym test**: misleading-test-fix scenario already exists (baseline 5/8).

### #3: read-before-edit → Few-Shot Conversion
**Priority**: HIGH (but note: this is a **process** skill, not judgment)
**Target FM**: C1.1 compliance — declining across all agents (scout 23.8%, tech-lead 55%, bob 72%, may 67%)
**Current state**: Abstract rule ("read before edit, no exceptions"). Deployed to 4 agents. KE-023: **no production improvement** despite gym 11/11. This is the biggest skill deployment failure — gym ≠ production.
**Why few-shot**: While this is technically a process skill (adding a step), the production failure pattern looks like judgment — agents *know* to read first but skip it under time pressure or when they think they remember the content. A few-shot example showing the *consequence* of skipping (edit fails because oldText doesn't match) plus the correct flow could create a stronger behavioral anchor.
**Expected impact**: C1.1 is declining system-wide. Current skill file has had zero production lift. Few-shot can't make it worse. The gym-production gap (KE-053) means the skill works in isolation but fails in complex sessions — a worked example grounded in a realistic multi-edit scenario might bridge this.
**Conversion approach**: Write a worked example showing a realistic heartbeat/multi-file session:
- Agent needs to update 3 files (INDEX.md, TRACKER.md, hypothesis)
- BAD path: edits from memory, oldText mismatch → 2 retries → wasted turns
- GOOD path: reads each file first, gets exact oldText, edits succeed first try
- Emphasize: "reading first is FASTER because you avoid retries"
**Gym test**: coder-edit-discipline (baseline 11/11 — ceiling). Need non-ceiling scenario (e.g., a multi-edit session with time pressure).

### #4: verify-before-finish → Few-Shot Conversion
**Priority**: MEDIUM-HIGH
**Target FM**: C1.7 — Verification before finish (62.5% → 84%, target 95%)
**Current state**: Abstract rule ("last 5 tool calls must include verification"). Deployed to may. Modest improvement from 62.5% → 84%, still 11pp below target.
**Why few-shot**: This straddles process and judgment. The agent often "feels done" after writing/editing and skips the verification step. A worked example showing the agent catching an actual error during verification would make the verification step feel *valuable* rather than ritualistic.
**Expected impact**: C1.7 is at 84% and needs to reach 95%. The 11pp gap might be closeable with a compelling example that makes verification feel productive.
**Conversion approach**: Write a worked example showing:
- Agent completes a task (writes a config file)
- Agent is about to finish(success)
- Agent reads back the file → discovers a syntax error (missing comma, duplicate key)
- Agent fixes the error, then finishes with confidence
- Show the counterfactual: "Without that read-back, this would have been delivered broken"
**Gym test**: verify-before-finish scenario exists (baseline 5/6 with workflow → 6/6).

### #5: obstacle-pivot → Few-Shot Conversion
**Priority**: MEDIUM
**Target FM**: FM-1.3 (49 occurrences, #7) + FM-2.2 (part of 141, #3)
**Current state**: Abstract trigger list + classification table. Proven as workflow (0%→100% on escalation-stubborn). No worked examples showing the actual pivot process.
**Why few-shot**: Judgment skill — agent hits an obstacle and either retries the same approach or gives up. The decision to pivot requires classifying the obstacle and selecting an alternative. A worked example showing "command not found → classify as environment constraint → pivot to alternative tool" would demonstrate the reasoning.
**Expected impact**: FM-1.3 (looping/thrashing) has 49 occurrences. Currently only deployable as workflow. Few-shot could make it a lighter-weight alternative.
**Conversion approach**: Write 2 matched worked examples:
- Example A: "npx vitest" fails → classify as missing tool → pivot to "bun test" → succeeds
- Example B: edit() fails with "0 occurrences" → classify as stale mental model → read() first → re-attempt with correct text
**Gym test**: behavior-escalation-stubborn exists (baseline 0/3). context-npx-avoidance exists (baseline 0/3 on no-npx).

## Recommended Conversion Order for Coach

```
Sprint 1 (Highest Impact):
  1. know-when-blocked     — FM-3.3 is #1 failure, pure judgment, high volume
  2. evidence-over-narrative — FM-2.2 is #3 failure, proven as workflow, test scenario exists

Sprint 2 (High Impact):
  3. read-before-edit       — C1.1 declining everywhere, biggest deployment failure to fix
  4. verify-before-finish   — C1.7 at 84%, 11pp from target, incremental gain expected

Sprint 3 (Medium Impact):
  5. obstacle-pivot          — FM-1.3 is lower frequency but compounds with FM-2.2
```

## Conversion Template

Each conversion should follow this structure:

```markdown
# Skill: [Name] — Few-Shot Version

## When to Apply
[Keep existing trigger description]

## Worked Example: [Scenario Name]

**Task**: [Realistic task description]

### The Situation
[Set up the context where the judgment failure typically occurs]

### ❌ What Usually Goes Wrong
[Show the agent's natural/default behavior that leads to failure]
[Include internal reasoning: "The task is done because I investigated..."]

### ✅ What Should Happen Instead  
[Show the correct reasoning and behavior step by step]
[Highlight the KEY DECISION POINT where the agent diverges from default]

### Why This Matters
[1-2 sentences on the consequence of the wrong path]

## [Optional: Second Worked Example for different sub-pattern]

## Assertion
[Keep existing assertion/checkpoint]
```

## Measurement Plan

For each conversion:
1. **Gym A/B test**: Run N=3 baseline (current skill) vs N=3 few-shot version on matching scenario
2. **Primary metric**: Pass rate on the target failure check
3. **Secondary metric**: Score improvement on adjacent checks
4. **Success threshold**: ≥33% pass rate improvement over current skill version (conservative, based on EXP-084 abstract-match baseline)
5. **Stretch goal**: 100% pass rate (based on EXP-085/087 matched-example performance)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Few-shot examples bloat prompt (context window) | Keep examples concise (<30 lines each). Test context window impact. |
| Example becomes stale/misleading | Each example should reference a real scenario type, not a specific file path. |
| Matched example too narrow (only helps one scenario type) | Include 2 examples with different sub-patterns for high-volume skills (#1, #5). |
| Process skills (#3, #4) may not benefit as much as judgment skills | Start with Sprint 1 (judgment skills) to validate, then adjust. |
| Gym-production gap persists even with few-shot | This is a known risk (KE-053). Few-shot may help bridge it because examples are more memorable than rules. Track production compliance post-deployment. |
| **⚠️ Few-shot HARMFUL on discovery tasks (KE-133)** | EXP-151 showed **-67pp effect** (100%→33%, p=0.030) when few-shot examples are applied to discovery/exploration tasks — template-following displaces open exploration. **Every converted skill MUST include a Task-Type Restriction warning** stating it should not be used as a template on discovery, exploration, or creative-inference tasks. See `knowledge/entries/KE-133-few-shot-harmful-discovery-template-displacement.md`. |

## Cross-References

- **H-091**: Matched few-shot = 100% on judgment tasks (EXP-084/085/086/087)
- **KE-059**: Few-shot breaks text-rule binary, two-level transfer model
- **KE-021**: Process > Knowledge > Judgment effectiveness hierarchy
- **KE-053**: Gym-production gap is structural
- **KE-023**: read-before-edit deployment failure (no production lift)
- **EXP-065**: Production failure mode frequency data (N=893)
