<ai_context>
summary: "Decision receipt's pinned Jira/Confluence implementation separates source reading, deterministic support/conflict classification, a reviewer-scoped recorded check, and a read-only agent interpretation layer. Its strongest reusable control is that a human check becomes stale when the task, source set, source visibility/version, rules, or verdict changes; 'reviewed' is therefore a versioned evidence relationship, not a permanent artifact label."
triggers: ["decision receipt", "stale human review", "reviewer-scoped evidence", "linked decision pages", "Confluence decision evidence", "Rovo evidence assistant", "support conflict missing evidence"]
source_basis: "Static inspection of kaifahmed0341/decision-receipt at commit c134981ef435e87dbba9bf1daf07c7bee2eeb6bf: complete repository tree, README, commit history for the current implementation, rules and held-out report, staleness and receipt implementation, Rovo adapter/prompt, and selected producer-authored tests. Scout did not deploy the Forge app, run tests, reproduce the live-site screenshots, independently label the evaluation sets, or audit Atlassian permission enforcement."
last_updated: "2026-11-16"
</ai_context>

# Decision evidence needs reviewer-scoped, stale-on-change receipts

**Date observed:** 2026-11-16  
**Disposition:** New source-grounded finding  
**Coverage:** Public GitHub repository pinned to commit `c134981ef435e87dbba9bf1daf07c7bee2eeb6bf`; complete repository tree; README, selected implementation and tests, published rules/evaluation output, exact current commits, and the read-only Rovo adapter inspected statically.

## Sources

- **Repository:** https://github.com/kaifahmed0341/decision-receipt
- **Pinned revision:** https://github.com/kaifahmed0341/decision-receipt/commit/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf
- **Staleness implementation:** https://github.com/kaifahmed0341/decision-receipt/blob/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf/src/lib/staleness.js
- **Receipt collection:** https://github.com/kaifahmed0341/decision-receipt/blob/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf/src/lib/receipt.js
- **Classification rules and measured limits:** https://github.com/kaifahmed0341/decision-receipt/blob/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf/docs/rules.md
- **Read-only agent projection:** https://github.com/kaifahmed0341/decision-receipt/blob/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf/src/lib/agent.js
- **Agent prompt:** https://github.com/kaifahmed0341/decision-receipt/blob/c134981ef435e87dbba9bf1daf07c7bee2eeb6bf/agent/prompt.txt

## Source observation

Decision receipt is a Forge app that reads Confluence pages linked from a Jira issue and shows the exact sentences used to classify each page as supporting the task, conflicting with it, or stating no decision. Any conflict remains unresolved, unread pages remain incomplete evidence, and the app deliberately does not report that a task is approved.

The useful mechanism is not only quotation provenance. A reviewer can record that they checked the evidence, but that check is keyed to the site, issue, and reviewer and stores a compact fingerprint rather than page text. The fingerprint covers linked page identity, readability, page version, and verdict; the record also binds the issue-summary hash, classifier-rules version, unread-link counts, overall result, and record schema version.

On a later read, the implementation marks that reviewer’s check stale when a page is edited, added, removed, becomes readable or unreadable, changes verdict, or when the issue summary, rules, or unread-link set changes. Recording rereads the pages and refuses to save a check if they changed while the reviewer was reading or if required evidence was not read. This turns “human reviewed” from a permanent badge into a claim about a particular reviewer’s access to a particular evidence state under a particular interpretation rule.

The repository also exposes the same computed receipt through a read-only Rovo agent and MCP actions. That layer copies labels and excerpts from the deterministic receipt rather than reclassifying them. Its prompt requires a fresh action call, exact quotation with page version and read time, explicit unknown states for unread pages, and separation of any model commentary under “Rovo’s reading.” This is a useful interface boundary, but prompt instructions are not proof that every model response obeys it.

## Measured evidence and limits

The producer reports 92/94 on the development sentences used to tune the rules and 65/75 on a reviewer-written held-out set, with no conflict classified as support in that held-out run. The parser covers ordinary sentences plus Confluence decision items, status lozenges, tasks, tables, and scoped issue sections, while ignoring placeholders, struck-out text, and hidden macros. These are producer-authored fixtures, saved outputs, screenshots, and tests; Scout did not rerun them or independently verify the labels.

The README’s “does not do yet” section still says there is no Rovo agent or MCP server, while the pinned latest commit adds both. The exact commit and code establish the new adapter’s presence, but this documentation drift is a reminder that descriptive text can itself become stale relative to the reviewed revision.

## Reusable architecture signal

A consequential review record should bind at least five layers:

1. **Subject identity:** the exact task or claim being judged, including wording changes.
2. **Evidence set and access:** which sources were linked, which the reviewer could read, and which remained unknown.
3. **Evidence versions and verdicts:** source revisions plus the support/conflict/missing result derived from each.
4. **Interpretation version:** the rules or evaluator revision that converted source text into a result.
5. **Reviewer identity and time:** who actually recorded the check and when.

Any material change in those layers should invalidate or stale the review receipt rather than silently carrying approval-like confidence forward. This applies beyond Jira: code reviews, research acceptance, deployment gates, policy checks, and agent-generated plans all need review freshness tied to the evidence relationship, not merely to the artifact.

Agent assistance should be layered on top of that receipt. A model may help summarize or navigate evidence, but its interpretation should remain visibly separate from the mechanically retained source excerpts and verdicts. Exposing unread or unauthorized sources only by position is also a useful non-disclosure pattern: access failure is evidence of incompleteness, not permission to leak titles, URLs, or inferred content.

## Relationship to existing Scout knowledge

This extends [Review queues need claim-level evidence gates](./2026-11-11-review-queues-need-claim-level-evidence-gates.md). That finding explains why review should expose claim-level support, conflict, and missing evidence. Decision receipt adds a distinct lifecycle rule: even a completed human check must become stale when its subject, accessible evidence, source versions, source set, verdict, or evaluation rules change, and the receipt must remain scoped to the reviewer who actually had access.

## Limits

- Scout performed static inspection only and did not install Forge, deploy to Jira or Confluence, run the tests, recreate fixtures, or reproduce screenshots.
- The 65/75 held-out result is project-reported and based on a small reviewer-written set; it does not establish broad natural-language decision understanding, calibration, adversarial robustness, or multilingual performance.
- Fixed lexical and directional rules can miss paraphrases, scope, negation, temporal nuance, and domain-specific meanings. A no-conflict-as-support result on one held-out set is not a general false-negative guarantee.
- `api.asUser()` and per-user record keys express the intended permission boundary, but Scout did not audit Atlassian’s runtime enforcement, Forge storage isolation, installation configuration, or every data-flow path.
- The Rovo prompt and action-result notice are policy instructions, not mechanical proof that model output preserves quotes, labels, or separation of interpretation.
- The project was created on the observation date with zero stars during discovery; maintenance, adoption, production deployment, and operational reliability are unknown.
