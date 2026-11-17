<ai_context>
summary: "PINE's pinned event-harness design carries origin trust into dispatch: untrusted events can start isolated runs with a reduced capability profile, while delivery into an existing subscribed conversation instead preserves its tools and taints later actions. The design shows that framing input as data is not a security boundary; source classification, session selection, capability reduction, approval state, subscription scope, and trust overrides must remain joined."
triggers: ["PINE", "reactive agent", "event-driven agent", "event source", "trust propagation", "untrusted run", "subscription isolation", "50535693"]
last_updated: "2026-11-17"
source_basis: "HN item 50535693 and pmndre/pine at commit 242b5ce873c26a9df1739d1475789d53c408c7d7; Scout inspected the complete README, security/events/sources documentation, selected source implementing source delivery and route guarding, and selected repository-authored tests, but did not install PINE, run its tests, reproduce sandboxing, or conduct a security audit."
</ai_context>

# Event-driven agents need trust-propagating dispatch

**Date:** 2026-11-17  
**Disposition:** new knowledge  
**Question:** When external events can wake an agent without a person present, where should origin trust change what the run is allowed to do?

- **HN source:** https://news.ycombinator.com/item?id=50535693
- **Repo:** https://github.com/pmndre/pine
- **Inspected revision:** [`242b5ce873c26a9df1739d1475789d53c408c7d7`](https://github.com/pmndre/pine/commit/242b5ce873c26a9df1739d1475789d53c408c7d7)
- **Coverage:** complete HN item and repository README; complete pinned security, events, and event-sources documentation; selected pinned source for route guarding and source delivery; selected repository-authored source and security tests. Scout did not execute the project or tests.

## Source observation

PINE is a local agent harness whose agents can subscribe to folders, webhooks, MQTT, mail, chat systems, device feeds, commands, and other event sources. Sources emit typed events onto a bus; routes can filter, debounce, throttle, transform, publish, call a model, or wake an agent. Subscriptions can belong to one conversation, one agent, or all agents, and can reuse a conversation or create a fresh one for every event.

Its security design treats event provenance as dispatch state rather than relying on a prompt warning alone:

- Events from external sources are `untrusted` unless an operator explicitly marks the source or route as `owner`. Schedules, authenticated owner channels, and qualifying internal publications are treated as owner-originated.
- A task directly started by an untrusted event receives a reduced profile by default: read-only built-in file tools, no shell or writes, no MCP servers, no delegation or sub-agents, no setup-changing tools, and an isolated session. The profile can be widened, disabled, or configured to refuse such work.
- An ordinary source subscription behaves differently by default. The event is delivered into the conversation that subscribed, with that conversation's existing tools. The conversation is then marked as having read outside content; outbound actions require approval and bypass mode is paused. The pinned source implements this distinction by delivering a non-separated subscription as owner-trusted work plus an explicit taint, while a separated subscription retains untrusted dispatch.
- Setting `separate: true` keeps an untrusted source out of the owner's conversation and starts a separate run with the reduced profile. The documentation recommends this for stranger-controlled text and unattended agents with broad access.
- A `trust: owner` override grants the ordinary tool set and is documented only for sources nobody else can write to. `pine check` reports these overrides, but the operator still owns the classification decision.
- Subscription scope and lifetime are explicit. A conversation-local subscription disappears when that conversation is closed or reset; a fresh-per-event subscription prevents one event's conversational context from carrying into the next; source-file access ends when the subscription ends.
- Expanding persistent authority is separately guarded. Repository-authored tests cover approval when outside content tries to induce a subscription, and the documentation says adding executable source types is refused from a conversation that has read outside content.

The HN item had two points and no comments when inspected. It supplied discovery, not corroborating evaluation.

## Interpretation

The reusable lesson is that an event's trust label must survive all the way into **run construction**. A warning such as “treat this as data” is useful context for the model, but it is not the enforcement boundary. The boundary is the joined decision over:

1. authenticated origin and any explicit declassification;
2. which agent and conversation receive the event;
3. whether prior conversation state is visible;
4. which tools, credentials, files, network paths, and delegation powers are registered;
5. which actions can proceed unattended versus require approval; and
6. how long the wake subscription and associated access remain live.

PINE also exposes a consequential difference between **tainting an existing powerful conversation** and **starting a reduced isolated run**. Tainting can constrain later egress and approvals while still leaving local effectful tools present. That may be appropriate when the owner deliberately subscribed a working conversation and needs its context, but it is a weaker containment boundary than capability reduction. Runtimes should make that choice visible per subscription rather than letting all event delivery look equivalent.

Trust overrides deserve the same governance as credentials. Marking a webhook, broker, route, or agent-published event as owner-originated is not metadata cleanup; it changes the available authority. Overrides should therefore be reviewable, attributable, narrow in scope, and included in health checks. Trust should also be monotone across derived events unless a named trusted component performs a justified reclassification: an agent or route handling untrusted input should not silently mint owner authority for downstream work.

For durable event systems, receipts should preserve at least the source identity, original and effective trust, route and subscription revision, selected session mode, effective capability profile, approval policy, and any trust override. That makes later investigation able to distinguish “the model was warned” from “the runtime actually removed the dangerous capability.”

## Relevance to May

PINE is specifically relevant to May's event-driven agent runtime because it presents a concrete, implementation-backed distinction among event admission, origin trust, conversation taint, isolated restricted runs, subscription lifetime, and capability registration. A useful adoption investigation is whether May can reconstruct the effective authority of every event-started attempt from durable evidence, and whether untrusted or externally influenced events can only broaden authority through an explicit, attributable boundary rather than through routing or task publication alone.

## Evidence limitations

This is static producer-authored evidence from a young repository at version `0.22.2`. Scout inspected documentation, selected implementation files, and selected tests at one commit, but did not install PINE, run its test suite, exercise a source, inspect every route and tool path, validate macOS or Linux sandbox enforcement, test container fallbacks, or verify that documentation matches every runtime behavior. Repository-authored tests show intended behavior, not independent security validation.

The source does not establish resistance to hostile local operators, compromised dependencies, kernel or sandbox escapes, incorrect operator trust overrides, model-assisted multi-step attacks within a widened untrusted profile, or complete mediation of every external effect. The design's explicit limits are useful, but they are not a proof that PINE is safe for unattended high-impact operation.
