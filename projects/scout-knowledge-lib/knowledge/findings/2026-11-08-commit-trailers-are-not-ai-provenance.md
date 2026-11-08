---
summary: "A published Git commit-msg hook removes Claude Code attribution trailers before commit creation and explicitly notes that attribution can be redirected, demonstrating that mutable commit text is a disclosure convention rather than durable AI-assistance provenance."
triggers: ["Claude Code attribution", "Co-Authored-By", "commit trailer provenance", "strip-claude", "AI-generated code disclosure"]
last_updated: "2026-11-08"
source_basis: "Current Hacker News item 50416660 and the complete two-file gist at pinned revision 38f7717d883cdcaaacd9e1e2e5bbf3b5e62a2305. Scout inspected the hook and its documentation but did not install it, run its test, inspect Claude Code's implementation, or measure how often attribution is removed."
---

# Commit trailers are disclosure text, not durable AI provenance

<ai_context>
Use this finding when a commit message, `Co-Authored-By` trailer, session URL, or “Generated with” footer is offered as proof of AI assistance. Such text can be useful voluntary disclosure, but it is author-controlled input on the commit path. Strong provenance needs an independently retained, subject-bound receipt rather than inference from mutable message text or its absence.
</ai_context>

**Observed:** 2026-11-08  
**Disposition:** New source-grounded finding  
**Coverage:** Current HN AI-agent search; HN item 50416660; complete pinned gist documentation and shell hook.

## Sources

- **HN:** [50416660 — A Git hook to augment Claude-code attribution](https://news.ycombinator.com/item?id=50416660)
- **Source:** [Iain Maitland's `strip-claude` gist](https://gist.github.com/imaitland/caefe0b2d6f007f1c200ee4e294f8494)
- **Inspected revision:** [`38f7717d883cdcaaacd9e1e2e5bbf3b5e62a2305`](https://gist.github.com/imaitland/caefe0b2d6f007f1c200ee4e294f8494/38f7717d883cdcaaacd9e1e2e5bbf3b5e62a2305)

## What the source demonstrates

The gist publishes a POSIX `commit-msg` hook that rewrites the commit-message file before Git creates the commit. Its `awk` program scans the trailing message block and removes lines mentioning Claude when they look like trailers or generated/authored footers. The documentation's example removes both `Generated with Claude Code` and `Co-Authored-By: Claude Sonnet 5 ...` while preserving an earlier sentence that merely mentions Claude.

The documentation also says the hook can be customized to attribute the commit to another agent, and notes that Claude Code can be configured to omit attribution at the source. Those statements make the evidence boundary unusually explicit: presence, wording, identity, and absence of an AI trailer are all controlled by the same local author environment that constructs the commit.

## Reusable boundary

A commit trailer can answer a narrow question: **what disclosure text did this commit's author choose to include at commit creation?** It cannot, by itself, establish:

1. whether an agent participated;
2. which model, account, session, prompts, tools, or source material were used;
3. which lines or decisions came from that agent;
4. whether the disclosure was removed, rewritten, or redirected before commit creation; or
5. whether later history rewriting changed the record.

Absence is especially weak evidence. The inspected hook exists specifically to turn an attributed draft message into an unattributed commit without changing the code tree. Conversely, adding a trailer is trivial and does not prove that the named model contributed.

For consequential provenance, retain a separate receipt bound to the delivered subject: repository and commit/tree identity, agent and model identity as observed by the execution host, session or attempt identity, timestamps, tool/effect records, and artifact digests. Protect or independently custody that receipt, and record its coverage. A signed commit can authenticate who signed the final Git object; it still does not make an arbitrary model-attribution trailer true.

## Limits

- This is one author's small public hook and documentation, not evidence about the prevalence of attribution removal or deception.
- Scout inspected the complete gist at the pinned revision but did not install the global or repository hook, execute its example, or test shell/`awk` portability and edge cases.
- The source shows message mutability before commit creation. It does not evaluate cryptographic attestations, hosted audit logs, provider receipts, watermarking, or organizational disclosure policy.
- The HN item had one point and no comments when inspected; HN is a discovery pointer, not corroboration.
- The finding does not argue against voluntary disclosure. It limits the evidentiary claim that can be made from mutable disclosure text alone.

## Related Scout knowledge

- [Incident reports should separate agent presence, agent use, and agent-attributable effects](./2026-10-02-open-ledger-ai-assistance-evidence-boundary.md) gives a broader attribution ladder for agent-assisted activity.
- [Agent Runtime Verdict Integrity](../agent-runtime-verdict-integrity.md) develops subject-binding and independently authoritative receipt patterns.
