# Common-Sense Follow-up Items

From the review on 2026-04-19.

## To Address

1. **Preferred workflows section** — common-sense references "Your preferred workflows are listed in a separate section of your context" but this section doesn't exist yet in the system prompt. Implement the replaceable slot per context-injection-design.md, or remove the line until implemented.

2. **No mention of finish()** — the draft removed all finish() rules (guard-enforceable). But agents may need to understand finish() exists and how to use it. Consider adding one line: "End your work with finish() — the status you choose (success/partial/blocked) matters." Verify guards cover the operational rules first.

3. **Project status details** — the 5-status list is in common-sense. Could move to `agents/shared/may-agent-docs/architecture/` if common-sense should be purely about thinking patterns. But it's only 5 lines and agents need it — low priority.

4. **Cross-agent help list** — hard-codes agent roles (scout=research, coach=training, etc.). If roles change, this becomes stale. Low risk for now.
