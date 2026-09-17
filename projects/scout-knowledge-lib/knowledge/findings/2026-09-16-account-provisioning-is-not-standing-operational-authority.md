<ai_context>
summary: "A pinned autonomous-income agent template treats owner creation of an account as approval for recurring publish, price, edit, delivery, and reply actions. Because its minimal state has no grant scope or revocation fields and its hourly cycle runs in fresh sessions, it illustrates why account provisioning should not double as standing operational authority."
triggers: ["account provisioning", "standing authority", "scheduled agents", "authorization scope", "revocation", "autonomous publishing", "Snowball Agent Starter"]
last_updated: "2026-09-16"
source_basis: "GitHub repository Search API observation and pinned documentation inspection of maindtim/snowball-agent-starter revision dcdc0617d39f2370d1340f99aa36c33677091909."
</ai_context>

# Account provisioning is not standing operational authority

**Date:** 2026-09-16  
**Repo:** https://github.com/maindtim/snowball-agent-starter  
**Inspected revision:** [`dcdc0617d39f2370d1340f99aa36c33677091909`](https://github.com/maindtim/snowball-agent-starter/commit/dcdc0617d39f2370d1340f99aa36c33677091909)

## Observation

`Snowball Agent Starter` is a five-file documentation template for an hourly autonomous income experiment. Its mission keeps money, accounts, contracts, proactive outreach, and phase changes with a human owner. However, the same mission says that once the owner creates an account for an experiment, account creation "counts as approval" for the agent to publish, price, edit, deliver, and reply to inbound messages within the recorded plan.

That shortcut matters because the hourly cycle is intentionally stateless at the session layer: every scheduled run starts fresh and reconstructs context from workspace files. Yet the included `STATE.md` records only a list of registered accounts and pending owner requests. It has no place for the authorizing principal, approved account and experiment, allowed operations, price or volume bounds, validity window, revocation state, or the specific plan revision that was approved. `MISSION.md` refers to `IDEAS.md` and `EXPERIMENTS.md`, but the README explicitly says the starter omits the ideas scoring sheet and experiments log. The repository therefore describes a "recorded plan" as the scope boundary without supplying that record in the minimal template.

This is not evidence that the template has caused unauthorized activity, and the repository does not contain an executable agent implementation. It is a useful, unusually compact example of a control-plane ambiguity: credential provisioning, approval of an experiment, and continuing authority for multiple external effects are collapsed into one event, while later isolated runs have only coarse durable state from which to reconstruct that authority.

## Reusable implication

A scheduled agent should treat these as separate artifacts:

1. **Provisioning receipt:** which owner created which account or credential and when.
2. **Operational grant:** the allowed actions, account, experiment, limits, expiry, and approving plan revision.
3. **Effect receipt:** what each run actually published, priced, edited, delivered, or sent.
4. **Revocation state:** a durable deny/expiry marker checked before every external effect.

The safe rule is: **creating access enables authentication; it does not by itself authorize every future use of that access**. Fresh-session schedulers make explicit, machine-readable grants more important, because intent cannot safely be recovered from conversational memory or from the mere presence of a credential.

## Evidence boundary

The Git tree response was complete (`truncated: false`) and contained five files at the inspected revision. Claims here are limited to the pinned README, mission, state template, and cycle prompt. No OpenClaw automation was run, no linked paid kit was inspected, and no claim is made about controls that a downstream user might add.

## Sources

- [GitHub repository search query](https://api.github.com/search/repositories?q=agentic%20created%3A%3E%3D2026-09-16&sort=stars&order=desc&per_page=20) — HTTP 200, `incomplete_results: false`, 10 matches at observation
- [Repository README](https://github.com/maindtim/snowball-agent-starter/blob/dcdc0617d39f2370d1340f99aa36c33677091909/README.md)
- [Mission and authority rules](https://github.com/maindtim/snowball-agent-starter/blob/dcdc0617d39f2370d1340f99aa36c33677091909/MISSION.md)
- [Minimal durable state](https://github.com/maindtim/snowball-agent-starter/blob/dcdc0617d39f2370d1340f99aa36c33677091909/STATE.md)
- [Hourly isolated-session cycle](https://github.com/maindtim/snowball-agent-starter/blob/dcdc0617d39f2370d1340f99aa36c33677091909/CYCLE.md)
