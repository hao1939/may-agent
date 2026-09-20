<ai_context>
summary: "A reverse-engineering report says ZCode captures whole workspaces, including Git history, through a host-level snapshot sidecar whose upload and server-held encryption key are not controlled by the app's visible training or indexing toggles. The case makes harness data movement a separate trust boundary from model weights and agent-visible tools."
triggers: ["ZCode", "GLM coding agent", "workspace snapshot", "Git history upload", "closed-source harness", "agent telemetry", "harness privacy"]
last_updated: "2026-09-20"
source_basis: "Ferstar's Sep 18 reverse-engineering report, the derivative Tokenstead report surfaced by HN item 49752422, and the merged HN discussion under primary-source item 49750694; reviewed as published web text, not independently reproduced."
</ai_context>

# ZCode Workspace Capture Sits Outside the Agent Tool Loop

**Date:** 2026-09-18  
**Disposition:** New knowledge  
**Coverage:** Full text of the original reverse-engineering post; full text of the derivative article submitted to HN; both HN item trees and available comments at observation time. No binary analysis or network reproduction by Scout.

## Sources

- **Primary Source:** Ferstar, [“Inside ZCode: Silently Uploading Your Entire Git History to the Cloud”](https://blog.ferstar.org/en/posts/zcode-silent-workspace-snapshot-upload/), published 2026-09-18.
- **HN (primary-source submission):** [Item 49750694](https://news.ycombinator.com/item?id=49750694), “Inside ZCode: Silently uploading your Git history to the cloud.”
- **HN (derivative submission):** [Item 49752422](https://news.ycombinator.com/item?id=49752422), “ZCode, the GLM coding agent, silently uploads your Git history”; moderators merged most discussion into item 49750694.
- **Derivative Source:** Tokenstead, [“ZCode uploads your entire git history, and only Z.ai holds the key”](https://tokenstead.ai/guides/zcode-silent-git-history-upload), published 2026-09-18.

## What the report claims and shows

Ferstar reports finding a 313 MB encrypted archive under `~/.zcode/v2/checkpoints` while investigating a roughly 345 MB commercial workspace. The accompanying local state recorded 564 failed upload attempts. A plaintext manifest attributed 86.6% of the snapshot to `.git`, including Git objects, LFS assets, and reflogs; source and documentation files made up the remainder. This is materially broader than sending task-selected code context because Git objects may retain deleted secrets, unpushed work, and repository history.

The author says reverse engineering ZCode's packaged Electron application exposed a two-stage path: obtain snapshot credentials and a per-round RSA public key from `zcode.z.ai`, then POST an AES-256-CTR-encrypted archive directly to Aliyun OSS, with OSS calling back to ZCode's backend. The matching private key was not present locally. Active network connections reportedly included ZCode and Aliyun endpoints, although the documented archive itself was pending after failed attempts rather than proof that this particular payload completed upload.

The report also says the visible **Optimize Experience** control governs training authorization and **Repo Snapshot Indexing** governs server-side indexing, but neither gates capture or upload. The capture sidecar is described as being instantiated whenever an authenticated token is available, with triggers before prompts and at task completion. The published privacy language discussed code submitted in conversations but, according to the author's review, did not disclose whole-workspace and Git-history snapshots.

## Why this matters for agent architecture

The useful boundary is not “local model versus cloud model.” It is **model weights, agent tool loop, and host harness as three separately inspectable trust surfaces**:

1. Open or locally executed weights do not constrain what a closed desktop harness transmits.
2. An agent's declared tool list is not a complete effect inventory when a host sidecar can read and send files outside that loop.
3. A training opt-out, an indexing toggle, and a transport kill switch are different controls; one must not be presented as the others.
4. Encryption at rest or in transit does not establish user control when only the service holds the decryption key.

For coding-agent assurance, inspect host-level file watchers, snapshot/checkpoint services, credential negotiation, network destinations, key ownership, and retry behavior—not only prompts and model-facing tools. Product disclosures should separately state **what is captured, what is transmitted, why, who can decrypt it, retention, and how each path is disabled**.

## HN signal

By the 2026-09-20 observation, the derivative submission had reached 261 points; its visible thread had 14 comments because moderators moved most discussion to the earlier primary-source submission, which had reached 329 points and 37 top-level comment branches in the Algolia item tree. Discussion repeatedly separated open weights from an open harness and recommended treating closed host tooling as its own trust boundary. One commenter reported not finding the described checkpoint directory or logs in their installation, which is useful contrary anecdote but not a controlled reproduction. These counts and comments are attention and disagreement evidence, not independent technical corroboration.

## Limitations

- Scout did not install ZCode, inspect `app.asar`, capture network traffic, or reproduce the upload path.
- The original post states that its English version was AI-translated and that site posts are AI-drafted and author-approved; exact wording should not be treated like a vendor specification.
- The local evidence described 564 failed attempts and a pending archive. Static reverse engineering supports the claimed upload design, but the post does not provide independent proof that the observed commercial-project archive completed upload.
- No Z.ai technical response, fixed version, retention statement, or controlled contrary reproduction was available in the reviewed material. One HN commenter reported not observing the directory or logs, without documenting version, configuration, or a controlled test. The claim should be revisited if the vendor or independent researchers publish evidence.
- The derivative article adds interpretation and secondary references; technical claims above are attributed primarily to Ferstar rather than treated as independently corroborated by Tokenstead or HN comments.
