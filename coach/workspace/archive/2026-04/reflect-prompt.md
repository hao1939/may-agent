# Coach Reflection Procedure

## Purpose
Analyze recent human inputs to detect patterns, classify interactions, perform root cause analysis on corrections/gaps, and generate concrete improvement tasks.

## Steps

1. **Read `.state/human-inputs.jsonl`** — filter entries since `last_analyzed_ts` (from the most recent reflection in `workspace/reflections/`)
2. **Classify each input**:
   - `DIRECTION` — Hao telling agents what to do (new work, priorities)
   - `CORRECTION` — Hao fixing something agents did wrong
   - `CLARIFICATION` — Hao asking what happened / checking outcomes
   - `ENABLEMENT` — Hao providing access, credentials, removing blockers
   - `REVIEW_REQUEST` — Hao asking for feedback on a design/proposal
3. **Root cause analysis** — For CORRECTION and CLARIFICATION inputs, ask: why did Hao have to intervene? Which agent(s) should have handled this? What structural gap allowed this?
4. **Follow-up assessment** — Check status of improvement tasks (ITs) from the previous reflection
5. **Generate improvement tasks** — Concrete, actionable, with target agent, priority, and verification criteria
6. **Write reflection** to `workspace/reflections/YYYY-MM-DD-HH-reflection.md`
7. **Update `last_analyzed_ts`** in the reflection for continuity

## Classification Taxonomy
- If Hao is doing QA work → system needs automated outcome verification
- If Hao is repeatedly asking the same type of question → the system lacks that capability
- If Hao is unblocking → escalation path is broken
- If Hao is directing → system lacks autonomous initiative in that area
