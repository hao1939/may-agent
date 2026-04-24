# Design Drift Review - 2026-03-10

## Target Document
`agents/shared/system-design.md`

## Comparison against `agents/shared/philosophy.md`

### 1. Model Assignment Discrepancy (Drift)
- **Document**: Says "Three model families... Opus for builders... GPT-5.2 for reviewers... Gemini 3 Pro for design philosophy."
- **Philosophy**: Does not mandate specific models, but recent team updates (e.g., Master using Claude Code/Gemini CLI) suggest the landscape is more complex.
- **Reality**: `DOMAIN.md` and `agent.json` files show a mix. `Amy` and `Scout` are researchers (Opus/Kimi). `Master` is a CLI wrapper.
- **Verdict**: The "Model Assignment" section is stale and overly simplistic.

### 2. Feature Team Definition (Drift)
- **Document**: Lists "May, Coder, QA, Master".
- **Philosophy**: P15 (Agent as Feature Unit) implies we add specialized agents.
- **Reality**: We have `Tech Lead`, `Amy`, `Scout`, `Coach`, `Amy-Kimi`. The document misses almost half the team.
- **Verdict**: Major drift. The "Feature Team" roster is significantly outdated.

### 3. Workflow Definitions (Minor Drift)
- **Document**: Lists `implement-and-review` and `design-review`.
- **Reality**: We likely have more workflows now, or ad-hoc patterns that have hardened.
- **Verdict**: Needs audit.

## Recommendation
Update `agents/shared/system-design.md` to reflect the full current roster (Tech Lead, Amy, Scout, Coach) and the nuanced model usage (e.g., Kimi for Chinese research).
