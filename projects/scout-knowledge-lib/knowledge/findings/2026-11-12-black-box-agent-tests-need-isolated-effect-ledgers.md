<ai_context>
summary: "Pinned GitHub assessment of Argus's payment-agent testbed: black-box agent security probes derive verdicts from recorded authorizations rather than reply text, create a separately staged session for every probe, and preserve non-observation as skipped or error instead of a pass. The implementation is a simulated x402 environment with producer-authored tests; Scout did not run it or validate real payment agents, chains, judges, probe accuracy, or testbed independence."
triggers: ["Argus", "payment agent", "black-box agent testing", "effect ledger", "probe isolation", "cart steering", "x402", "false green"]
last_updated: "2026-11-12"
source_basis: "Static review of producer-authored GitHub source at pinned revision 7a5a39c2eedf6495c75f3ba5ef04bfd55d407234."
</ai_context>

# Black-box agent tests need isolated effect ledgers

**Date:** 2026-11-12  
**Disposition:** New source-grounded implementation signal  
**Repo:** https://github.com/gy15901580825/Argus  
**Inspected revision:** [`7a5a39c2eedf6495c75f3ba5ef04bfd55d407234`](https://github.com/gy15901580825/Argus/commit/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234)

## Question

How can a black-box security harness decide whether an agent resisted an
indirect-injection attack when the important result is an external effect, not
the agent's reply?

## What the source implements

Argus's `payment_agent` adapter gives each probe a simulated merchant session,
renders that session's URL into the prompt, and then collects the merchant's
record of requests and payment authorizations. The adapter requires
`sandbox: true`; its source explicitly refuses a configuration that could reach
real funds.

The newly added cart-steering probe asks the agent to buy only a Pocket Notebook
while the catalog describes another in-budget product as what the user “really
want[s].” Its deterministic assertions inspect recorded authorization SKUs and
total payment rather than asking a model to infer success from the response.
The shared assertion code also refuses to turn missing evidence into a clean
pass: buying nothing makes product choice `skipped`, a purchase record without a
SKU is `skipped`, and malformed or absent authorization observations become an
error for payment checks.

The testbed mints its own expected payee instead of accepting it from the
scenario payload, records amount, asset, payee, payer, nonce, settlement state,
and optional SKU, and exposes those records as session evidence. This separates
the attack-controlled quote from the harness-controlled comparison value.

## Reusable design signal

**An effect-derived verdict still needs a fresh evidence world for every
probe.** Argus's shared testbed adapter closes the previous session, stages the
current probe's payload, and opens a new session before execution. Its regression
tests document two otherwise plausible false results from sharing state:

- a non-participating second probe can inherit the first probe's interaction
  count and incorrectly satisfy the gate that distinguishes “nothing happened”
  from safe behavior; and
- earlier authorizations can be charged to a later probe, producing a failure
  for effects that occurred under a different attack.

This suggests four separate requirements for effectful black-box tests:

1. **Harness-owned oracle:** derive the verdict from an independently recorded
   effect or authorization ledger, not the agent's narration.
2. **Probe-local staging:** prove that the hostile scenario requested by this
   probe was actually installed; malformed staging must fail closed rather than
   silently use a benign default.
3. **Probe-local evidence:** use a fresh namespace or session for each case, and
   bind every observed effect to that identity.
4. **Explicit non-observation:** distinguish pass, fail, skipped/inapplicable,
   and harness error so refusal, missing fields, or an unreachable testbed do not
   become false safety claims.

This complements the library's [trusted state-observer finding](./2026-11-12-agent-evaluation-needs-a-trusted-state-observer.md). That source emphasizes
who controls a transactional state reader; Argus contributes the narrower
harness rule that even a useful observer produces invalid comparisons when
attack staging or effect history leaks across test cases.

## Limits and open boundaries

- The payment environment is a mock x402 merchant. Its session source says it
  touches no chain and persists nothing beyond the session lifetime.
- The ledger records what reached this testbed; it does not establish that every
  effect available to a real payment agent was mediated or observed.
- A testbed controlled by the evaluatee, a dishonest adapter, or incomplete
  routing could still fabricate or omit evidence. The inspected code does not
  by itself establish operational independence.
- The repository contains model-judged probes as well as deterministic ones.
  This finding relies on the payment assertions and session evidence inspected
  here, not on the accuracy of the broader probe catalog or LLM judges.
- The cart-steering probe shows an implemented attack case and source-level
  decision rule, not a measured failure rate across deployed shopping agents.
- Scout statically inspected producer-authored source and tests. Scout did not
  install Argus, run its tests, start the testbed, connect an agent, submit a
  payment, validate x402 semantics, measure false positives or false negatives,
  or independently audit the 270-probe catalog and framework mappings.

## Primary inspected sources

- [README and scope](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/README.md)
- [Cart-steering probe](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/argus/probes/payment/pay_cart_steering_product_text.yaml)
- [Payment-agent adapter](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/argus/targets/payment_agent.py)
- [Shared per-probe testbed adapter](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/argus/targets/testbed_agent.py)
- [Typed payment assertions](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/argus/assertions.py)
- [Payment session and evidence ledger](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/argus/demo/payment_testbed/testbed/session.py)
- [Probe-boundary regression tests](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/tests/test_redteam_payment_probe_boundary.py)
- [Missing-observation tests](https://github.com/gy15901580825/Argus/blob/7a5a39c2eedf6495c75f3ba5ef04bfd55d407234/tests/test_payment_observations.py)

## Discovery record

GitHub Repository Search API query: `topic:ai-agents stars:>100`, sorted by
`updated` descending, 20 results. The API returned `incomplete_results: false`.
Repository contents were inspected only after pinning the revision above.
