# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776698818626_19
- **Status:** done
- **When:** 2026-04-20T15:29:23.405Z
- **Duration:** 2m24s

## What Happened
Root cause: the **Coverage** metric is computed as:

- **evaluated** = `COUNT(DISTINCT sessionId)` in `evaluations` for sessions completed in the last 24h
- **total** = `COUNT(*)` of completed sessions in the last 24h

From the DB, it was **1140 evaluated / 1728 total = ~66%** (below the 80% threshold). The missing evaluations were overwhelmingly from high-volume agents (**may: 218**, **tech-lead: 212** missing), meaning the evaluator pipeline wasn’t keeping up / backfilling.

Corrective action 
