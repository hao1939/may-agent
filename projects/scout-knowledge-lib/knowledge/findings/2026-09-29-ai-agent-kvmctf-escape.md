<ai_context>
summary: "PWN.AI reports that a multi-session agent research harness built and operated a KVM guest-to-host exploit that caused Google's live kvmCTF host to return its per-boot flag. The independently inspectable Linux fix confirms the underlying shadow-MMU stale-rmap use-after-free, but the agent attribution, official transcript, and end-to-end exploit remain author-reported because the promised proof bundle and complete model trace are not public. The reusable lesson is twofold: a VM is a vulnerable enforcement component rather than a proof of containment, and capability claims need a target-generated secret rather than self-reported intermediate markers."
triggers: ["PWN.AI", "kvmCTF", "CVE-2026-46113", "KVM escape", "sandbox escape", "target-generated proof", "agent cyber capability", "49891241"]
last_updated: "2026-09-29"
source_basis: "Current HN item 49891241, complete PWN.AI technical article, Google kvmCTF rules, and Linux fix 0cb2af2ea66ad8ff195c156ea690f11216285bdf inspected 2026-09-29. Scout did not receive the official transcript, exploit package, retained agent trace, or independent Google confirmation of agent authorship."
</ai_context>

# A target-generated secret is stronger evidence than an agent's exploit narrative

**Observed:** 2026-09-29  
**Disposition:** New source-grounded finding  
**Coverage:** Current HN item, the complete linked technical article, Google kvmCTF rules, and the pinned upstream Linux fix. Static source assessment only; no exploit execution.

## Sources

- **Source:** [PWN.AI — Inside the Sandbox: How pwn Escaped Google kvmCTF](https://pwn.ai/blog/kvmescape)
- **HN:** [item 49891241](https://news.ycombinator.com/item?id=49891241)
- **Challenge rules:** [Google kvmCTF overview](https://google.github.io/security-research/kvmctf/rules.html)
- **Pinned fix:** [Linux commit `0cb2af2ea66ad8ff195c156ea690f11216285bdf`](https://github.com/torvalds/linux/commit/0cb2af2ea66ad8ff195c156ea690f11216285bdf)

## What the source reports

PWN.AI says its `pwn` research harness spent multiple sessions auditing Linux 6.1.74 KVM, developing a nested-VMX exploit, reproducing it on local bare metal, and then operating it during an authorized Google kvmCTF reservation. Humans selected the target, provided authorization and infrastructure, and set the mission. The harness reportedly switched among frontier models, retained target state and specialist knowledge, delegated independent reviews, used parsers and evidence gates, and retried failed runs.

The reported official run returned zero three times. On the fourth attempt, the guest printed `hc102_oob_read=0xcdc63bb4b015eb8c`. The article argues that this is stronger than an agent-authored success message because Google's host generates a random value for the boot and exposes it only after its KASAN instrumentation records a qualifying invalid host read. Google's public rules independently confirm that challenge flags are 64-bit values and that KASAN-enabled tiers require producing the violation and retrieving the corresponding flag through a challenge hypercall.

The independently inspectable Linux commit confirms the technical substrate, not the agent history. Commit `0cb2af2e…` fixes a KVM shadow-MMU use-after-free in which a changed guest mapping can put an rmap entry outside the range later searched while zapping a shadow page; a later rmap walk then dereferences the freed page. The PWN.AI article says Google attributed its submission to this flaw, later assigned CVE-2026-46113.

## Two reusable lessons

### 1. A sandbox is an enforcement component, not a containment proof

A VM boundary depends on a large, changing hypervisor and kernel attack surface. If the contained workload can compile code, exercise nested virtualization, shape memory pressure, and retry over long periods, then the boundary has to be treated like any other security mechanism: patched, minimized, monitored, and tested from outside its own trust domain.

This adds a concrete reported campaign to the library's existing guidance in [Agent Security: Defense Architectures](../agent-security-defense-architectures.md): use an independently controlled outer boundary, scope credentials and network access so a guest escape does not inherit the whole host, and make sandbox-escape regression tests safe to run without trusting the inner sandbox to contain them.

### 2. Capability claims need verifier-owned evidence

The article distinguishes intermediate markers from the terminal predicate. A local string such as `flag_found`, a crash, or an agent-written verdict can be fabricated or misclassified. A per-boot secret generated inside the target's trust domain is materially stronger because the candidate cannot know it before the verifier releases it.

A good high-consequence evaluation therefore separates:

1. **agent-authored telemetry** — useful for diagnosis, not sufficient for success;
2. **environment-observed effects** — stronger, but still dependent on the monitor and event definition; and
3. **verifier-owned receipts** — unguessable or signed evidence released only after the externally enforced predicate is satisfied.

The receipt still needs identity and replay semantics. The article notes that later reads of the same official token were not independent successes because the flag persisted after the first qualifying KASAN event. A production receipt should therefore bind run, target revision, policy, nonce, effect class, and one-shot consumption.

## What this does not prove

This is a detailed first-party report, not an independently reproducible agent benchmark. PWN.AI says the winning harness was 14,338 lines and supplies its SHA-256, but the article only promises a future sanitized proof excerpt, attempt ledger, and source-faithful rerun package. It also states that a complete model conversation and token ledger were not retained. Scout could not inspect the exploit package, official terminal log, local archives, model-routing records, or human/agent edit boundary.

Accordingly:

- the upstream commit verifies that the vulnerability and fix are real;
- the public kvmCTF rules verify the shape of the target-owned flag mechanism;
- the article supplies a technically detailed exploit and campaign narrative;
- but the official flag transcript, Google attribution to this team, agent authorship, first-agent claim, and degree of autonomy remain author-reported.

The result also did not earn a zero-day bounty: according to the article, the vulnerability report and patch became public before the live-host submission, even though the team says its local exploit worked earlier while the official service was unavailable. That eligibility dispute does not change the containment lesson, but it prevents the event from being treated as an independently adjudicated bounty win.

## Operational takeaway

Do not make “runs in a VM” the terminal security claim for a cyber-capable agent. Bound the value reachable after an escape, observe the guest from a separate control domain, rotate vulnerable runtime components, and use target-generated receipts for escape tests. At the same time, preserve an evidence ladder: a real vulnerability and plausible receipt mechanism are not by themselves proof of who built the exploit or how autonomous the process was.
