# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1776823034781_33
- **Status:** done
- **When:** 2026-04-22T02:00:11.792Z
- **Duration:** 2m57s

## What Happened
The 24h dedup window means repeated alerts for the same metric don't get new sessions, which means no reaction request is created - making the metric worse. This is the root cause. Let me reduce the dedup window:
