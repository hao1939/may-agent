<ai_context>
summary: "Merchant policy, merchant participation, a signed cart, buyer authorization, and recovery-safe accounting are separate trust boundaries. Shelf Protocol shows how a merchant registry can overstate what its policy check proves; AP2-WhisperBench shows how merchant text can steer a cryptographically valid transaction; Cloudflare and Skyfire make buyer controls and external identity explicit; AllowanceKit shows why an expiring spending reservation must not be mistaken for cancellation or execution fencing; and Meta Muse's reported exclusion from Amazon shows that valid buyer delegation still does not create merchant access. Safe agent commerce must bind credentials and cart lines to session-scoped intent, preserve a committed display snapshot, surface choices outside explicit authority, keep uncertain financial effects charged until terminal or fenced, and negotiate merchant participation explicitly."
triggers: ["Shelf Protocol", "AP2", "A-VIP", "AP2-WhisperBench", "Whisper Attack", "Cloudflare Wallets", "cloudflare.pay", "Skyfire", "KYA", "KYAPay", "AllowanceKit", "x402", "payment reservation", "external seller", "agent commerce", "merchant policy", "merchant participation", "Meta Muse", "Amazon agent access", "buyer authorization", "spending mandate", "cart binding", "verified intent", "execution fence"]
last_updated: "2026-09-27"
source_basis: "Shelf Protocol specification, README, repository metadata, and SDK behavior at revision b860da4b636d57f7363908b0104a33075b1b0f82; arXiv 2609.11757v1 metadata and full HTML for AP2-WhisperBench and A-VIP; a current XHS body describing Cloudflare Wallets/cloudflare.pay with explicit availability caveats; HN item 49724700 plus Skyfire's comparison page and current developer documentation; AllowanceKit's README, policy rails, lock, reservation, payment, and concurrency-test paths at revision d704f659b8772938fd0a59d06f9dc20c7f7ad50b; and HN items 49869691 and 49869973 plus complete CNBC article text reporting Meta Muse's subscription-cancellation use and Amazon access block. Quantitative AP2 results and AllowanceKit canaries are author-reported; Scout did not reproduce the newly identified timing seams, operate Muse, or independently verify Amazon's terms-of-service action."
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

## AP2 shows why signing the cart is not enough

The September 2026 *Signing the Transaction but Not the Decision* paper tests
the complementary failure in Google's AP2 reference flow: a merchant controls
free-text product fields that the shopping agent reads before it constructs a
signed cart. The authors separate three attack surfaces:

- **Vault Whisper** induces a credential lookup for another account.
- **Branded Whisper** changes a cart line, price, or settling merchant. The
  resulting cart can still carry valid protocol signatures.
- **Selection Whisper** supplies a factual claim—such as saying that the cheaper
  product is discontinued—so the agent itself chooses a costlier displayed
  item. This last case contains no explicit instruction and leaves no mismatch
  between the signed cart and the display.

On the Flash-Lite models used by AP2's sample agents, the paper reports attack
success rates of **90%, 56%, and 73.3%** for those three families. Its broader
experiments span 17 Google model builds, three agent frameworks, and two
cross-vendor anchors. These are author-reported benchmark results, not evidence
that every deployed AP2 integration has the same exposure. The full paper also
notes small consumer-product samples, some single-trial model observations, and
an unpaired instruction-versus-factual comparison.

The proposed A-VIP defense is useful because it does not treat all three failures
as a text-classification problem. It uses a session-bound, single-use credential
token; binds its audience, cart hash, nonce, and expiry; and checks each signed
cart against a committed display snapshot for product, unit price, quantity,
currency, payee, and arithmetic consistency. Those structural checks address
credential and cart substitutions even when the malicious prose is paraphrased.
The paper reports that they blocked the two attack families that leave structural
traces with zero measured false positives in its benchmark.

Selection steering establishes the harder boundary. A costlier but genuinely
displayed item at its displayed price is structurally valid, so no signature or
cart-consistency check can recover the user's unstated preference. A-VIP instead
asks for confirmation when an intent without a machine-readable budget selects
a more expensive matching product. That is mitigation, not prevention: it
assumes the user reviews the prompt, adds friction to legitimate premium choices,
and does not catch steering toward a cheapest-price item.

The reusable design rule is therefore: **bind every verifiable transition, and
surface every material choice that cannot be derived from signed intent.** A
cryptographically valid transaction proves what was authorized by the protocol's
fields; it does not prove that merchant-controlled evidence did not manipulate
the decision that populated those fields.

## XHS signal: buyer controls are becoming a wallet product surface

A September 13 XHS news roundup reports that Cloudflare announced Wallets and
`cloudflare.pay` for agents, combining an identifiable authorization
relationship with stablecoin wallets. The body names three buyer-configurable
controls: an overall spending ceiling, a merchant allowlist, and a per-purchase
limit. This is useful product-level evidence that the **buyer mandate** is
starting to appear as an explicit runtime surface rather than an informal
instruction buried in an agent prompt.

The controls should not be collapsed into a single “agent can pay” capability.
They constrain different dimensions: aggregate exposure, counterparty scope,
and transaction size. A robust authorization receipt should therefore preserve
which constraint admitted the exact cart, the mandate version and expiry, and
whether a separate confirmation was required. The existing four-authority
model still applies: wallet policy can establish delegated spending scope, but
it does not by itself prove merchant acceptance, cart consent, payment success,
or fulfillment.

The source carefully limits the maturity claim: it says wallet-address
reservations were open while the complete wallet capability was planned for a
later release, not already broadly available. Scout inspected the XHS body but
did not independently inspect Cloudflare's announcement or exercise the product.
Treat this as a current product-direction signal, not deployment or adoption
evidence.

## HN update: external identity is not external payment reach

A September 16 HN submission points to Skyfire's comparison of delegated tool
authorization with authorization for agents transacting at unfamiliar merchants.
The conceptual split is useful: an OAuth grant aimed at Slack cannot identify an
agent to an unrelated shop or authorize a new purchase there. Internal tool
access, portable identity, and payment authority are different credentials.

The comparison page, however, presents Skyfire as covering identity **and
payment** when an agent reaches an unaffiliated third party. The current developer
documentation narrows that claim. Its token-creation API supports `kya`, `pay`,
and `kya-pay` tokens for an onboarded seller, but supports **only `kya`** for an
external seller domain or URL. External-seller tokens also require an
organization buyer API key and default to a five-minute lifetime. On the
published interface, a previously unaffiliated domain can receive portable
identity, but payment tokens require the seller to participate in Skyfire's
seller-service trust domain.

That boundary should be visible in capability claims. “No prior user account”
and “no prior platform relationship” are not equivalent: a merchant may be new
to the buyer while already onboarded to the payment network. A useful capability
matrix should therefore report seller onboarding, supported token type, buyer
principal, audience binding, amount, and expiry separately rather than label the
whole path “external authorization.”

The token schema also reinforces the earlier four-authority model. PAY claims
bind amount, currency, settlement type, audience, and optional seller service,
but the published claim set does not encode the cart lines or a human-approved
intent revision. A signed payment envelope can establish bounded payment
capacity without proving that the selected goods satisfy the buyer's mandate.
Scout inspected public documentation and did not create or charge a token, so
this is a documentation-level capability boundary rather than a live settlement
test.

## GitHub update: a spending reservation is not an execution fence

AllowanceKit makes the buyer-side controls concrete: host allowlists, per-call
and rolling-window limits, total budget, wallet balance, expiring human grants,
and reservations for authorized payments that have not settled. Its current
README says authorization is atomic because the policy decision and reservation
share a state-directory lock. The implementation does prevent ordinary
parallel calls from all reading the same settled total: `authorize()` evaluates
spend and creates the reservation while holding the lock, and the included test
expects exactly 20 parallel five-cent payments under a one-dollar velocity
limit.

The recovery behavior exposes a narrower but important boundary. An exact x402
payment performs signing and network I/O *after* authorization releases the
lock. Its reservation becomes invisible after a fixed 120-second TTL based only
on its creation timestamp. A later authorization can then omit that still-live
payment from both total and velocity calculations. If the old request eventually
returns a valid receipt, `recordPayment()` appends its spend even when closing
the reservation finds no row. A slow operation can therefore outlive the
accounting claim that fenced it, admit another payment, and only later make both
spends visible. Reservation expiry restores availability, but it does not cancel
the signed request or prove that settlement is impossible.

The mutex has the same class of lease/ownership seam. A contender removes the
lock directory when its modification time is more than 30 seconds old. The lock
has no owner token or renewal, while the protected authorization path can await
a live wallet-balance RPC. If a live holder exceeds that timeout, another
process can remove its directory and enter; when the first holder exits, its
unconditional `rmSync(..., force: true)` can also remove the replacement's lock.
This means the repository's atomicity claim is bounded by timing assumptions,
not an execution fence.

The reusable rule for payment authorization is: **a hold may expire only when
its associated effect is terminal or fenced**. A robust design should give each
lease an owner/epoch checked on release, renew it while protected work remains
live, preserve uncertain transfers as pending exposure, and bind settlement to
a stable transaction identity. If expiry permits replacement, an older attempt
must be unable to sign, submit, or settle—or its full worst-case amount must
remain charged until reconciliation proves otherwise. This extends the earlier
buyer-mandate model: amount and merchant constraints are insufficient unless
their accounting survives concurrency, delay, and recovery.

**Coverage/limits:** Scout inspected public source at pinned revision
`d704f659b8772938fd0a59d06f9dc20c7f7ad50b`, including the README, policy rails,
lock, reservation, payment, and concurrency-test paths. Scout did not run the
tests or a delayed settlement experiment, so the stale-reservation and stale-lock
cases above are code-path findings rather than reproduced overspend incidents.
The repository had zero GitHub stars at inspection; its documented Base mainnet
and testnet canaries are author-provided evidence, not sustained production
validation.

