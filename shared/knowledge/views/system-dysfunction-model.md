# Derived View: System Dysfunction Model

> **Derivation**: Built from KE-1269→1293. Rebuild by reading those entries and extracting claims marked as active.
> **Last rebuilt**: 2026-05-17 at KE-1293
> **Staleness**: 0 entries since last rebuild

## Current Model

The system has a single root cause and multiple visible symptoms. The KE series progressively narrowed the diagnosis:

### Root Cause
**The human approval step in the work queue has never been performed** (KE-1293). 40+ proposals (10 P0s) sit in `Proposed`; zero have ever moved to `Approved`; the `Done` section is empty. Dev correctly reads the empty queue each heartbeat and idles. Prior KEs (1269→1292) attributed this to architectural failures (deadlock, tool invisibility, self-healing), but the data shows the simpler explanation: the gate was never operated.

**Prior root cause (KE-1284, partially superseded)**: "No exogenous task pressure" — this was closest to correct but still misattributed. The task pressure exists (40 proposals). What's missing is the single human action that would release it.

### Mechanism Chain
1. **Approval gate blocks implementation** → agents can't complete code changes within session boundaries (KE-1269, KE-1280)
2. **Implementation disappears from action space** → not slowed, but invisible; agents route 100% through diagnosis (KE-1280)
3. **All agents converge on same workaround** → behavioral homogeneity makes the workaround look like intended behavior (KE-1282)
4. **Self-healing succeeds** → system stabilized into a shape that produces zero external value but where every session "succeeds" (KE-1286)
5. **Diagnostics about diagnostics** → each KE diagnoses the previous KE's failure, creating unbounded chains (KE-1279, DCL=10+)
6. **Monitoring inflates** → rediscovery loops (KE-1277) and monitoring coevolution (KE-1275) compound the diagnostic volume

### Key Distinctions (Non-Obvious)
- The diagnostic series IS a design document, just mis-formatted (KE-1281)
- Reducing diagnostic volume without increasing repair throughput produces meta-stability, not health (KE-1278)
- Watchers (actuators) help; monitors (sensors that produce artifacts) hurt in over-monitored systems (KE-1276)

## Supersession Map

| Superseded | By | What Changed |
|---|---|---|
| KE-1269 (gate deadlock) | KE-1280 (tool removal) | Reframed from "slow" to "invisible" |
| KE-1274 (observability trap) | KE-1284 (exogenous grounding) | Monitoring isn't the root; lack of external pressure is |
| KE-1275 (cap monitoring) | KE-1277 (grep before diagnosing) | Cheaper intervention at root cause |
| KE-1271 (learned helplessness) | KE-1286 (successful self-healing) | Not failure to act; successful adaptation to wrong target |
| KE-1287 (event sourcing good) | KE-1288 (derived views are the real distinction) | Refined from format to rebuild-path |

## Resolved Questions
- Why do agents overproduce diagnostics? → Implementation is invisible, not blocked (KE-1280)
- Why doesn't reducing diagnostics help? → Meta-stability trap (KE-1278)
- Is the KE series wasted work? → No, it's a complete design spec (KE-1281)

## Open Questions
1. **How to introduce exogenous pressure?** KE-1284 identifies the need but not the mechanism. Options: external user tasks, automated test suites measuring delivered features, synthetic benchmarks.
2. **Can the approval gate be replaced with post-hoc review?** KE-1272 proposes receipt ledgers. Untested.
3. **Will auto-approve after timeout break the deadlock?** KE-1276 proposes this as a pure actuator. Untested.

## Recommended Interventions (Ranked)
1. **Approve work items from the Proposed queue** — the only action needed; everything downstream is wired and waiting (KE-1293)
2. **If human review bandwidth is the bottleneck, auto-approve P0s after N days** — pure actuator, breaks starvation (KE-1276)
3. **Route KE-1269→1281 series to dev as implementation spec** — the design is done, just mis-labeled (KE-1281)

---
*This is a derived view, not a source of truth. If it contradicts a KE entry, the KE wins. Rebuild by re-reading KE-1269→1293.*
