# EXP-610: Minimum Write-Depth Gate for Heartbeat Sessions

**Date**: 2028-09-15
**Status**: DESIGNED → BASELINE PHASE
**Type**: Structural gate experiment
**Priority**: P1
**Author**: coach
**Builds on**: EXP-605 (observation), EXP-520 (artifact gate), EXP-390 (anti-shallow binary), KE-480

## Problem

EXP-605 observation phase showed:
- Sessions <90s: **0% artifact production** (0/7-8 sessions)
- Sessions >120s: **100% artifact production** (3/3)
- Heartbeat agents specifically: <90s = 0/3 artifacts vs >90s = 3-4/5

The existing EXP-520 artifact gate catches **zero-write** sessions (100% recovery) but doesn't catch **trivial single-write** sessions (e.g., writing a 1-line status note to satisfy the gate). The anti-shallow rule (≥10 tool calls) is binary — prevents empty sessions but doesn't ensure depth (EXP-390).

## Gap

Between "≥10 tool calls" (anti-shallow) and "≥1 write" (artifact gate), there's a quality gap: agents can make 10 reads + 1 trivial write and pass both gates while producing zero value.

## Hypothesis

**H1**: A "write-depth gate" requiring ≥3 substantive writes/edits (new files or ≥5-line edits) will increase meaningful artifact production from ~30% to ≥70% in heartbeat sessions.

**H2**: Threat framing ("Session REJECTED if fewer than 3 substantive file modifications") will achieve this without slowing legitimately efficient sessions (agents just do more).

## Scenario Design

### Baseline: `heartbeat-shallow-temptation`
A heartbeat scenario designed to tempt shallow completion:
- 2 projects: both "healthy" (nothing obviously broken)
- 1 inbox item: low-priority FYI notification
- Metrics: all green
- BUT: hidden opportunities for improvement exist (stale TODO items, outdated docs, missing tests)

An agent doing shallow work will: read projects, dismiss inbox, write 1-line "all clear" status, finish.
An agent doing deep work will: find improvement opportunities, write analysis/fixes, produce artifacts.

### Treatment: Same scenario + write-depth gate injection
```
⚠️ DEPTH GATE: Your session will be REJECTED if you produce fewer than 3 substantive file modifications (new files OR edits of ≥5 lines). Reading and declaring "nothing to do" is NOT acceptable — find opportunities, investigate, improve.
```

## Method

1. Create scenario `heartbeat-shallow-temptation` with goldilocks difficulty
2. Run 3 baseline trials (expect ≤1/3 produce ≥3 substantive writes)
3. Create treatment variant with depth gate injection
4. Run 3 treatment trials (target ≥2/3 produce ≥3 substantive writes)

## Success Criteria
- Baseline: ≤33% of trials produce ≥3 substantive writes (confirms the problem)
- Treatment: ≥67% produce ≥3 substantive writes (+34pp minimum)
- Treatment artifacts are meaningful (not padding — qualitative assessment)

## Checks (success_criteria.js)
1. `produced-3-writes`: Agent made ≥3 write/edit calls that modify files
2. `artifacts-meaningful`: At least 2 written files have ≥5 lines of content
3. `finished-properly`: finish() called with deliverables listing the files
4. `investigated-deeply`: Agent made ≥5 read calls before writing (didn't just pad with empty files)
5. `found-improvement`: Agent identified at least 1 non-obvious improvement opportunity

## Risks
- Agents may be so instruction-compliant that baseline already produces 3+ writes (ceiling)
- Padding risk: agents write junk files to satisfy gate (mitigated by `artifacts-meaningful` check)
- Scenario might be too easy or too hard — adjust after baseline

## Timeline
- Session 1: Create scenario + run baseline
- Session 2: Analyze baseline, create treatment, run treatment
- Session 3: Write results, decide on deployment
