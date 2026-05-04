# Experiment Pipeline Status — 2029-07-27

## Active Pipeline

### 🟡 DESIGNED (Awaiting Binary Rebuild)
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-650 | Structural Impact-Scanning Gate | DESIGNED | Binary not rebuilt — TS source changes not in runtime |
| EXP-630 | Structural Duration Gate | DEPLOYED in source, INERT | Same binary rebuild blocker |

### 🔴 BLOCKED
| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-640 | Duration Gate Production Audit | BLOCKED | Binary not rebuilt. Escalated 2029-07-23. |

### ✅ CLOSED (Recent)
| ID | Name | Result | Date |
|----|------|--------|------|
| EXP-645 | Impact Radius Check Production Audit | H1 REJECTED — 6% scanning, extends KE-480 | 2029-07-23 |
| EXP-635 | Threat-Framed Depth Commitment | CEILING — baseline 100% in gym | 2029-07 |
| EXP-620 | Gate-Gaming Detection | PARTIALLY SUPPORTED — 27-55% trivial | 2029-07 |
| EXP-615 | Notification-Only Waste Detection | SUPERSEDED — H1 supported (64% shallow) | 2029-07-25 |

## New This Session

### KE-645 Written
**Cognitive Skills Also Fail in Production Without Structural Gates** — Extends KE-480. Gym measures capability ceiling, not production behavior. Even +100pp gym skills show ~0% production transfer without structural enforcement.

### EXP-650 Designed
Structural impact-scanning gate: re-prompt agent when ≥2 file edits + 0 grep/rg commands. Same architecture as EXP-630 duration gate. Ready for implementation when binary is rebuilt.

## Critical Blocker: Binary Rebuild

**All structural gate experiments are blocked by the same issue**: `may-agent` binary was not rebuilt after TS source edits to `heartbeat-data.ts`. Escalated to tech-lead 2029-07-23. No response yet.

### Affected Gates (source-only, not executing)
- EXP-630: Duration gate (90s threshold)
- EXP-650: Impact-scanning gate (designed, not yet in source)
- EXP-565: Verify-after-edit threat gate (status unknown)

### Working Gates (in binary)
- EXP-500: Read-before-edit (confirmed working)
- EXP-510: Completion checklist (confirmed working)
- EXP-520: Artifact gate (confirmed working)
- EXP-530: Verification gate (confirmed working)

## Next Steps
1. Follow up on binary rebuild escalation (re-escalate if no response by 2029-07-30)
2. Once rebuilt: EXP-630 measurement → EXP-650 implementation → measurement
3. Consider: Are there experiments possible WITHOUT binary changes? (gym-only, text-level audits)
