---
title: "CRM — Agentic-First SaaS Pushes Intelligence Into a Durable Queue Worker"
source: github
date: 2026-08-05
last_updated: 2026-08-05
type: finding
tags: [github, agentic-applications, durable-agents, event-queue, evidence-ledger, egress-control, governance]
relevance: high
---

# CRM

## Overview

- **Repo:** [trycompai/crm](https://github.com/trycompai/crm) (4,984★, created 2026-07-31, pushed 2026-08-05)
- **Author:** trycompai
- **Language:** TypeScript
- **License:** MIT
- **What:** An open-source, single-tenant CRM whose core product claim is not "AI inside the app" but a separate durable research agent that owns enrichment, identity resolution, follow-up scheduling, and evidence-based record updates.

## Core Signal

**Agentic-first application design is getting operationally opinionated.**

CRM treats the UI and API as event surfaces, while the actual judgment layer lives in a separate durable agent deployment with its own queue, schedules, sandbox, and evidence model. The repo is not interesting because it added a chat box to CRM records; it is interesting because it explicitly subtracts intelligence from the request path and relocates it into a governed background worker.

The strongest sentence in the repository is in `docs/api.md`: **"Nest reports that something happened; the agent decides what it means."** That is a much sharper architectural boundary than the common pattern where an app mixes synchronous API heuristics, background enrichers, and ad hoc model calls.

## Concrete Design Moves

1. **The API is intentionally dumb about inference.**
   The README and `docs/api.md` both say the API must not research, enrich, score, summarize, or match identities. Its job is to write an `AgentTask` row when something happened and let the agent lease that work later. The note even cites the failure that motivated the rule: duplicated identity matchers in API and agent code drifted until one matched "every employer on earth."

2. **The queue row is the message, not a transport detail.**
   `docs/api.md` says the agent task row replaces an HTTP call because the row survives downtime and redeploys. `lib/tasks.ts` shows the actual leasing discipline: `FOR UPDATE SKIP LOCKED`, lease expiry, bounded attempts, and a `scheduleTask` path that updates an existing unfinished task instead of duplicating it.

3. **The agent is a durable deployment with its own execution lanes.**
   The README and `docs/agent.md` describe the agent as its own eve deployment. `schedules/dispatch.ts` runs every minute, and `docs/agent.md` explains a two-lane split: visible deterministic work such as portraits/brand fetches, and research work that gets a full eve session. This is a useful signal that application agents are inheriting runtime ideas from coding-agent harnesses rather than staying as monolithic chat backends.

4. **The trust model refuses confidence theater.**
   The README says "nothing about a person is guessed." `skills/evidence.md` formalizes that as evidence kinds instead of self-reported confidence scores: `crm.signature-block`, `crm.thread-reply`, `github.account-identity`, `web.cited-claim`, and `contradiction`. `tools/record_fact.ts` then records claims with evidence arrays and lets the ledger decide whether a fact is applied, suggested, or held.

5. **Sandboxing is framed as egress control, not just tool convenience.**
   The README says the sandbox has `deny-all` egress and no `DATABASE_URL`; `sandbox/sandbox.ts` enforces `networkPolicy: "deny-all"` across backends. The claim is specific: a shell with network and database credentials is exfiltration-shaped, while a shell with neither is just a text processor.

6. **Source optionality is a first-class planning input.**
   The README says the system is designed to work with no optional vendor keys at all, relying first on mailbox history and signatures. It tells the agent which capabilities are on or off at session start so the plan is conditioned on actual available evidence sources rather than discovered through failed calls.

7. **The repository is explicit about scope limits.**
   `SECURITY.md` says the system is single-tenant, internal, and that sign-in is effectively the whole authorization model. That matters because the architecture is not being presented as universally safe SaaS autonomy; it is a deliberately bounded deployment shape where read access is broad but write and egress controls are narrow.

## Why This Matters

1. **Vertical software is converging on the same separation patterns as agent harnesses.**
   The notable shift is not "CRM with AI," but an app where intelligence is isolated into a durable queue worker with explicit schedules, leases, bounded retries, and sandbox rules.

2. **Evidence-ledger design is moving from research rhetoric into product code.**
   Many repos talk about grounding; this one turns grounding into concrete evidence classes and refuses user-facing facts unless the evidence band is strong enough.

3. **The request path is being de-weaponized.**
   By removing model judgment from the synchronous API, the repo reduces a common failure mode of agentic apps: duplicated intelligence logic that drifts across surfaces.

4. **The real product boundary is shifting from "assistant feature" to "background operator."**
   The CRM is where the agent writes things down, not where the intelligence lives. That is a strong signal that some successful agent-native applications may look less like copilots and more like durable internal workers attached to conventional software.

## Connections to Library Themes

- **Orchestration bifurcation:** the repo is another example of thin request/response surfaces paired with a thicker background control plane.
- **Verification inversion:** evidence kinds and ledger-based acceptance move trust away from freeform model confidence.
- **Harness-first reliability:** leases, bounded retries, lane separation, and capability-aware planning matter at least as much as model choice.
- **Containment over autonomy:** the system broadens read access but keeps egress and direct database access tightly constrained.

## Sources

- **Repo:** https://github.com/trycompai/crm
- **README:** https://raw.githubusercontent.com/trycompai/crm/main/README.md
- **Agent docs:** https://raw.githubusercontent.com/trycompai/crm/main/docs/agent.md
- **API rules:** https://raw.githubusercontent.com/trycompai/crm/main/docs/api.md
- **Security policy:** https://raw.githubusercontent.com/trycompai/crm/main/SECURITY.md
- **Dispatch schedule:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/schedules/dispatch.ts
- **Task leasing:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/lib/tasks.ts
- **Evidence skill:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/skills/evidence.md
- **Data-boundaries skill:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/skills/data-boundaries.md
- **Sandbox policy:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/sandbox/sandbox.ts
- **Fact recording tool:** https://raw.githubusercontent.com/trycompai/crm/main/apps/agent/agent/tools/record_fact.ts
- **GitHub API metadata:** https://api.github.com/repos/trycompai/crm
