# Finding: Mode B — Tool Gap Analysis (2026-04-19 00:00)

## Scan Window
Last 6h (18:00–00:00 UTC). 248 total sessions. Focused on non-evaluator, non-heartbeat sessions with opCount>15 (9 sessions across coach, bob, scout).

## Pattern 1: Path Discovery Failures (FM-1.3) — Still Active
**Frequency:** 2/3 Bob sessions, ongoing  
**Pattern:** Bob sessions start with wrong path assumptions (`ls agents/gym/scripts/`, `ls scripts/gym/scenarios/`) that don't exist, triggering 1-3 wasted ops per session before recovery. This is the same FM-1.3 path guessing pattern previously identified.

**Status:** Known issue, partially addressed by context.md updates. Bob's delegation context should include explicit gym scenario paths. The `scripts/gym/` vs `gym/scenarios/` confusion persists.

**Estimated savings:** 1-3 ops/session × ~4-6 Bob sessions/day = 4-18 ops saved daily.

## Pattern 2: Experiment Boilerplate (Bob)
**Frequency:** 3/3 Bob work sessions in window (48, 27, 26 ops)  
**Pattern:** Bob's experiment workflow follows the same steps every time:
1. Read project file
2. Read deep-dive via `kb-find.sh`
3. Design experiment (write EXP file)
4. Create scenario files (mkdir, cp, write task.md, success_criteria.js, scenario.json)
5. Run gym scenarios
6. Record results

Steps 3-4 are ~10-15 ops of boilerplate file creation. Bob already has `new-experiment.sh` but still manually creates gym scenario files.

**Tool gap:** A `gym-new-scenario.sh <name> --base <template>` that scaffolds scenario.json + task.md + success_criteria.js + environment/ from a template would save 5-8 ops per experiment session.

**Estimated savings:** 5-8 ops × 3-4 experiment sessions/day = 15-32 ops saved daily.

## Pattern 3: Gym Scenario Exploration (Coach) — Previously Identified, Unaddressed
**Frequency:** Still present in all 4 coach gym sessions in window  
**Pattern:** Same as previous finding — serial `cat`/`ls` to explore scenario structure. The recommended `gym-scenario-info.sh` from the 22:00 finding has not been built yet.

**Status:** Recommendation from prior scan still pending. This remains the highest-ROI tool gap.

## Pattern 4: Scout gitignore Recovery
**Frequency:** 1/1 scout session  
**Pattern:** `git add` fails because `workspace/` is gitignored, then recovers with `git add -f`. This happens repeatedly across scout sessions.

**Estimated savings:** Minimal (1 op per session), but could be eliminated by either: (a) updating .gitignore, or (b) adding `git add -f` as default in agent context.

## Dispatch Assessment

| Pattern | Priority | Action | Est. Daily Savings |
|---------|----------|--------|--------------------|
| P3: gym-scenario-info.sh | HIGH | Build script (carryover from prior scan) | 32-72 ops |
| P2: gym-new-scenario.sh | MEDIUM | Build scaffolding script | 15-32 ops |
| P1: Path context fixes | LOW | Update Bob's delegation context | 4-18 ops |
| P4: gitignore fix | LOW | Update .gitignore or agent context | ~3 ops |

## Key Observation
The highest-value tool gap (gym-scenario-info.sh, ~50 ops/day savings) has been identified in 3 consecutive Mode B scans but remains unbuilt. **Recommend escalating to a work session** rather than continuing to re-identify it.
