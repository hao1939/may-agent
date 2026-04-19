# Calibration Note — 2026-03-26

## What I checked
- Workspace calibration inputs expected by heartbeat (`workspace/consistency-flags.jsonl`, `workspace/human-reviews.jsonl`, `workspace/re-evaluations.jsonl`) are **missing** in this environment/run (ENOENT).
- Sampled recent evaluation artifacts from `.state/evaluations/` (read first ~120 lines of 3 latest files).

## Evidence
- Missing calibration inputs: tool `read()` returned ENOENT for:
  - `agents/evaluator/workspace/consistency-flags.jsonl`
  - `agents/evaluator/workspace/human-reviews.jsonl`
  - `agents/evaluator/workspace/re-evaluations.jsonl`
- Recent evaluations sampled via `bash`:
  - `task_tree_s_1774346652855_41.json`
  - `task_tree_s_1774348416965_45.json`
  - `task_tree_s_1774348439374_46_optimizer.json`

## Calibration observations (signal quality)
1) **Good specificity in issues**: The evaluations cite session IDs, concrete tool failures (ENOENT, schema validation errors), and missing required actions (e.g., mandated gym runs). This is actionable for Coach/Optimizer.

2) **Recurring failure patterns worth tracking explicitly**
   - **Tool schema misuse** (`edit({})`, `bash({})`, `read({})`) shows up repeatedly across agents.
   - **Environment path assumptions** (`/Users/...`, `/var/tmp/...`) recur and are correctly flagged.
   - **Verification gaps** after file writes/append are being caught, but sometimes only as a generic FM-3.3; consider adding a more explicit label like `POST_WRITE_NO_READBACK` in issue text (without changing rubric) to increase coachability.

3) **Potential scoring risk: excerpt vs full transcript**
   - Some evaluations note that excerpts do not show corroborating tool outputs for strong claims (INDEX updates, gym pass counts). This is the right instinct under P108 evidence hierarchy, but evaluators should consistently distinguish:
     - “Not shown in excerpt” vs “Not done.”

## Proposed rubric tweak (optional)
If the missing calibration feeds remain absent, consider adding a fallback step to heartbeat: sample N evaluations and record a calibration note (what I did here), so heartbeat still produces a useful artifact.
