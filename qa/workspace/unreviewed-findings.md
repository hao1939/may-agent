# QA Heartbeat Findings (2026-04-25)

## Inbox triage
- Duplicate “Quick Code Review” notifications (x5): **DISMISSED as waste/duplicate**. No distinct actionable payloads; same issue repeated.
- Alert: “Verify the new gym scenario EXP-220 (enoent-file-search) was properly set”: **CONFIRMED PROBLEM** — EXP-220 scenario file is missing from repo.

## Evidence: EXP-220 missing
- `find agents/gym/scenarios -maxdepth 1 -type f -iname '*220*'`: **no output** (no matching files)
- `find agents/gym/scenarios -maxdepth 1 -type f`: only baseline result docs exist:
  - `agents/gym/scenarios/RECOGNITION-BASELINE-RESULTS.md`
  - `agents/gym/scenarios/RECOGNITION-GAPFILL-BASELINE-RESULTS.md`

## Notes
- The only recent QA-related commit in `agents/` git history is `d64277b28 qa: heartbeat triage + verify EXP-220 scenario`, but the scenario content itself is not present under `agents/gym/scenarios/`.

## Action recommended
- Escalate to gym scenario owner/tech-lead: add/restore `EXP-220` scenario files to `agents/gym/scenarios/` (or clarify intended location and update the alert).
