# Finding: Mode B — Tool Gap Analysis (2026-04-18 22:00)

## Scan Window
Last 6h sessions with opCount>15. Focused on coach's high-op use-persistent-task sessions (65, 51, 48 ops).

## Pattern 1: Gym Scenario Exploration via Serial `cat`/`ls`/`grep`
**Frequency:** 3/3 analyzed sessions, ~15-20 bash calls per session  
**Pattern:** Agent repeatedly runs `cat scenario.json`, `cat task.md`, `cat success_criteria.js`, `ls environment/`, `find ... -type f`, `cat environment/agents/bob/...` to understand a gym scenario's structure. Each is a separate bash call.

**Example (s_1776540115465_532):** 67 bash calls, first 10+ are just reading scenario files one by one via `cat`.

**Estimated savings:** A `gym-scenario-info.sh <scenario>` script that dumps scenario.json + task.md + success_criteria.js + file tree + key environment files in one call would save 8-12 ops per session.

## Pattern 2: Gym Transcript Hunting
**Frequency:** 2/3 sessions, ~5-8 bash calls each  
**Pattern:** Agent tries to find gym run transcripts: `ls .state/sessions/s_...`, `find .state/ -path "..."`, `find .state/gym/`, reading gym-run.sh source to figure out where transcripts go. The gym runner stores results in may.db gym_runs table but agents don't know this.

**Estimated savings:** A `gym-transcript.sh <run_id>` script or clearer documentation would save 5-8 ops. Though this is partly a knowledge gap (agents should query gym_runs table).

## Pattern 3: PATH Setup Repetition
**Frequency:** All 3 sessions, 2-3 calls each  
**Pattern:** `export PATH=".state/.bun/bin:$PATH"` repeated because bash calls don't share environment. Agent re-exports PATH before every bun command.

**Estimated savings:** Minimal — this is inherent to stateless bash calls. Could be fixed by a shell wrapper but low ROI.

## Pattern 4: Scenario File Copy Boilerplate
**Frequency:** 1/3 sessions (s_1776545680528_605), ~6 bash calls  
**Pattern:** Creating a new scenario variant: `mkdir -p`, `cp -r environment/`, `cp scripts/`, copying files between directories. This is scenario-variant creation boilerplate.

**Estimated savings:** A `gym-fork-scenario.sh <base> <variant>` script would save 4-6 ops. But only applies when creating new variants, which is less frequent.

## Dispatch Assessment

**Pattern 1 (scenario info) — DISPATCH WARRANTED.** High frequency (every gym-related session), high savings (8-12 ops), simple to build. A ~20-line shell script.

**Pattern 2 (transcript hunting) — PARTIAL.** Better addressed by adding gym_runs table info to agent context rather than a new tool. Low-priority script.

**Pattern 3 (PATH) — NO DISPATCH.** Inherent to tool architecture.

**Pattern 4 (scenario forking) — MAYBE.** Lower frequency but saves time when needed. Could be combined with Pattern 1 into a gym CLI toolkit.

## Recommendation
Create `scripts/gym-scenario-info.sh <scenario-name>` that outputs:
- scenario.json contents
- task.md contents  
- success_criteria.js contents
- Full file tree of environment/
- First 50 lines of each key environment file

Estimated impact: Saves 8-12 ops per gym-related work session. Coach runs ~4-6 gym sessions/day = 32-72 ops saved daily.
