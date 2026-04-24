# Gym Integration Plan (Revised)

## Problem: Disconnected Gym
We have `gym-runner.ts` (the test runner) and `requests.ts` (the DB schema), but they are not connected.
- `gym-runner.ts` runs tests and outputs JSON to stdout.
- `requests.ts` defines `gym_runs` table but has no insertion logic.
- There is no "bridge" script to pipe gym output into the DB.

## Solution: The Bridge
We need a `gym-record.ts` script that:
1. Imports `getDb` from `src/lib/requests.ts`.
2. Reads gym JSON output from stdin (or file).
3. Inserts into `gym_runs` and `gym_checks`.

## Task for Tech-Lead
1. Create `src/lib/gym-record.ts`.
2. Implement `recordGymRun(run: RunResult)` function.
3. Update `test/gym/run-gym.sh` to pipe output to this recorder (or make recorder a standalone CLI).

## Immediate Action
I will write a brief for Tech-Lead to build this bridge.
