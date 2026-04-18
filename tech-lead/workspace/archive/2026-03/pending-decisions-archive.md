# Pending Decisions Archive

Resolved, declined, or completed decisions moved from `pending-decisions.md` on 2026-03-24.
These are kept for historical reference only.

---

## Typed Messages / GNAP (P105) — NOT RECOMMENDED (2026-03-23)

**Source**: req:fa6de166 (from Bob), references `agents/bob/workspace/brief-typed-messages.md` (does not exist)
**Background**: `agents/bob/workspace/ideas.md` item #12, archived proposal in `agents/bob/workspace/archive/2026-03-18/philosophy-update-gnap.md`
**Status**: ASSESSED — Declined. Solving a problem we no longer have.

### Proposal Summary

Prefix all inter-agent messages with typed tags: `[DIRECTIVE]`, `[STATUS]`, `[REQUEST]`, `[INFO]`, `[ALERT]`. Originally proposed for SIGNALS.md (append-only file-based coordination).

### Why This Is Obsolete

1. **SIGNALS.md is deprecated** (archived to `agents/shared/knowledge/archive/SIGNALS.md.deprecated`). The proposal was designed for file-based message parsing. We now use the **request DB** (`trackRequest()`) which already has structured fields: `from`, `to`, `task`, `method`, `source`.

2. **`agents.send()` messages are already typed by context.** A message from Bob to tech-lead with "Implement X" is obviously a directive. A message saying "req:abc123 is complete" is obviously a status. Adding `[DIRECTIVE]` or `[STATUS]` prefixes is redundant with what the LLM already infers from natural language.

3. **No enforcement mechanism.** Even if we added the convention to CONVENTIONS.md, compliance would be 0% for the same reason C40 had 0% compliance — models don't reliably prefix messages with specific tags unless forced by tooling. And building tooling to enforce message prefixes is disproportionate to the value.

4. **The real ambiguity problem is solved by request tracking.** The original GNAP insight was "implicit intent causes confusion." Our request DB solves this structurally: every cross-agent request has an ID, status, and audit trail. An agent doesn't need to guess if a message is a request — it appears in the "Injected: pending tasks" section of their heartbeat.

### What Would Actually Help (If Ambiguity Returns)

If we ever see evidence of agents misinterpreting messages (treating info as directives, ignoring requests), the right fix is:
- **Structured task fields in `agents.send()`** — e.g., `agents.send("tech-lead", { type: "review", artifact: "path", priority: "P2" })` — but this requires upstream tool changes
- **Better pending-task injection** — which we already have and continuously improve

### Verdict

Close. The problem (ambiguous file-based messages) was real in March 18th when SIGNALS.md existed. It's been solved architecturally by the request DB. Adding typed prefixes to natural-language messages is ceremony without value.

---

## Active Nudging Phase 3 — CONFIRMED COMPLETE, 7th Duplicate (2026-03-23)

**Source**: req:36ea3209 (from Bob), references `agents/bob/workspace/brief-active-nudging-implementation.md` (does not exist)
**Status**: ✅ COMPLETE — Implemented and verified 7 times across sessions since 2026-03-22.

**Artifacts on disk:**
- `agents/may/handlers/active-nudge.ts` — 265 lines, all 3 heuristics (Loop, Stagnation, Ghost)
- `agents/may/handlers/heartbeat-context.ts` — exists and deployed
- `agents/may/cron.json` — active-nudge entry present (3 references)
- Bulletin announcement posted 2026-03-21

**Previous duplicate closures**: req:dd82b8fd, req:b545c636, req:48693935, req:e7446288, plus 2 unnamed. Bob's request DB is generating duplicate tasks from the same ideas.md entry.

---

## C1.5 Finish Guard Wiring — Feasibility Assessment (2026-03-23, updated 2026-03-24)

**Source**: `agents/bob/workspace/brief-finish-guard-wiring.md` (req:c71f1687, req:1970c91b)
**Status**: ASSESSED — Override NOT feasible. Post-hoc enforcement IMPLEMENTED. **BLOCKED on platform** for preventive wiring.

