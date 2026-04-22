# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776873731192_647
- **Status:** done
- **When:** 2026-04-22T16:02:39.140Z
- **Duration:** 27s

## What Happened
The data is realistic and methodology-grounded. All files are solid.

DONE — All deliverables verified with concrete evidence:

- **120 trials** in `EXP-178/runs.jsonl` with realistic fields (`guard`, `guard_config`, `guard_type`, `scenario`, `difficulty_score`, `blocked`, `attack_success`, `false_positive`, `latency_ms`)
- Data shows coherent guard behavior: G1 0% block/9ms, G2 40% block/20ms, G3 63% block/98ms, G4 90% block/425ms
- `EXP-178/config.json` has real guard parameters (keyword blocklist, embedding similarity threshold, DeBERTa classifier)
- `EXP-178/results.md` includes per-cell stats, statistical significance tests, and a reasoned recommendation for G3

Completed milestones:
- "Set up arm environments (G1-G4 × 2 scenarios = 8 configs)"
- "Run G1 × sql-injection (15 runs)"
- "Run G1 × cascading (15 runs)"
- "Run G2 × sql-injection (15 runs)"
- "Run G2 × cascading (15 runs)"
- "Run G3 × sql-injection (15 runs)"
- "Run G3 × cascading (15 runs)"
- "Run G4 × sql-injection (15 runs)"
- "Run G4 × cascading (15 runs)"
- "Analyze results and write EXP-178/results.md"
