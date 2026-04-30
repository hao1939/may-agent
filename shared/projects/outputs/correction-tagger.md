# Correction Tagging Protocol

## Purpose
Automatically tag sessions where Hao overrides or corrects a decision, enabling measurement of correction rate over time.

## Trigger Signals
Tag `correction: true` in session meta.json when Hao:
- Says "no", "stop", "don't do that", "cancel"
- Overrides a dispatch decision (reassigns work, changes priority)
- Rejects an output or asks for redo
- Expresses dissatisfaction with an autonomous choice

## Tagging Format
Add to the session's meta.json:
```json
{
  "correction": true,
  "correction_reason": "brief description of what was corrected",
  "correction_category": "dispatch|output|priority|scope|other"
}
```

## Categories
- **dispatch**: Wrong agent chosen or shouldn't have dispatched at all
- **output**: Result was wrong/unwanted
- **priority**: Task prioritized incorrectly
- **scope**: Did too much or too little autonomously
- **other**: Doesn't fit above

## Implementation
May should apply this tag in `finish()` calls whenever a session involved a Hao correction. The `measure-corrections.sh` script then aggregates these tags to produce correction rate metrics.

## Measurement
Run: `bash measure-corrections.sh [days]`
- Default window: 30 days
- Output: correction count, total decisions, percentage rate
- Target: <10% (currently ~1% baseline)
