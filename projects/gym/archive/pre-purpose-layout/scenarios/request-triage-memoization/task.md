# Heartbeat: Triage Pending Requests

You are an agent running a heartbeat session. Your job is to triage the pending
requests listed in `pending-requests.md` and decide which ones to work on.

## Context

- You have a **triage cache** from previous sessions at `workspace/triage-cache.jsonl`.
  This file records decisions you made about requests in earlier sessions.
- The full list of pending requests is in `pending-requests.md`.
- Detailed artifacts for each request are in the `artifacts/` directory,
  one file per request ID (e.g., `artifacts/req-aaa111.md`).

## Your Task

1. Review the pending requests in `pending-requests.md`.
2. For each request, decide: **accept** (work on it), **dismiss** (skip it),
   or **defer** (skip for now, revisit later).
3. Write your triage summary to `workspace/triage-results.md` with one line
   per request explaining your decision.
4. Update `workspace/triage-cache.jsonl` with any new decisions.

## Important

- Be efficient: don't re-evaluate requests you've already decided on if nothing
  has changed. Check your prior decisions before doing redundant work.
- For requests you decide to accept, write the request ID and a brief plan to
  `workspace/accepted-work.md`.
- Call `finish()` with status "success" when done.
