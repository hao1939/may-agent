# Implementation Plan: Resource Feedback (Agent-RRM) & Experience Replay

**Author**: Optimizer  
**Date**: 2026-03-14  
**Sources**: `agents/bob/workspace/optimizer-brief.md`, `agents/bob/workspace/design-review-2026-03-14.md`, `agents/bob/workspace/synthesis/2026-03-14-agent-rrm.md`  
**Status**: Draft for Tech-Lead

---

## 0. Philosophy Update (P113 + P114) — BLOCKED

`agents/shared/philosophy.md` is protected (only May can edit). The P113 and P114 text has been drafted below. **Action: Send to May for application.**

### P113 — Resource Feedback
> Agents must receive explicit signals about their resource consumption. Cost signals on expensive tool outputs (time, bytes) as a structurally separate block. Session budget warnings at 80% threshold. Pain signals for wasteful actions. Never inline cost metadata in tool result payloads.

### P114 — Experience Replay
> Agents must consult Tactical Experience (recent errors) before attempting complex tasks. Lightweight `pre-check` step: grep ERROR_LOG / LESSONS / synthesis for task-relevant keywords. Structured entries with Critique + Correction fields.

**P112** already exists in philosophy.md. No update needed for it.

---

## 1. Feasibility Analysis

### 1A. Cost Signal on Tool Outputs

**What**: Append execution cost metadata (wall-clock time, output size) to expensive tool outputs.

**Feasibility: ✅ Straightforward**

The injection point already exists in `manager.ts:wrapToolsWithReceipts()` (line ~2190). This method wraps every tool call — it already:
- Times nothing (gap), but wrapping the `tool.execute()` call with `Date.now()` is trivial
- Appends `<tool_output>` tags, SIG receipts, and pivot critiques as separate content blocks

**Approach**: After tool execution, measure elapsed time and output byte count. If either exceeds a threshold (e.g., >2s or >10KB), append a `<system_note>` block *after* the `</tool_output>` close tag. This keeps the tool's data payload intact (no JSON breakage risk).

**Example output structure**:
```
<tool_output name="bash">
...actual output...
[SIG: ts:hash]
</tool_output>
<system_note>[COST: 3.2s, 24KB output, turn 18/40]</system_note>
```

**Constraints**:
- Must not break the SIG/HMAC scheme — the cost block is outside the signed content
- Must not inflate context for cheap operations — only emit when thresholds exceeded
- No token counting available at tool level (tokens are tracked by the model API, not the harness) — use proxy metrics (time, bytes)

**Estimated effort**: ~30 lines in `wrapToolsWithReceipts()`.

### 1B. Session Budget Warning

**What**: When turn count approaches a configurable limit, inject a system warning into the next tool output.

**Feasibility: ✅ Straightforward**

The infrastructure already exists:
- `session.turnCount` is tracked (incremented on every assistant message, line 381)
- `session.opBudget` / `session.opCount` exist as the P85 hard-cap model

**Approach**: Add a new optional field `turnBudget` to `SubagentDefinition` and `ActiveSession`. When `turnCount >= turnBudget * 0.8`, inject a warning block alongside the cost signal. This is a *soft* warning (the agent sees it and can choose to wrap up), not a hard stop (that's P85's job).

**Design decisions**:
| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Hard field name | `turnBudget` | Consistent with `opBudget`. Clear semantics. |
| Default | `0` (unlimited) | Backward-compatible. Only agents that opt in get warnings. |
| Warning threshold | 80% | Per brief spec. Configurable via constant. |
| Warning injection | Same `<system_note>` block | Single injection point, after `</tool_output>`. |
| Hard stop at 100%? | No — leave to P85 `opBudget` | Separation of concerns: `turnBudget` = awareness, `opBudget` = enforcement. |

**Example warning**:
```
<system_note>[WARNING: Turn 33/40 — session budget 82% consumed. Wrap up, summarize, or finish.]</system_note>
```

**Estimated effort**: ~20 lines in `wrapToolsWithReceipts()`, ~5 lines in types/session init.

### 1C. Experience Replay Pre-Check

**What**: Add a pre-check step to agent heartbeats that greps error logs for task-relevant keywords.

**Feasibility: ✅ Simple but agent-level (not harness-level)**

This is fundamentally a **prompt/skill** change, not a code change. The pre-check is:
1. Extract keywords from the current task
2. `grep -i <keywords> agents/<agent>/workspace/ERROR_LOG.md agents/shared/knowledge/LESSONS.md`
3. If hits found, include them in context before acting

**Approach**: This belongs in agent instructions (SOUL.md / DOMAIN.md), not in `manager.ts`. The harness should not perform LLM reasoning to extract keywords — that defeats the "fast grep" constraint.

**Two options**:

| Option | Mechanism | Pro | Con |
|--------|-----------|-----|-----|
| A. Skill doc | Add a skill `agents/shared/skills/experience-replay.md` that agents read | Zero code change, any agent can use it | Relies on agent compliance |
| B. Harness pre-inject | `manager.ts` reads ERROR_LOG.md on session start, appends last N entries to user message | Automatic, no agent cooperation needed | Couples harness to file conventions |

