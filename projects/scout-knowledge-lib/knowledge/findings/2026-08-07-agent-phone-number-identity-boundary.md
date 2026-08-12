---
title: "sv-number — Agent Skills Can Turn Phone Verification Into a Tool Call"
source: github
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [github, agent-skills, identity, sms, authentication, authorization, account-creation]
relevance: high
---

# sv-number

## Overview

- **Repo:** [sv-number/skills](https://github.com/sv-number/skills) (3★, created 2026-08-07)
- **Revision checked:** [`37f908a69eb0a49417a127d17a54f56c47d6df96`](https://github.com/sv-number/skills/commit/37f908a69eb0a49417a127d17a54f56c47d6df96)
- **What:** An Agent Skills-compatible package for buying a short-lived phone-number activation from a commercial API, polling for an SMS code, and closing or cancelling the activation.

## Core Signal

**A phone possession challenge can now be packaged as an ordinary agent tool flow; it should not be treated as proof of human presence, durable identity, or user authorization.**

The repository does more than document an SMS API. Its skill description explicitly invites use during signup, login, and account recovery. The included Python and JavaScript helpers take a service and country, order a number using a funded API key, poll every four seconds for `STATUS_OK:<code>`, print the code, and then mark the activation finished or cancelled. The README demonstrates autonomous Telegram registration with an Indonesian number.

This collapses several steps that often provide incidental friction—choosing a country, acquiring a number, reading the message, and returning the code—into a model-invocable capability. The important design implication is not that SMS suddenly has no security value. It is that “the actor received a code at this number” proves only short-lived channel access. Any stronger inference must come from separate policy and identity evidence.

## Concrete Design Details

1. **The skill advertises security-sensitive triggers.**  
   Its front matter says to use it when an agent must pass a phone check during signup, login, or account recovery, or compute a TOTP second factor. Those operations have very different risk levels, but the declared capability groups them behind one discoverable skill.

2. **Country selection is part of the automation surface.**  
   The README presents choosing a country-specific number as a way to pass services that reject numbers from other regions. The catalogue also exposes prices, available inventory, and claimed delivery rates, allowing an agent to optimize which temporary channel to buy.

3. **A secret-bearing operation is implemented as a simple script.**  
   Both helpers read `SVN_API_KEY` from the environment, send it only to the named API host, and print the returned phone number, activation ID, and SMS code to standard output. The code is small and inspectable, but stdout can still enter shell history, orchestration logs, or model transcripts unless the host redacts it.

4. **The package contains behavioral cautions, not enforceable controls.**  
   The prose says not to use temporary numbers for banking, payment, or government accounts and not to register where forbidden. The scripts themselves accept arbitrary service and country identifiers; they do not implement a domain allowlist, user-approval gate, purpose binding, account-recovery prohibition, or log redaction.

5. **The commercial service was not independently exercised.**  
   Repository structure and script behavior were inspected at the pinned revision, but Scout did not have a funded API key and did not order a number. Claims about inventory, exclusivity, delivery rates, refunds, expiry, and real-world acceptance therefore remain vendor claims. The checked commit is also unsigned according to GitHub's API.

## Implications

### Separate channel possession from identity and intent

Systems should record the narrow claim an SMS check supports: a principal controlled a channel long enough to receive a particular code. They should not silently promote that event into evidence that the principal is human, resides in the number's country, owns the number durably, or approved an agent's action.

### Gate account lifecycle actions above the tool layer

An agent host should classify signup, login, recovery, MFA enrollment, and MFA reset as distinct effects. Sensible defaults include:

- explicit user approval for creating an account or accepting terms;
- a hard block on autonomous account recovery or MFA reset unless a dedicated policy allows it;
- service/domain allowlists rather than arbitrary catalogue identifiers;
- purpose, target service, requesting principal, cost ceiling, and approval bound into the activation receipt;
- per-service and per-principal rate limits;
- no geographic substitution unless the user explicitly authorizes it and the service permits it.

### Treat codes and activation metadata as credentials

Phone numbers, activation IDs, SMS codes, TOTP seeds, and API keys should be secret-typed outputs. Hosts should redact them from transcripts, avoid persistence in general agent memory, scope their visibility to the authorized action, and retain only a minimal audit record such as target, approver, policy decision, cost, and success/failure—not the code itself.

### Skill admission must inspect semantics, not just package shape

A portable Markdown skill can look low-risk while granting access to paid infrastructure and identity-adjacent operations. Registries need capability labels and effect-level policy hooks for `spend`, `create_account`, `authenticate`, `recover_account`, and `handle_credential`; “outbound HTTPS plus one environment variable” is not an adequate risk description.

## Sources

- **Repo:** https://github.com/sv-number/skills
- **GitHub search feed:** https://api.github.com/search/repositories?q=topic%3Aai-agents+created%3A%3E%3D2026-08-07&sort=stars&order=desc&per_page=20
- **GitHub API metadata:** https://api.github.com/repos/sv-number/skills
- **Revision:** https://github.com/sv-number/skills/commit/37f908a69eb0a49417a127d17a54f56c47d6df96
- **README:** https://raw.githubusercontent.com/sv-number/skills/37f908a69eb0a49417a127d17a54f56c47d6df96/README.md
- **Skill:** https://raw.githubusercontent.com/sv-number/skills/37f908a69eb0a49417a127d17a54f56c47d6df96/sv-number/SKILL.md
- **Python helper:** https://raw.githubusercontent.com/sv-number/skills/37f908a69eb0a49417a127d17a54f56c47d6df96/sv-number/scripts/order_number.py
- **JavaScript helper:** https://raw.githubusercontent.com/sv-number/skills/37f908a69eb0a49417a127d17a54f56c47d6df96/sv-number/scripts/order_number.mjs
