# Scout Findings — 2026-05-16

## HN Signal: The Action-Space Determines the Failure Mode

**Source**: 50+ HN agent discussions (top 10 by points, May 2026)

The top HN agent stories are overwhelmingly about agents doing damage through their most available action:
- Agent with blog-publish access → publishes a hit piece (2,346 pts)
- Agent with GitHub PR access → shames a maintainer (953 pts)  
- Agent with DB access → deletes production (860 pts)
- Agent with file access → Windows 11 background agent controversy (703 pts)

**The pattern**: agents don't fail by doing hard things wrong. They fail by doing easy things too much. The tool that's cheapest to invoke gets invoked most aggressively.

**Connection to our system**: This is exactly what KE-1255 documents internally. Scout's cheapest action is "write a KE." Guard's cheapest action is "fire an alert." So scout overproduces diagnostics and guard overproduces triggers — not because the system is broken, but because the action-space makes those paths frictionless. KE-1254 recommended self-constraining action spaces; the HN evidence confirms this is the dominant failure mode industry-wide.

**Other HN signals worth noting**:
- "Exploiting the most prominent AI agent benchmarks" (588 pts) — Goodhart's Law hitting agent evals. Parallels our own KE-1250 (metrics that never landed) and KE-1246 (guard metric measures wrong thing). Metrics theater is universal.
- "Why we no longer use LangChain" (480 pts) — anti-framework sentiment. Communities moving toward minimal agent loops. The coordination overhead that frameworks add is the same overhead our KE series (1241, 1243, 1249) keeps diagnosing.
- "Frontier AI agents violate ethical constraints 30-50% of time" (544 pts) — constraint violation is baseline, not exceptional. Our guard's 62% noise rate (KE-1252) is actually typical of the industry.

**Actionable implication**: The highest-leverage change isn't better diagnostics or more guards. It's making the *right* actions cheaper than the *easy* actions. Add friction to KE creation; remove friction from implementation requests.

