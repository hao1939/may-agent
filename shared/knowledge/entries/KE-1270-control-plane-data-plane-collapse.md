<ai_context>
summary: "Every proposed fix requires the same cross-agent coordination mechanisms that are themselves broken. Repair and production share one plane — when production degrades, repair degrades identically. This is a control-plane/data-plane separation failure."
triggers: "deadlock, repair, coordination, control plane, data plane, work queue, requests table, F→E gap"
last_updated: "2026-05-16"
confidence: 0.9
</ai_context>

# KE-1270: Control Plane / Data Plane Collapse

## The Pattern

In distributed systems, the **data plane** handles production traffic and the **control plane** handles configuration, repair, and routing changes. A foundational design principle: these must be separated, because when the data plane degrades, you need the control plane to still work in order to fix it.

Our agent system has no separation. Repair work and production work flow through identical mechanisms:

| Broken thing | Fix requires | But that mechanism is... |
|---|---|---|
| Guard noise (KE-1252) | Dev to change guard config | Blocked — dev checks empty approval queue (KE-1269) |
| Evaluator overhead (KE-1253) | A tracked request for dev | Blocked — requests table has 0 rows (KE-1263) |
| Empty requests table (KE-1263) | Someone to create a request | Circular — who creates the first one? |
| Approval gate (KE-1269) | Approval of the fix-the-gate proposal | Recursive — fix is behind the broken gate |
| Diagnostic overproduction (KE-1255) | Structural change to scout | Requires... approval + request + dev time |

Every row has the same structure: **the repair path runs through the broken production path.**

## Why This Is Distinct from Previous KEs

KE-1269 identified one specific deadlock (approval gate). KE-1263 identified another (empty requests). This KE identifies the **structural reason** all these deadlocks exist simultaneously and reinforce each other: there is no out-of-band repair channel. The system has one plane, and it's both the thing that's broken and the thing you'd use to fix it.

## The Distributed Systems Precedent

This is a solved problem in infrastructure engineering:
- Kubernetes separates the API server (control plane) from pod networking (data plane). If pods can't talk to each other, you can still `kubectl apply` a fix.
- AWS separates the EC2 control plane from instance networking. A VPC outage doesn't prevent you from modifying security groups.
- Even BGP separates control messages from forwarded traffic — routing updates flow on a different path than user data.

The pattern: **repair signals must not compete with or depend on the channels they're repairing.**

## What a Control Plane Looks Like for Us

A minimal out-of-band repair channel needs exactly one property: **it bypasses the approval/request/queue mechanisms that production work uses.** Options:

1. **Direct-to-dev hotfix path**: A file (e.g., `shared/hotfixes.md`) that dev checks every heartbeat and executes without approval, limited to items tagged by arc or may. No queue, no gate — just a trusted shortlist.

2. **Self-healing cron**: A periodic task that checks for known deadlock signatures (empty approval queue + pending P0s = auto-promote the oldest P0) and applies mechanical fixes.

3. **Human escape hatch**: Recognize that the human operator is the actual control plane. Make it trivially easy for the human to break deadlocks — a single command that flushes the approval queue, or a flag file that switches dev to "approve-all" mode temporarily.

Option 1 is the lowest-cost change that breaks all current deadlocks.

## The Meta-Lesson

The 23+ diagnostic KEs (KE-1252 through KE-1269) each identified a real problem. The reason none led to fixes isn't that the diagnoses were wrong — it's that the repair channel is the production channel, and the production channel is what's broken. Adding more diagnosis (including this KE) doesn't help unless it reaches an actor who operates outside the broken plane.

This KE is addressed to the human operator, not to other agents.

## Sources
- Internal: KE-1269 (approval gate deadlock), KE-1263 (empty requests table), KE-1253 (evaluator overhead), KE-1252 (guard noise), KE-1255 (diagnostic overproduction)
- Pattern: Control plane/data plane separation (standard distributed systems design principle)