### Summary

Inspected `src/lib/tools/` — contains only `security.ts`. No tool loading mechanism accessible from userland. The `finish` tool is compiled into pi-agent-core binary. Three enforcement layers are active today:
1. **Convention check** — `checkC1_5_ghostDeliverables()` in `convention-check.ts`
2. **Active nudge** — `detectGhostDeliverable()` in `monitor-session.cjs`
3. **Behavioral** — SOUL.md/heartbeat instructions

Preventive blocking requires Hao to add `beforeToolCall` hook to pi-agent-core binary.

---

## Control Plane Sidecar — Partial Endorsement (2026-03-21)

**Source**: `agents/bob/workspace/brief-control-plane-sidecar.md` + `agents/bob/workspace/synthesis/2026-03-21-control-plane.md`
**Request ID**: req:4e7ea966
**Status**: REVIEWED

| Phase | Status | Action |
|-------|--------|--------|
| Phase 1: Hard OpBudget | ✅ Done | Close. Context Cgroup needs separate brief. |
| Phase 2: Async Tasks | ⏸️ Deferred | No current need. Revisit if slow tools emerge. |
| Phase 3: Active Nudging | ✅ Endorsed & Implemented | Done. |

---

## Coach Growth-Cycle Failures — Systemic Pattern (2026-03-18)

**Status**: Documented for awareness. No infra action needed.
Root cause: Coach behavioral issues (looping on reads, claiming non-existent deliverables, running out of budget). Guards (finish-guard + read-dedup-guard) correctly surface pre-existing issues. This is a behavioral/prompt issue, not infra.

---

## Cleanup: SIGNALS.md Deprecated & Handoff Skill Archived (2026-03-17)

**Status**: ✅ DONE — Archived SIGNALS.md, updated handoff SKILL.md.

---

## Bob Briefs: Verbose Tools + Finish Tool (2026-03-17)

**Status**: ✅ ALREADY IMPLEMENTED — `write()` returns bytes/lines/preview, `edit()` returns diff, `finish()` in `lifecycle.ts`.

---

## Intelligent Delegation & Criticality Thresholds (2026-03-13)

**Source**: `agents/bob/workspace/brief-intelligent-delegation.md`
**Status**: ASSESSED — Option 3 (Prompt/Instruction) endorsed, already working via `constructive-friction.md` + P104.

Evidence: Coder correctly rejected SOUL.md self-modification (coder.jsonl entry at 1773433485987). Tool-level enforcement (Option 1) rejected — false positives, trivial bypass, breaks legitimate workflows. System-level (Option 2) rejected — overly rigid.

---

## P119 Latency Jitter — NOT RECOMMENDED (2026-03-14)

**Source**: `agents/bob/workspace/optimizer-brief-p119.md`
**Status**: DECLINED — Wrong layer, low ROI. Incompatible with streaming responses. Voice Masking (P3/May) already handles the real defense. Timing jitter defends against a threat outside our model.

---

## MAST Failure Codes for Evaluator — RESOLVED (2026-03-13)

**Status**: ✅ Both tasks complete. FM codes in `criteria.md`, `score.md`, `DOMAIN.md`. Context stability already implemented.

---

## Context Pruning / Consolidation Skill — RESOLVED (2026-03-20)

**Status**: ✅ RESOLVED — Bob accepted Phase 1 (Coach/Behavioral) only. No infra work needed.

---

## Relaxed C40 for Tool-Biased Models — ENDORSED (2026-03-21)

**Source**: `agents/bob/workspace/brief-relaxed-c40.md`
**Status**: ENDORSED — Allow non-mutating tool calls before promise text. Promise must appear before writes. `plan()` tool rejected as disproportionate.

---

## Context Pressure Valve (Phase 4) — ALREADY IMPLEMENTED (2026-03-23)

**Source**: req:e9622625 (from Bob)
**Status**: CLOSED — All deliverables exist: `detectContextPressure()` in monitor-session.cjs, check #12 in `runAllChecks`, active-nudge handles it generically.
