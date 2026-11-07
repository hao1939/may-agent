<ai_context>
summary: "A complete XHS post argues from several reported agent-sandbox incidents that isolation fails when an untrusted workload can reach or influence its own control mechanism. The reusable lesson is to evaluate protection-domain placement, credential and control-channel reachability, egress, timeout settlement, and lifecycle cost separately from startup latency; Scout did not inspect the cited vulnerabilities, vendor documentation, benchmarks, or prices."
triggers: ["agent sandbox", "control plane", "localhost trust", "microVM", "sandbox timeout", "6ad5542b000000000c00e056"]
last_updated: "2026-11-07"
source_basis: "Complete readable body and visible comments of XHS note 6ad5542b000000000c00e056 inspected 2026-11-07. The named CVEs, disclosures, products, measurements, prices, and licenses were not independently inspected."
</ai_context>

# A fast agent sandbox still needs an external control boundary

**Observed:** 2026-11-07  
**Disposition:** New source-grounded finding  
**Question:** What should an agent-sandbox evaluation preserve beyond isolation and startup latency?  
**Coverage:** Complete readable XHS post body and visible comments. Attached images and all named primary sources were not inspected.

## Source

- **Source:** [XHS note 6ad5542b000000000c00e056](https://www.xiaohongshu.com/explore/6ad5542b000000000c00e056)
- **Title:** “Agent沙箱卷到25ms，然后集体翻车”
- **Author shown by XHS:** 露娜托娃
- **Reviewed version:** XHS note ID `6ad5542b000000000c00e056`, complete readable body and visible comments as retrieved on the observation date

## What the source says

The post groups several alleged failures in coding-agent sandboxes under one architectural diagnosis: the mechanism supervising an untrusted workload remained reachable from, or partly co-resident with, that workload. It names a DeepSeek Harness issue involving a local control API, an OpenCode upgrade path, and two Codex escape paths, then argues that filesystem isolation does not compensate for a trusted loopback route, reachable privileged interface, shared runtime, or other host-side channel.

The post separately surveys execution products and quotes container, gVisor, microVM, cold-start, wake-up, session-duration, price, capacity, and licensing figures. Its useful structure is that these are different decisions: startup speed and SDK compatibility affect operability, while kernel separation, control-plane placement, credential handling, egress, and privileged-channel reachability affect containment. The post's “25ms” figure is a claimed wake-from-sleep time for one service, not a security result.

A visible author comment adds three timeout scopes: one tool call, one task turn, and the whole sandbox lifetime. Another comment proposes a delayed-child-process experiment to test whether a caller-side timeout actually terminates descendants or merely stops waiting. These comments sharpen a lifecycle issue that startup benchmarks miss: a timeout receipt is not evidence of quiescence.

All named incidents and numerical comparisons above are **secondary claims from the XHS post**. Scout did not inspect the cited advisories, product documentation, benchmark methods, source code, pricing pages, or remediation records.

## Reusable interpretation

An agent sandbox should produce evidence across at least five independent dimensions:

1. **Protection-domain placement:** which component owns policy, authorization state, and privileged I/O, and whether untrusted code shares its process, memory, namespace, or host-facing channel.
2. **Reachability:** whether the workload can contact loopback control APIs, inherited sockets, host mounts, metadata endpoints, or other ambient routes even when ordinary outbound networking is restricted.
3. **Credential and egress mediation:** whether secrets are withheld from the workload and injected only by an external, destination-bound route rather than copied into the sandbox.
4. **Lifecycle settlement:** whether tool, turn, and sandbox deadlines terminate descendants and pending effects, with a later quiescence check rather than a caller-side timeout alone.
5. **Operational fitness:** startup/resume latency, warm-state preparation, session limits, workload type, cost, and SDK compatibility. These affect usability but do not certify any of the first four dimensions.

This yields a concrete review rule: do not report a sandbox as “safe” or “fast” from one scalar. Record the protection boundary, reachable privileged surfaces, credential path, egress policy, termination evidence, environment-preparation cost, and latency measurement separately. A microVM can strengthen separation while still exposing an unsafe host control service; a quick resume can coexist with stale credentials or surviving child processes.

## Evidence limits

- The source is one practitioner-style XHS synthesis, not a primary vulnerability report, vendor document, benchmark, or independent test.
- Scout did not verify the named CVE identifier, severity score, affected versions, exploit mechanisms, fixes, disclosure timelines, incident count, or the characterization of the OpenCode and Codex issues.
- Scout did not verify any quoted latency, capacity, price, session-duration, SDK-compatibility, licensing, or product-availability claim.
- The post compares unlike measurements such as container startup, syscall mediation, microVM boot, cold start, and sleep resume; those figures should not be ranked without matched workload and methodology.
- The proposed delayed-child-process timeout check is a useful diagnostic idea from a comment, not an inspected experiment or proof of complete termination.
- External control-plane placement reduces one class of self-disablement; it does not by itself prove correct policy, complete mediation, escape resistance, credential safety, or settled effects.
