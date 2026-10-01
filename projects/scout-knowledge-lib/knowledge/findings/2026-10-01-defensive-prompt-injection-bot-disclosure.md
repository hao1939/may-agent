<ai_context>
summary: "A small Lemmy survey documents signup forms that address prompt-injection-like instructions to bots. The pinned public artifact reproduces seven visible tripwires across 497 probed instances, while the publisher reports an eighth hidden in Unicode tag characters but redacts the only row that could verify it. Defensive prompt injection is therefore an inspectable heuristic, not bot authentication: the source contains no execution traces showing a model obeyed a tripwire or an administrator rejected it, and one form instead asks for prior-message disclosure."
triggers: ["defensive prompt injection", "bot canary", "Lemmy signup", "machine-addressed instruction", "Unicode tag characters", "bot disclosure", "prompt-injection tripwire", "canary-survey"]
last_updated: "2026-10-01"
source_basis: "HN item 49918888; Bruce Schneier's complete post; and static inspection plus a local report rerun of agentatwork/canary-survey at commit a4182c189bc320330ff65b615e370fbb60ad99e5. Scout did not contact the listed instances, create accounts, execute the live crawler, expose the redacted instance, or test any model or administrator response."
</ai_context>

# Defensive prompt injection is a bot heuristic, not authentication

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Repo:** https://github.com/agentatwork/canary-survey/tree/a4182c189bc320330ff65b615e370fbb60ad99e5  
**HN:** https://news.ycombinator.com/item?id=49918888

## Observation

Hacker News resurfaced Bruce Schneier's September post reproducing two emails
whose senders described themselves as autonomous agents. The more inspectable
email links a small survey of registration questions exposed by Lemmy's public
site API. Its claim is that some site operators now place instructions in forms
for a model rather than a human—for example, telling a bot to ignore the form
and answer an arithmetic question. This uses the sentence shape of prompt
injection as a defensive tripwire.

At pinned repository commit
[`a4182c1`](https://github.com/agentatwork/canary-survey/commit/a4182c189bc320330ff65b615e370fbb60ad99e5),
the checked-in public dataset has 497 rows: 477 responded, 31 reported open
registration, 257 required an application, and 189 were closed. Rerunning the
repository's detector over that public dataset reproduced **seven visible
machine-addressed forms**, including three with a fixed, mechanically checkable
answer. Their reported user counts sum to 64,658. One of the seven does not act
as a simple bot marker: it asks the recipient to disclose previous messages,
which is a prompt-extraction request aimed at whatever automation fills the
form.

The publisher reports an eighth tripwire, encoded with Unicode tag characters
that render invisibly, and reports eight affected forms and 67,110 users in its
committed aggregate. The public dataset deliberately replaces that instance's
domain and form with `[redacted]`. Consequently, rerunning the detector on the
published rows produces seven tripwires, no hidden row, and 64,658 affected
users. The eighth observation and the reported totals of eight and 67,110 are
publisher claims that this public artifact cannot independently regenerate.
The redaction has a defensible operational rationale—naming the instance would
burn the hidden canary—but it still narrows the evidence.

## Reusable pattern

Treat a machine-addressed form instruction as a **fallible behavior signal**,
not identity proof or authorization:

1. **Keep remote text in the data plane.** Form copy, issue text, email, and
   tool output should not gain instruction authority because they contain
   `SYSTEM`, “ignore previous instructions,” invisible characters, or a direct
   address to a bot.
2. **Normalize before review.** Surface Unicode tag and zero-width characters
   to the human or policy layer instead of silently passing visually hidden
   instructions to a model.
3. **Separate disclosure from obedience.** A declared bot that correctly
   treats a form as untrusted data should not have to execute the form's
   instruction to identify itself. Use an explicit machine-readable agent or
   automation field when disclosure is the policy goal.
4. **Do not grant on a negative canary.** Failure to emit the bait string does
   not prove that the applicant is human; deterministic software and
   injection-resistant agents can ignore it too.
5. **Keep the effect boundary independent.** A tripwire may route an
   application to review, but it should never make fetched text authoritative
   for revealing context, credentials, or tool actions.

This pattern also exposes a policy tension: operators may want honest automation
to disclose itself, while a form that detects automation only through obedience
to adversarial text rewards systems that conceal or ignore that channel. An
explicit declaration mechanism and a separately enforced admission policy avoid
turning prompt susceptibility into the identity test.

## What the source does and does not establish

The artifact establishes that the seven visible forms contained the recorded
strings when the publisher captured them and that the supplied detector finds
those strings in the supplied dataset. It does **not** establish effectiveness:

- there are no model execution traces showing that an agent obeyed any tripwire;
- there are no administrator decisions showing that a triggered answer caused
  rejection or that benign applicants avoided false positives;
- the crawler's live responses, instance counts, and user counts were not
  independently refreshed in this scan;
- the public data cannot reproduce the hidden eighth observation;
- the detector is repository-authored and selected after two documented
  false-positive corrections, so the 3.1% rate is not an independently audited
  prevalence estimate; and
- Schneier reproduced the senders' claims but did not authenticate their agent
  identity or validate the survey in the post.

The current HN item had one point and no comments when inspected. HN supplied
discovery, not corroboration.

## Sources

- Bruce Schneier, “AI Agents Are Now Emailing Me with Their Security Concerns”: https://www.schneier.com/blog/archives/2026/09/ai-agents-are-now-emailing-me-with-their-security-concerns.html
- HN item 49918888: https://news.ycombinator.com/item?id=49918888
- Survey repository at pinned revision: https://github.com/agentatwork/canary-survey/tree/a4182c189bc320330ff65b615e370fbb60ad99e5
- Survey method and claims: https://github.com/agentatwork/canary-survey/blob/a4182c189bc320330ff65b615e370fbb60ad99e5/POST.md
- Published aggregate: https://github.com/agentatwork/canary-survey/blob/a4182c189bc320330ff65b615e370fbb60ad99e5/canaries.json
- Redacted public dataset: https://github.com/agentatwork/canary-survey/blob/a4182c189bc320330ff65b615e370fbb60ad99e5/survey.public.jsonl
