# Unreviewed Findings (QA heartbeat)

Date: 2026-04-27

## Inbox triage
- Duplicate “Quick Code Review” requests: appears to be notification spam (5 identical). No active pending review requests currently surfaced in this heartbeat view.
- Coaching alerts (C8.2 no finish call, C1.4 last tool call must be finish): needs process correction on QA side (always end heartbeat with finish()).
- EXP-220 gym scenario verification request: scenario folder not found under `agents/gym/scenarios` (searched for `EXP-220*`; no matches). Likely missing/misnamed scenario; requires follow-up.

## Evidence
- `find agents/gym/scenarios -maxdepth 1 -type d -name 'EXP-220*'` returned no output.

## Next steps
1. Ask owner/dispatcher what the expected path/name for EXP-220 is (or whether it lives in a different repo/location).
2. If EXP-220 should exist here, create/restore scenario folder with standard structure + README and add to scenarios index.
3. Address coaching: ensure every QA session ends with `finish()` and last tool call is `finish()`.