**Recommendation**: **Option A** (Skill doc) first. This is P52 (Skill Over Agent) — if a skill works, don't code it. If compliance is poor (measured by evaluator), upgrade to Option B.

**For the ERROR_LOG.md template update** (adding Critique + Correction fields):
```markdown
## [DATE] Error: <title>
- **What**: What happened
- **Why (Critique)**: Root cause analysis
- **Fix (Correction)**: What to do differently next time
- **Keywords**: searchable terms
```

**Estimated effort**: 1 skill doc, 1 template update, ~5 lines added to relevant DOMAIN.md files.

---

## 2. Implementation Plan (Ordered)

### Phase 1: Philosophy + Skill (No code changes)

| Step | What | Who | Effort |
|------|------|-----|--------|
| 1.1 | Apply P113 + P114 to `agents/shared/philosophy.md` | May (protected file) | 5 min |
| 1.2 | Create `agents/shared/skills/experience-replay.md` | Tech-Lead or Coder | 15 min |
| 1.3 | Update ERROR_LOG.md template with Critique/Correction fields | Tech-Lead or Coder | 10 min |
| 1.4 | Add pre-check instruction to Coder and Optimizer DOMAIN.md | Tech-Lead or Coder | 10 min |

### Phase 2: Cost Signal (Small code change in manager.ts)

| Step | What | Who | Effort |
|------|------|-----|--------|
| 2.1 | Add `Date.now()` timing around `tool.execute()` in `wrapToolsWithReceipts()` | Coder | 15 min |
| 2.2 | Compute output byte count from `outputText.length` | Coder | 5 min |
| 2.3 | If time > 2s or bytes > 10KB, append `<system_note>[COST: Xs, YKB]</system_note>` block after `</tool_output>` | Coder | 15 min |
| 2.4 | Write tests: verify cost note appears for slow/large outputs, absent for fast/small ones | Coder | 20 min |
| 2.5 | Verify all 1192 existing tests still pass | QA | 5 min |

### Phase 3: Session Budget Warning (Small code change)

| Step | What | Who | Effort |
|------|------|-----|--------|
| 3.1 | Add `turnBudget?: number` to `SubagentDefinition` in `types.ts` | Coder | 5 min |
| 3.2 | Add `turnBudget: number` to `ActiveSession` interface, initialize from def/opts | Coder | 10 min |
| 3.3 | In `wrapToolsWithReceipts()`, after cost signal logic, check `turnCount >= turnBudget * 0.8` and append warning `<system_note>` | Coder | 15 min |
| 3.4 | Write tests: verify warning appears at 80% threshold, not before | Coder | 20 min |
| 3.5 | Optionally set `turnBudget: 40` in `agents/coder/agent.json` as pilot | Tech-Lead | 5 min |
| 3.6 | Full test suite pass | QA | 5 min |

---

## 3. Hard Constraints (P112)

Before implementation, these constraints must hold:

1. **No JSON breakage**: Cost/warning metadata must be structurally separate from tool result content. Use a distinct content block after `</tool_output>`, never inline.
2. **No SIG invalidation**: Cost metadata is outside the HMAC-signed content. Receipt verification must still work.
3. **Backward compatibility**: `turnBudget: 0` (default) = no warnings. Existing agents unchanged.
4. **No token counting**: We cannot count tokens at the tool level. Use time and byte-length as proxy metrics. This is sufficient for the "awareness" goal.
5. **No new dependencies**: All changes use existing `Date.now()`, `String.length`, and existing session state.
6. **All 1192 tests pass**: Non-negotiable gate before merge.

---

## 4. Success Criteria (from brief)

| Criterion | How to verify |
|-----------|---------------|
| A session that loops 50 times gets a warning at turn 40 and self-corrects or terminates | Set `turnBudget: 50` on a test agent, run a looping task, verify warning at turn 40 |
| Tool outputs show cost without breaking downstream parsers | Unit test: parse tool output JSON after cost injection, verify valid structure |
| Experience replay prevents known-error repetition | Manual test: add known error to ERROR_LOG.md, run agent on same task, verify it reads the entry |

---

## 5. What NOT to Do

- **Do not count tokens**: Token counting requires model-API integration that doesn't exist at the tool layer. Proxy metrics (time, bytes) are sufficient.
- **Do not implement hard turn limits**: That's P85's domain (`opBudget`). `turnBudget` is awareness only.
- **Do not build a "Resource Critic" agent**: The brief mentions Agent-RRM's separate critic, but per P52 (Skill Over Agent), a skill + harness injection is cheaper and more reliable.
- **Do not modify agent loop control flow**: The warning is informational — it doesn't stop the session or change execution. The agent reads it and decides.

---

## 6. Open Questions for Tech-Lead

1. **Threshold tuning**: Is 2s / 10KB the right trigger for cost signals? Should this be configurable per agent?
2. **Warning frequency**: Should the budget warning appear on *every* tool call after 80%, or only once? (Recommendation: every call — repeated pressure works better than a single notice.)
3. **`turnBudget` in `agent.json`**: Should we pilot with Coder only, or roll out to all agents?
4. **Token-level signals**: If the model API exposes `usage.total_tokens` per turn in the future, should we pipe that into the cost signal? (Yes, but defer — proxy metrics first.)
