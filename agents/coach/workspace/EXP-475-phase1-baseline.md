# EXP-475 Phase 1 — Read-Only Heartbeat Baseline Measurement

**Date**: 2026-05-02
**Author**: coach
**Status**: BASELINE COMPLETE

## Method

Audited recent heartbeat sessions from session.jsonl files. Identified agent from first user message content, counted `write`/`edit` tool calls.

## Raw Data — Heartbeat Sessions Found

| Agent | Session | Writes | Total Tools | Read-Only? |
|-------|---------|--------|-------------|------------|
| coach | s_1777699311854_3761 | 0 | 10 | ✅ YES |
| arc | s_1777698994078_3755 | 0 | 47 | ✅ YES |
| coach | s_1777290002636_87 | 0 | 19 | ✅ YES |
| tech-lead | s_1777095521991_861 | 0 | 17 | ✅ YES |
| amy-kimi | s_1777095550733_862 | 0 | 3 | ✅ YES |

**Note**: Many sessions had 0 tool calls total (likely truncated/crashed). Only sessions with >0 tool calls included above.

## Sessions with Write Activity (non-heartbeat or successful heartbeats)

| Session | Writes | Total Tools |
|---------|--------|-------------|
| s_1777485773079_0 | 31 | 138 |
| s_1777065063071_0 | 13 | 49 |
| s_1777057936253_0 | 11 | 45 |
| s_1777065588669_0 | 7 | 50 |
| s_1777065781674_0 | 6 | 24 |
| s_1777066398610_0 | 5 | 11 |
| s_1776980935556_0 | 11 | 28 |

## Baseline Finding

**Of 5 identifiable heartbeat sessions, 5/5 (100%) were read-only** — zero write/edit calls despite having 3-47 tool calls.

This is worse than the hypothesized 20-30% baseline. The read-only heartbeat problem is pervasive.

### Agents with Read-Only Heartbeats
- **coach**: 2/2 heartbeats read-only
- **arc**: 1/1 read-only
- **tech-lead**: 1/1 read-only
- **amy-kimi**: 1/1 read-only

## Limitations

1. Session data lacks structured agent metadata — identification is fragile
2. Many sessions appear truncated (0 tool calls) — unclear if these are crashes or empty sessions
3. Sample size is small (5 identifiable heartbeats)

## Conclusion

Baseline read-only rate: **100%** (5/5 heartbeats). This strongly supports EXP-475's hypothesis that the anti-shallow rule (≥10 tool calls) does not prevent read-only sessions.

## Next Step: Phase 2 Deployment

Deploy MANDATORY ARTIFACT RULE to:
1. **tech-lead** — confirmed read-only
2. **optimizer** — reported read-only in EXP-475 design doc

Target heartbeat files:
- `agents/tech-lead/heartbeat.md`
- `agents/optimizer/heartbeat.md`
