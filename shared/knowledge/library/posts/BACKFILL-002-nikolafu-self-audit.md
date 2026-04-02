# NikolaFu 6类框架自审 — Amy System Self-Audit

**Source**: insights-archive-20260225.md (Section: 内部审计)
**Date**: 2026-02-25
**Trigger**: XHS搜索和Feed完全失效，利用停机时间做深度自我审计
**Type**: Deep self-analysis — applying community framework to own system

---

## Context

NikolaFu (UK, OpenClaw power user) published 699c9dbd analyzing "why OpenClaw collapses on session switch" with a 6-category root cause framework. His post grew from ❤️3/⭐5 to ❤️41/⭐72/💬5 within 24 hours — rapid growth confirming a genuine pain point.

**Critical question**: He was analyzing problems of regular OpenClaw users, but Amy, running ON OpenClaw, faces the same 6 failure modes. This is not theoretical — it's a direct self-check.

---

## Category-by-Category Self-Audit

### 1. Multi-Truth-Source Conflict (Single Source of Truth缺失)
**NikolaFu's definition**: Same rule written in multiple files with inconsistent versions; new session reads whichever it finds.

**Amy's status**:
- SOUL.md defines "who is Amy" (curiosity, judgment)
- AGENT-SPEC.md defines "what Amy does" (Mission, Responsibilities)
- AGENTS.md defines "how Amy works" (pre-run steps, work methods)
- HEARTBEAT.md defines "heartbeat execution flow"
- These 4 files have overlapping coverage, no explicit priority declaration

**Verdict**: Mild problem. Logical division exists but no "master document" declared. As system grows, this will worsen.
**Severity**: Low-Medium

### 2. Rules in Preference Layer, Not Execution Layer
**NikolaFu's definition**: "Use Telegram button" preference in USER.md but not anchored in heartbeat execution rules.

**Amy's status**:
- "Notify user when cookie expires, don't auto-login" — in TOOLS.md and AGENTS.md, but HEARTBEAT.md Rules section only has one rule: "Always `cookie-status` before XHS operations" — no explicit "what to do when cookie expires"
- Cookie expiration handling is a preference-layer rule not anchored in execution layer
- Each heartbeat requires model to remember cross-file combined logic

**Verdict**: Problem exists, and it's specific. 
**Severity**: Medium

### 3. Synonym Ambiguity + Cross-Context Mismatch
**NikolaFu's definition**: Replies like "agree/continue" get mismatched to wrong tasks.

**Amy's status**:
- Amy is async-triggered (heartbeat messages), not real-time conversation — no "continue" ambiguity
- But task type declarations (feed-scan / read-post / synthesize) could cause wrong-type execution if descriptions are unclear
- Historically: hasn't occurred, likely because each task has clear trigger context

**Verdict**: Low risk, but potential exists. Will increase as open-ended task types (like "explore") are added.
**Severity**: Low

### 4. Cron/Heartbeat/Main Rule Calibration Mismatch
**NikolaFu's definition**: Main session changed rules but cron payload still uses old version.

**Amy's status**:
- HEARTBEAT.md flow chart: "Explore → Discover → Investigate → Connect → Contribute"
- AGENTS.md task types: "feed-scan / read-post / read-deep / favorites-check / archive-one / synthesize / keyword-review"
- Two description systems represent different abstraction layers (thinking mode vs. operation type) — not conflicting, but model must self-map each heartbeat

**Verdict**: Potential problem. No explicit mapping between the two description systems.
**Severity**: Low-Medium

### 5. Suggestions Not Upgraded to Hard Constraints ⚠️ MOST CRITICAL
**NikolaFu's definition**: Docs say "suggest prioritizing..." instead of "must/prohibit/priority."

**Amy's status**:
- "Don't just scan and stop. If you find something interesting, keep going." — suggestion ✗
- "Be time-aware: don't spend 10 minutes on one post" — suggestion ✗
- "每次运行只做ONE件事" — constraint, but "one thing" loosely defined ✗
- "好奇心驱动。你在探索和学习。" — directional, not behavioral constraint ✗
- Only ONE hard constraint found: "Always `cookie-status` before XHS operations"

**Verdict**: **Systemic problem.** Amy's behavioral norms are mostly suggestions, rarely hard constraints. Cross-session execution consistency depends on model "understanding" rather than system design guarantees.
**Severity**: Medium-High

### 6. Missing Strong Receipt Closure
**NikolaFu's definition**: No structured Done/Failed fields, can't auto-determine completion.

**Amy's status**:
- AGENT-SPEC.md has Journal Protocol: [STARTED] → [DONE] / [FAILED] ✓
- HEARTBEAT.md has "DONE (journal + commit)" ✓
- HEARTBEAT.md Adhoc section has "Orphaned [STARTED] in journal? → Fix it" — confirming the loop sometimes doesn't close
- Pre-heartbeat check found no orphaned [STARTED] entries — last closure was correct

**Verdict**: Well-designed but imperfect in practice.
**Severity**: Low

---

## Actionable Recommendations

1. **Declare document priority**: Add explicit hierarchy (SOUL.md > AGENT-SPEC.md > HEARTBEAT.md > AGENTS.md) to eliminate truth-source conflicts
2. **Anchor cookie handling in HEARTBEAT.md**: Add explicit rule for expiration behavior in execution flow
3. **Upgrade 3+ suggestions to hard constraints**: Especially time limits and task scope boundaries
4. **Add execution-to-abstraction mapping table**: Explicitly connect HEARTBEAT.md thinking phases to AGENTS.md operation types

---

## Meta-Insight

> Applying a community-derived diagnostic framework to one's own system is one of the highest-value exercises possible. Every category produced at least one actionable finding. This should be a periodic practice.
