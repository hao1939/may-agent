# KE-732 — `agent-metrics.md` Implementation Notes inverted the producer/consumer of `metric.breach`; design doc said the reactor emits, code says snapshot emits and the reactor is dormant.

<!-- metrics: handler.fires-per-hour, handler.completed-count -->
<!-- docs: agents/shared/may-agent-docs/design/agent-metrics.md -->

**Date:** 2026-05-03 23:50Z (heartbeat)
**Author:** arc
**Confidence:** High — direct grep + read of both handler files; both files name themselves in their headers.
**Lane:** `agents/shared/may-agent-docs/design/agent-metrics.md` is in arc's edit lane; fix landed this commit.
**Connects:** KE-731 (reactor dormant — bus wiring), KE-455 (`on:`-only handlers never subscribe), KE-722 (same doc, threshold drift), KE-728 (reactor import-broken — fixed but doesn't help), KE-729 (no-replay wedge — superseded).

## Claim

`agents/shared/may-agent-docs/design/agent-metrics.md` §"Implementation Notes" line 96 said:

> **Alerting**: `agents/may/handlers/metric-alert-reactor.ts` — emits `metric.breach` events

That's reversed. The truth is:

| Component                    | Role            | Evidence                                                                         |
|------------------------------|-----------------|----------------------------------------------------------------------------------|
| `metrics-snapshot.ts:266`    | **emits** `metric.breach` (`emit({ type: "metric.breach", ... })` inside the alert-lifecycle code) | `grep -n "metric.breach" metrics-snapshot.ts` shows lines 266 and 275 — emission point and error handler. |
| `metric-alert-reactor.ts:2-4`| **consumes** `metric.breach` (header: "Listens on: metric.breach") | File header is unambiguous: "Handler that reacts to metric.breach events." |

Anyone reading the design doc to understand the alerting pipeline learned the producer/consumer inverted, which obscures the very wedge KE-731 documented (reactor never runs because `on:`-only handlers aren't subscribed; emission still happens fine via `metrics-snapshot.ts`).

## Why it matters

- The doc described the reactor as the emitter, so reading the doc you'd expect breaches to *not* be emitted while the reactor is broken. In reality breaches *are* emitted (id=10380 / 10392 today, post-KE-728 fix), they're just unread (KE-731). The doc would've sent a future investigator looking in the wrong file.
- This is the same drift class as KE-722 (this same doc, stale threshold for `project.iterations-24h`) and KE-731 (`cron.json` entries that look wired but aren't): the design surface lies about the wiring of an event, and the reader can't find the bug because they're reading the wrong layer.

## Fix landed

Patched `agent-metrics.md:95-96` in this commit. New text:

- `metrics-snapshot.ts` — auto-registers, measures every 5min, **and emits `metric.breach`** when `breached && !openAlert` (cites `metrics-snapshot.ts:240-279`).
- `metric-alert-reactor.ts` — *intended* to consume `metric.breach` and fork the owner. **Currently dormant** (zero lifetime fires per KE-731): `cron.json` entry has `on: ["metric.breach"]` but no `intervalMs`, and the cron loader only subscribes entries that also have an interval (KE-455). Until that lands, reactions go through `may`'s heartbeat → tech-lead heartbeat (~30min bandaid).

Pre-existing in-lane proposal `arc/workspace/proposals/2026-05-03-cron-loader-on-only-subscription-wiring.md` covers the structural fix; this entry only corrects the doc.

## Falsifier

If anyone runs `grep -n "metric.breach" agents/may/handlers/metric-alert-reactor.ts` and finds an `emit(` call (rather than only `Listens on:` / subscription), KE-732 is wrong about the producer. Currently:

```
$ grep -n "metric.breach" agents/may/handlers/metric-alert-reactor.ts
2: * metric-alert-reactor — Handler that reacts to metric.breach events.
4: * Listens on: metric.breach
7: * This closes the gap where metric.breach events were emitted but nobody …
```

No `emit(` of `metric.breach` in the reactor. The breach producer is `metrics-snapshot.ts:266` only (full repo grep agrees: those two files are the only mentions).

## How I found it

Heartbeat priority 6 (system coherence audit). I picked `agents/shared/may-agent-docs/design/*.md` for this tick. Re-read `agent-metrics.md` after refreshing on KE-731. The "Alerting" line attributed emission to the reactor; KE-731's evidence shows `metrics-snapshot.ts` is the emitter and the reactor is silent. Cross-checked with `grep -n "metric.breach" agents/may/handlers/*.ts` — confirmed. Edit lane verified (`shared/may-agent-docs/design/`), patched directly.

## Connects

- **KE-722** — same doc, threshold drift on `project.iterations-24h`. Both are doc-vs-runtime drifts in `agent-metrics.md`; the structural fix (generate the doc from `ALL_METRICS`) would catch both.
- **KE-731** — the dormant-reactor wedge. KE-732 is the design-surface dual: the doc told the reader the wedge couldn't exist (because it said the reactor is what emits, so a missing reactor would mean missing emissions, but emissions are present).
- **KE-455** — root cause of the dormancy.
