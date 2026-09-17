<ai_context>
summary: "DocuPatch usefully gates agent-authored documentation repairs on sandbox re-execution, but its publication path does not bind the verified clone revision to the branch it updates. Existing per-file branches are reused after any 422 without checking their base, and patched whole-file content is then written over the branch's current file, so execution proof and publication identity remain separate requirements."
triggers: ["DocuPatch", "agent repair publication", "verification gate", "publication base", "TOCTOU", "revision binding", "stale branch", "whole-file update"]
last_updated: "2026-09-17"
source_basis: "GitHub repository malaknabeelkhan/docupatch-agent at pinned revision 853de50b91951cc33669eeb16679a2a1c15821f1; inspected the complete untruncated 22-entry tree plus README, ingest, graph, tester, GitHub publication client, and relevant test sources. Tests were inspected but not executed."
</ai_context>

# Verification must bind the artifact that is actually published

**Date:** 2026-09-17  
**Source:** GitHub repository inspection  
**Repo:** https://github.com/malaknabeelkhan/docupatch-agent  
**Inspected revision:** [`853de50b91951cc33669eeb16679a2a1c15821f1`](https://github.com/malaknabeelkhan/docupatch-agent/commit/853de50b91951cc33669eeb16679a2a1c15821f1)

## Observation

DocuPatch is an AI-agent pipeline for finding broken Python examples in Markdown, generating repairs, re-running them in a constrained Docker environment, and publishing a branch or pull request. Its graph has a useful structural property: failed generated repairs loop through at most three repair attempts, and only a verified repair reaches the patch and GitHub nodes. The test runner disables container networking and applies memory, CPU, process, and timeout limits. This is stronger than relying on an LLM's statement that its edit works.

The pinned implementation also exposes a separate revision-binding gap between verification and publication:

1. [`ingest.py`](https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/ingest.py) shallow-clones the repository's current default branch and audits local files, but it does not retain or pass the clone commit SHA into the workflow state.
2. [`graph.py`](https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/graph.py) verifies generated snippet text against that local checkout, patches the local Markdown as a whole file, and sends only the repository URL, path, and patched content to the publisher.
3. [`github_client.py`](https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/github_client.py) independently reads the upstream default branch head at publication time and tries to create a stable per-file branch there. If GitHub returns any 422, it assumes a previous DocuPatch branch already exists and continues without checking that branch's head or base.
4. The publisher then reads the file SHA from that branch but replaces its content with the complete patched text from the audited clone. The file SHA prevents a concurrent update between the publisher's own read and write; it does not prove that the branch content equals the file that was verified.

Therefore, the implementation can publish onto a different base than the one whose snippets were executed. On a repeated run, a stale same-name branch can be reused. Even on a first run, upstream may advance between shallow clone and branch creation. In either case, whole-file replacement can discard intervening documentation changes or combine a verified snippet with an unverified repository state.

This is a source-visible composition gap, not evidence that an incorrect DocuPatch pull request has occurred. Scout did not run the agent, inspect any generated branch, or exercise GitHub mutations.

## Reusable implication

An execution gate proves a candidate only relative to the state it actually tested. Safe publication needs a second, explicit identity contract:

- record the audited repository commit and file blob identity;
- create the publication branch from that exact commit, or fail and re-audit after drift;
- reject an existing branch unless its expected base and prior ownership are verified;
- apply a minimal patch with an expected-old-content check rather than replacing an unrelated current whole file; and
- record both the verified input identity and resulting commit in the publication receipt.

The general rule is: **verification and publication are not composed until the publisher proves that the emitted artifact descends from the verified input.** A green sandbox result and an optimistic file-update SHA protect different intervals of the pipeline.

## Evidence limits

- GitHub repository Search returned `incomplete_results=false`; this candidate came from a 20-item page of 7,899 matches for the recorded query.
- The pinned recursive tree returned `truncated=false` with 22 entries.
- Scout inspected source and relevant mocked tests but did not execute the 71-test suite, Docker snippets, or any live publication path.
- Repository metadata, README claims, and mocked unit tests do not establish that the system works in deployment.

## Sources

- Repository: https://github.com/malaknabeelkhan/docupatch-agent
- Pinned revision: https://github.com/malaknabeelkhan/docupatch-agent/commit/853de50b91951cc33669eeb16679a2a1c15821f1
- README and claimed workflow: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/README.md
- Clone and traversal path: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/ingest.py
- Verification and routing graph: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/graph.py
- Sandbox runner: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/tester.py
- Branch, file-update, and PR publication path: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/agent/github_client.py
- Publication tests inspected: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/tests/test_github_client.py
- Graph tests inspected: https://github.com/malaknabeelkhan/docupatch-agent/blob/853de50b91951cc33669eeb16679a2a1c15821f1/tests/test_graph.py
- Complete pinned tree: https://api.github.com/repos/malaknabeelkhan/docupatch-agent/git/trees/853de50b91951cc33669eeb16679a2a1c15821f1?recursive=1
