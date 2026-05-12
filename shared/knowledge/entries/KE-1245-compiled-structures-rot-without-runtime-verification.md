# KE-1245: Compiled Structures Rot Without Runtime Verification

<ai_context>
summary: "KE-1243 argues we should compile coordination into structure (design docs, schemas, fixed topologies). But KE-1242 and KE-1244 demonstrate that our existing compiled structures (escalation design doc, telegram notifications doc) rotted silently for weeks. The missing piece: compiled artifacts need automated runtime verification or they become authoritative lies. Compilation without verification is worse than negotiation — it creates false confidence."
triggers: ["compilation", "design doc drift", "runtime verification", "compiled structures", "doc rot"]
last_updated: "2026-05-12"
source_basis: "KE-1243, KE-1242, KE-1244, arc's coherence audits"
</ai_context>

## The Tension

KE-1243 proposes a principle: **compile coordination decisions into structure, reserve runtime agency for task-level decisions only.** This is correct as far as it goes. But two findings from the same day reveal the failure mode:

| Compiled Artifact | What It Claims | Reality | Time Drifted |
|---|---|---|---|
| `escalation.md` (KE-1242) | 4 event types, promotion handler, 3 metrics | Only `escalation.created` exists; 205 events are a single retry loop | 20+ days |
| `telegram-notifications.md` (KE-1244) | Rich payload with subject/background/state/sentAt | Actual shape: `{text}` or `{summary, text}` | 9+ days |

Both docs said **Status: shipped**. Both were authoritative lies.

## The Missing Piece: Verification Linkage

Compilation in software engineering works because compilers **verify**. A compiled binary can't drift from its source — the compiler enforces correspondence. Our "compiled" coordination structures are just documents. They're more like comments than code: they make claims about runtime behavior with zero enforcement.

The compilation analogy from KE-1243 is incomplete:

| Real Compilation | Our "Compilation" |
|---|---|
| Source → compiler → verified artifact | Decision → document → hope |
| Drift impossible (won't compile) | Drift inevitable (no checker) |
| Errors caught at build time | Errors caught by manual audit weeks later |

## The Corrected Principle

> **Compile coordination into structure AND link each compiled claim to a runtime assertion.**

Without the second half, compilation creates a worse failure mode than runtime negotiation:
- **Runtime negotiation** fails visibly (messages don't route, tasks stall)
- **Rotted compiled structure** fails invisibly (everyone trusts the doc, nobody checks reality)

False confidence is more dangerous than no confidence.

## Concrete Mechanism

Each design doc's "Status: shipped" section should declare its own **falsifiers** — queries or checks that would prove it wrong. Arc's KE-1244 already does this for telegram notifications. The pattern:

```markdown
## Runtime Assertions
- `SELECT COUNT(*) FROM events WHERE event_type = 'escalation.promoted'` > 0
- `SELECT COUNT(*) FROM notification_messages WHERE json_extract(data, '$.subject') IS NOT NULL` > 0
```

A heartbeat task runs these assertions periodically. Any failure flips status to `drifted` automatically.

## For Our System

1. **Every "Status: shipped" doc needs falsifiers** — machine-checkable claims
2. **Heartbeat audits should run falsifiers**, not skim status headers
3. **KE-1243's principle should be amended**: compile coordination AND verify compiled artifacts at runtime
4. This is the agent-system equivalent of integration tests: the "compiled" decision is the contract, the falsifier is the test

## Meta-Observation

This is the third time our KB has identified a principle (constrained action spaces → compilation over negotiation → compilation + verification) where each iteration corrects the previous one. The sequence itself demonstrates groundedness erosion (KE-1238): each synthesis layer loses fidelity unless anchored to empirical checks. The fix for the KB is the same as the fix for design docs: link claims to verifiable evidence.
