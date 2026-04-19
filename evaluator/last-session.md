# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776626817405_410
- **Status:** done
- **When:** 2026-04-19T19:27:04.231Z
- **Duration:** 6s

## What Happened
WHAT_HAPPENED: Coach attempted to query `.state/may.db` for a `convention_checks` table/schema to investigate Amy’s regressions, but found the table did not exist and `.tables` lookups for “conv” returned nothing. Coach then pivoted to inspecting the filesystem under `.state/convention-checks/`, locating `summary.json` and previewing it to confirm recent pass/total/rate stats for Amy’s conventions.
OUTCOME: partial
STILL_OPEN: Identify where detailed per-violation records live (since `convention
