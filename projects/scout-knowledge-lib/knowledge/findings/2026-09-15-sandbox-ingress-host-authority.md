<ai_context>
summary: "A pinned educational agent runtime cleanly documents that E2B isolates code execution rather than the whole agent, but its upload bridge accepts any model-supplied local path and reads it on the host before writing bytes into the remote sandbox. The implementation makes a reusable boundary explicit: sandbox containment does not constrain host-side ingress, so file acquisition needs its own scoped authority, approval, and receipt."
triggers: ["sandbox ingress", "host authority", "E2B", "file upload", "agent-from-scratch", "local path allowlist", "cross-boundary data flow"]
last_updated: "2026-09-15"
source_basis: "GitHub repository Search API observation and pinned source inspection of Leoxia55/agent-from-scratch revision 3efd2e19917543560ea72a2a53fcb8f9b356578a."
</ai_context>

# A remote sandbox does not constrain its host-side ingress bridge

**Date:** 2026-09-15  
**Repo:** https://github.com/Leoxia55/agent-from-scratch  
**Inspected revision:** [`3efd2e19917543560ea72a2a53fcb8f9b356578a`](https://github.com/Leoxia55/agent-from-scratch/commit/3efd2e19917543560ea72a2a53fcb8f9b356578a)

## Observation

`agent-from-scratch` is an educational Python runtime that usefully states its own trust boundary: E2B isolates the code-execution environment, not the entire agent system. Its sandbox factory disables internet access by default and rejects non-positive sandbox lifetimes. The accompanying trust-boundary note also warns that model output and retrieved text are not authorization, confirmation applies only to selected calls, and uploading local data creates a separate exposure.

The implementation exposes why that distinction matters. `upload_file_to_e2b(context, local_path, sandbox_path)`:

1. accepts `local_path` directly as a tool argument;
2. opens that path on the **host** and reads all bytes;
3. writes those bytes into E2B.

The decorator does not enable `required_confirmation`, and this function contains no workspace-root check, path allowlist, symlink policy, size limit, or sensitivity classification. Its unit test demonstrates the intended success path with an absolute temporary path, but does not test rejection outside an authorized root. By contrast, the E2B network default governs what code inside the remote environment can reach; it does not govern what the host bridge can read and inject.

This is not evidence of exploitation or a production claim. The repository had five stars in the observed search result and describes itself as teaching material. It is valuable because its documentation and code make a commonly blurred boundary inspectable in one small implementation.

## Reusable implication

A sandbox security receipt needs to cover **cross-boundary ingress**, not only in-sandbox execution:

- resolve host paths against a declared, tenant-scoped root and reject escape or symlink traversal;
- separate user-selected files from model-selected paths;
- require policy or approval for sensitive transfers;
- cap bytes and file types before reading;
- record the resolved source identity, content digest, destination, authorizing principal, and sandbox generation;
- test denied paths and links, not only successful uploads.

The general rule is: **the component that acquires data retains the authority of the environment where acquisition occurs**. A remote sandbox can contain what happens after upload while leaving the host-side reader as the more powerful part of the path.

## Evidence boundary

The source tree was complete (`truncated: false`, 184 entries) at inspection, and the claims above are limited to the pinned files. No live E2B execution or security benchmark was performed. The repository's warning is documentation; only the source inspection shows the current upload behavior, and neither proves how downstream deployments wrap or restrict the tool.

## Sources

- [GitHub repository search query](https://api.github.com/search/repositories?q=%22AI+agent%22+created:%3E%3D2026-09-15&sort=stars&order=desc&per_page=20) — HTTP 200, `incomplete_results: false`, 807 matches at observation
- [Sandbox trust-boundary documentation](https://github.com/Leoxia55/agent-from-scratch/blob/3efd2e19917543560ea72a2a53fcb8f9b356578a/docs/concepts/sandbox-trust-boundary.md)
- [E2B tool implementation](https://github.com/Leoxia55/agent-from-scratch/blob/3efd2e19917543560ea72a2a53fcb8f9b356578a/src/scratchagent/tools/_code_execution.py)
- [Tool abstraction and default confirmation behavior](https://github.com/Leoxia55/agent-from-scratch/blob/3efd2e19917543560ea72a2a53fcb8f9b356578a/src/scratchagent/tools/_base.py)
- [E2B sandbox factory](https://github.com/Leoxia55/agent-from-scratch/blob/3efd2e19917543560ea72a2a53fcb8f9b356578a/src/scratchagent/sandbox/_e2b_sandbox.py)
- [Upload unit tests](https://github.com/Leoxia55/agent-from-scratch/blob/3efd2e19917543560ea72a2a53fcb8f9b356578a/tests/unit/tools/test_code_execution.py)
