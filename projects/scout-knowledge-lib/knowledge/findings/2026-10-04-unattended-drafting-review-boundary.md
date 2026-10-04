<ai_context>
summary: "HN-linked Elves design moves approval from starting low-consequence drafting to releasing external effects, using connector write-tool denial, an explicit review queue, source-scoped reads, and traceable feedback distillation; the public artifact is a design seed rather than the author's running implementation, and it does not establish safe ingestion, complete connector denial, or field effectiveness."
triggers: ["unattended drafting", "review boundary", "approval placement", "proactive agent", "Elves", "write-tool denial", "feedback distillation"]
last_updated: "2026-10-04"
source_basis: "Complete HN-linked article plus README and idea file inspected at pinned repository revision 6595e7e146d3689be24b056f68c81623088d37be; no running implementation, tests, or field logs were public."
</ai_context>

# Unattended Drafting Moves the Review Boundary; It Does Not Remove It

## Finding

The HN submission “The Shoemaker's Elves” describes a small local harness that
periodically reads configured inboxes and calendars, triages new requests, and
produces drafts before its operator asks. Its useful design choice is not generic
“proactivity,” but **where it places the human gate**: scanning and drafting start
without approval, while sending, sharing, and other connector writes remain outside
the unattended run and require later review.

The pinned public design supports that boundary with several mutually reinforcing
mechanisms:

- one `config.yaml` names the inbound and context sources the agent may read;
- the headless scheduler receives an explicit allowlist containing read-only
  connector tools, while send, reply, forward, delete, calendar mutation, and other
  connector write tools are denied by the harness rather than discouraged only in a
  prompt;
- every surfaced task must contain a draft or recommendation and lead with an
  “Action taken” line, so review begins from an inspectable artifact;
- task status separates `drafted`, `approved`, and `shipped`, and `/todo done`
  refuses work that has not reached `approved`;
- source IDs, update timestamps, a `seen` table, and run watermarks are intended to
  make overlapping or repeated scans idempotent; and
- review feedback is preserved as raw, append-only input, then distilled into
  editable Markdown rules whose statements cite the raw record.

This is a concrete instance of **asymmetric autonomy**: automate the reversible,
inspectable preparation step while retaining human attention for the release of
external effects. It is more useful than asking for permission before every draft,
because that approval says little about the quality or consequences of the artifact
that will eventually be sent. A review gate after an artifact exists can evaluate
actual content.

## Boundary: “Nothing ships” is narrower than “nothing consequential happens”

The design's connector denylist improves effect control, but it does not make the
unattended half harmless. Scanning can expose sensitive messages to the model;
triage can omit an important request; calendar and message content can carry hostile
instructions; and local drafts, SQLite rows, raw feedback, and distilled people or
project profiles are durable data effects. The artifact says personal task data and
raw feedback should remain private and Git-ignored, but it does not specify content
sanitization, retention limits, encryption, provenance-aware prompt-injection
handling, or an independent audit of the effective post-composition tool set.

Tool denial also depends on resolving connector names correctly at runtime. The seed
warns that tool prefixes differ across hosts, but supplies no tested adapter or
proof that every mutation surface is classified. New or renamed connector tools,
generic browser or shell access, and local automations that can indirectly trigger
remote writes could bypass a name-based denylist unless the final effective
capability set is enumerated and tested. Idempotent queue insertion similarly does
not imply idempotent external release once a human later ships a draft.

A stronger operational rule is therefore:

1. classify effects by consequence, not merely by whether they are called “drafts”;
2. allow unattended work only within an enumerated read/local-write capability set;
3. audit the effective composed tools and indirect effect paths at each scheduled
   run revision;
4. bind human approval to the exact artifact revision and intended recipient or
   destination; and
5. keep intake, triage, retention, draft quality, and external release as separately
   observable outcomes.

## Evidence and limitations

Scout read the complete HN-linked article and the repository's README and 200-line
idea file at revision `6595e7e146d3689be24b056f68c81623088d37be`. The HN item had one
point and no comments at retrieval. The repository contains a design seed intended
to be handed to a coding agent; the author explicitly says the running implementation
is private because it contains real connectors and messages. No executable harness,
tests, task database, scheduler logs, connector policy dump, approval history, or
month-long quality measurements were available. Claims about the author's use and
scheduler behavior are therefore practitioner reports, not reproduced reliability,
safety, or productivity results.

The feedback-to-wiki loop is also a proposal in the public seed, not evidence that
distilled rules remain accurate over time. Citing immutable raw feedback improves
traceability but does not prove the derived rule is faithful, current, or applied to
the right person and project.

## Sources

- **HN:** https://news.ycombinator.com/item?id=49947944
- **Source:** https://mattcorritore.com/blog/elves/
- **Repo:** https://github.com/myaa2913/elves
- **Inspected revision:** https://github.com/myaa2913/elves/commit/6595e7e146d3689be24b056f68c81623088d37be
- **Primary artifact:** https://github.com/myaa2913/elves/blob/6595e7e146d3689be24b056f68c81623088d37be/elves-idea-file.md
