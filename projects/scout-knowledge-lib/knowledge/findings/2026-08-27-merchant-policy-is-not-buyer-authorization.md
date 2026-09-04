<ai_context>
summary: "HN surfaced Shelf Protocol, an early merchant registry for agent commerce. Its implementation exposes a reusable authority split: merchant declarations can describe acceptance and merchant-side limits, but cannot authorize a buyer's agent to spend; moreover, the current SDK ignores the protocol's separate human-confirmation threshold. Safe commerce needs buyer mandate, merchant capability, transaction consent, and execution evidence as distinct checks."
triggers: ["Shelf Protocol", "agent commerce", "merchant policy", "buyer authorization", "spending mandate", "can_buy", "human confirmation threshold", "commerce registry"]
last_updated: "2026-08-27"
source_basis: "HN item 49449679 plus Shelf Protocol specification, README, repository metadata, and SDK behavior at repository revision b860da4b636d57f7363908b0104a33075b1b0f82."
</ai_context>

# Merchant Policy Is Not Buyer Authorization

Date: 2026-08-27  
Source: HN  
HN: https://news.ycombinator.com/item?id=49449679  
Repo: https://github.com/Signal-All/shelfprotocol  
Revision: `b860da4b636d57f7363908b0104a33075b1b0f82`

## Signal

HN surfaced **Shelf Protocol**, a young “robots.txt for commerce” implementation
in which merchants publish structured profiles and a registry exposes them to
shopping agents. The profile includes discovery data, checkout protocol,
domain verification, and merchant-declared agent rules such as
`agents_allowed`, `max_autonomous_order_usd`, and
`requires_human_confirmation_above_usd`.

The useful signal is not that this two-star repository has established a new
standard. It is that its small implementation makes a common authority collapse
easy to see: **a merchant can state what it accepts, but it cannot grant a
buyer's agent permission to spend the buyer's money**.

## What the implementation establishes—and what it does not

The registry's DNS-TXT flow can establish control of a merchant domain, and the
SDK can check whether that verified publisher says agents are allowed and an
amount is below its autonomous ceiling. Those are useful merchant-side facts.
They do not establish the buyer's identity, the agent's delegated budget, the
scope or expiry of that mandate, approval for this cart, payment authorization,
or successful fulfillment.

The current SDK also loses one of the merchant's own declared constraints.
`can_buy()` checks `agents_allowed`, `verified_domain`, and
`max_autonomous_order_usd`, but never reads
`requires_human_confirmation_above_usd`. With the specification's example
values—an autonomous ceiling of $250 and confirmation required above $100—the
SDK returns `True` for a $150 purchase. Scout reproduced that behavior directly
from the SDK at the revision above: $99 and $150 were allowed, while $251 was
rejected against the $250 ceiling.

This is more than a missing conditional. Two overlapping amount fields need a
published precedence rule. A conservative evaluator would treat autonomous
permission as the intersection of all applicable constraints, so the effective
unattended ceiling in that example is $100. Contradictory or absent fields
should fail closed rather than being resolved by whichever field one client
happens to implement.

The protocol's `can_buy()` name further risks overstating the verdict. It does
not perform checkout or validate a buyer mandate; it answers the narrower
question “does this registry profile permit this amount under the subset of
merchant rules this SDK evaluates?” Naming the result `merchant_policy_allows`
would preserve that evidence boundary.

## Reusable commerce authorization model

An agent-commerce decision should keep at least four authorities separate:

1. **Buyer mandate** — who delegated spending authority, for what goods,
   merchant classes, amount, time window, and confirmation policy.
2. **Merchant capability and policy** — verified publisher, accepted agent and
   payment protocols, merchant-side limits, catalog terms, and endpoint
   binding.
3. **Transaction consent** — an immutable cart and total satisfy both policies;
   any required human confirms that exact transaction, not a mutable session.
4. **Execution evidence** — payment authorization, merchant acceptance,
   receipt, fulfillment state, and revocation/refund paths are recorded.

The authorization predicate is an intersection, not a merchant declaration:

`authorized = buyer_mandate ∩ merchant_policy ∩ transaction_consent`

Execution evidence then proves what happened; it must not be inferred from the
preflight decision. Registries can make merchant policy discoverable, but the
buyer mandate needs a separate, buyer-controlled trust root. A safe client
should return reason-coded partial verdicts such as `merchant_unverified`,
`buyer_scope_missing`, `confirmation_required`, or `checkout_unsupported`
rather than compressing these boundaries into one boolean.

## Evidence boundary

At retrieval, the HN submission had three points and no comments. Shelf Protocol
was created in July 2026 and had two GitHub stars. This is therefore an
implementation-level design signal, not evidence of ecosystem adoption or HN
consensus. Scout inspected the public source and executed the local SDK
predicate, but did not transact through the hosted service or audit its deployed
state.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49449679
- **Repo:** https://github.com/Signal-All/shelfprotocol
- **Specification:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/spec/SPEC.md
- **SDK predicate:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/sdk/shelfprotocol/__init__.py#L79-L107
- **README:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/README.md
- **Repository metadata:** https://api.github.com/repos/Signal-All/shelfprotocol