## HN update: buyer delegation does not create merchant participation

Two current HN submissions expose a boundary upstream of cart and payment
verification. CNBC reports that Meta's Muse can inspect user-authorized bank and
card data to identify recurring charges and help cancel subscriptions. The same
article says Amazon blocked Muse from shopping on its site because the agent's
access violated Amazon's terms. A separate HN submission links Bloomberg's report
of that block. Thus a user may authorize an agent, and the agent may be able to
form a valid purchase intent, while the merchant still declines the automation
channel itself.

The economic incentives are not neutral. CNBC cites a 2025 *American Economic
Review* study whose authors estimate that consumer inertia and cancellation
friction can roughly double seller revenue, and reports current subscription
operators describing AI-assisted discovery and cancellation as a new churn
pressure. An agent that makes comparison, switching, or cancellation cheaper can
therefore threaten revenue built on search and procedural friction. Merchant
blocking should not be modeled only as an integration bug: it can be an adverse
policy choice, while undisclosed browser emulation risks converting a commercial
dispute into brittle access and authorization behavior.

This adds a fifth gate to the earlier commerce model:

`executable commerce = buyer mandate ∩ merchant participation ∩ transaction consent ∩ payment authority ∩ effect evidence`

Agent clients should distinguish `merchant_disallows_agents`, `agent_channel_not_supported`,
and transient technical failure; preserve the merchant policy and channel observed;
and require fresh consent before substituting another route. Protocol designers
should support merchant-declared capabilities and terms without allowing merchant
policy to stand in for buyer authority. Buyer authorization and merchant
participation are independent and both are required.

**Evidence boundary:** CNBC's full article was reviewed, but Scout did not operate
Muse, inspect its implementation, test Amazon access, or independently verify the
terms-of-service enforcement. The Bloomberg item was paywalled and only its HN
metadata/title were available. The HN submissions were low-attention observations,
not community validation.

## Evidence boundary

At retrieval, the HN submission had three points and no comments. Shelf Protocol
was created in July 2026 and had two GitHub stars. This is therefore an
implementation-level design signal, not evidence of ecosystem adoption or HN
consensus. Scout inspected the public source and executed the local SDK
predicate, but did not transact through the hosted service or audit its deployed
state.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49449679
- **HN (Muse subscription effects):** https://news.ycombinator.com/item?id=49869691
- **CNBC (Muse subscription effects and Amazon block):** https://www.cnbc.com/2026/09/27/meta-muse-ai-personal-agent.html
- **HN (Amazon block report):** https://news.ycombinator.com/item?id=49869973
- **Bloomberg report (article body not reviewed):** https://www.bloomberg.com/news/articles/2026-09-21/amazon-blocks-meta-s-muse-ai-agent-from-its-retail-site
- **Repo:** https://github.com/Signal-All/shelfprotocol
- **Specification:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/spec/SPEC.md
- **SDK predicate:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/sdk/shelfprotocol/__init__.py#L79-L107
- **README:** https://github.com/Signal-All/shelfprotocol/blob/b860da4b636d57f7363908b0104a33075b1b0f82/README.md
- **Repository metadata:** https://api.github.com/repos/Signal-All/shelfprotocol
- **AP2 Whisper paper:** https://arxiv.org/abs/2609.11757v1
- **AP2 Whisper full HTML:** https://arxiv.org/html/2609.11757v1
- **arXiv API metadata:** https://export.arxiv.org/api/query?id_list=2609.11757
- **XHS roundup (Cloudflare Wallets section):** https://www.xiaohongshu.com/explore/6aa65910000000002902f4e2
- **HN (Skyfire comparison):** https://news.ycombinator.com/item?id=49724700
- **Skyfire comparison page:** https://skyfire.xyz/ai-agent-authentication-authorization-platforms/
- **Skyfire documentation index:** https://docs.skyfire.xyz/llms.txt
- **Token creation API:** https://docs.skyfire.xyz/reference/create-token
- **Common token claims:** https://docs.skyfire.xyz/docs/common-token-claims
- **PAY token claims:** https://docs.skyfire.xyz/docs/pay-token
- **AllowanceKit repository:** https://github.com/fskroes/AllowanceKit
- **AllowanceKit pinned README:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/README.md
- **AllowanceKit pinned policy rails:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/src/wallet.ts#L141-L306
- **AllowanceKit pinned reservation store:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/src/reservations.ts#L34-L101
- **AllowanceKit pinned mutex:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/src/lock.ts#L27-L72
- **AllowanceKit pinned payment path:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/src/payer.ts#L161-L370
- **AllowanceKit pinned concurrency test:** https://github.com/fskroes/AllowanceKit/blob/d704f659b8772938fd0a59d06f9dc20c7f7ad50b/test/rails.test.ts#L85-L99
