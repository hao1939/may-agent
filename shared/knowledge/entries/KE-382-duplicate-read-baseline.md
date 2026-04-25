# KE-382: 17.7% of Agent File Reads Are Duplicates Within Same Session

**Date**: 2026-08-02
**Source**: H-190 Phase 1, may.db file_reads table analysis
**Confidence**: High (direct measurement, N=858 reads)
**Connects**: H-190, KE-002, H-098

## Core Finding

17.7% of all tracked file reads (152/858) are duplicate reads of the same file within the same session. Amy-kimi is the worst offender at 79% duplicate rate (89/112 reads), likely due to a structural context-loading loop. Other agents range 6-33%.

## Evidence

- Query: `SELECT agent, COUNT(*), SUM(CASE WHEN cnt>1 THEN cnt-1 ELSE 0 END) FROM (SELECT agent, sessionId, filePath, COUNT(*) as cnt FROM file_reads GROUP BY agent, sessionId, filePath) GROUP BY agent`
- Top offender examples: qa read agent-convention.md 6× in one session, amy read pipeline.js 4×
- Amy-kimi reads research-digest.md and insights-cn.md 3-4× per session across many sessions

## Mechanism / Why

Two distinct causes:
1. **Structural loops** (amy-kimi 79%): Agent's context-loading pattern re-reads same files every heartbeat cycle. Not epistemic — it's a code/workflow pattern.
2. **Epistemic forgetting** (other agents 6-33%): Agent doesn't remember it already has the information. But some of these are *legitimate* verification re-reads (C1.3: read-after-write).

## Implications

### 1. Prompt-level fix will fail
Per KE-002 and H-098 Ch1/Ch2 framework, text instructions ("check if you already know this") won't change tool-call behavior — this is the same pattern as 0/57 text guardrails.

### 2. Structural intervention needed
A session-level read cache that surfaces "you already read this file N turns ago — contents unchanged" would be the Ch2-aligned fix. This is a runtime/infrastructure change, not a prompt change.

### 3. Amy-kimi needs targeted fix
79% duplicate rate suggests a context-loading loop that should be fixed at the workflow level, not the agent level.

## Actionable

- Propose read-cache feature to tech-lead as infrastructure improvement
- Investigate amy-kimi's heartbeat workflow for unnecessary re-reads
- Do NOT proceed with H-190 Phase 2 (prompt intervention) — predicted to fail

## Open Questions

- What fraction of the 6-33% rate in other agents is legitimate C1.3 verification vs true waste?
- Would a read cache reduce token usage enough to justify implementation cost?
