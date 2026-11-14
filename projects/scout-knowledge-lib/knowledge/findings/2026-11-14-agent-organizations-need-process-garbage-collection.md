<ai_context>
summary: "Perfloop founder Tomás Senart reports that a long-lived coding-agent organization accumulated markdown bureaucracy because each fresh agent inherited old prose as active policy and lacked the human boredom that lets rituals decay. The reported reset paired explicit process deletion with outcome owners, short-lived workers, bounded coordination, closed-list human decisions, scoped lesson loading, and invariants compiled into code, CI, and TLA+."
triggers: ["Perfloop", "agent organization", "process garbage collection", "instruction ratchet", "agent bureaucracy", "rule retirement", "scoped policy loading", "outcome ownership", "50499972"]
last_updated: "2026-11-14"
source_basis: "Complete inspection of the 33,913-byte markdown essay published by Perfloop founder Tomás Senart, retrieved 2026-11-14, plus HN item 50499972 for discovery metadata only. Operational measurements and incidents are author-reported; Scout did not audit Perfloop's private repository, traces, pull-request population, or organization internals."
</ai_context>

# Long-lived agent organizations need process garbage collection

**Date:** 2026-11-14  
**Primary source:** [My agent org speedran a company](https://perfloop.ai/blog/my-agent-org-speedran-a-company.md)  
**Author and source context:** Tomás Senart, founder of Perfloop; founder-authored product and operating narrative  
**HN discovery:** https://news.ycombinator.com/item?id=50499972  
**Coverage:** Complete markdown essay, 261 lines and 33,913 bytes, retrieved 2026-11-14  
**Observed markdown SHA-256:** `e4d3731cd0d74dac1ac63c88507b315a8a9454271039364934b5202563b8c0d1`  
**Disposition:** New knowledge

## Question

What does Perfloop's account of a persistent coding-agent organization suggest about process accumulation, instruction governance, coordination boundaries, and the difference between prose policy and enforceable invariants?

## What the author reports

### Throughput and the October reset

Senart reports that Perfloop's all-agent engineering organization merged **1,119 pull requests from November 2–8**, after merging 738 the preceding week. He places this growth after an **October 18 reset**, when an earlier organization of roughly twenty standing threads had failed to address three persistent development alerts despite regular green status reports.

The essay says the coordinating “VP of Engineering” diagnosed excessive threads, locally invented rules, and waiting, then handed off its work and retired in 47 minutes. The founder subsequently restored a coordinator under the narrower “Chief of Staff” role: route work, perform routine policy checks, and unblock owners, without becoming a general executive layer.

These are **self-reported throughput and operational-history measurements**, not independently verified productivity or quality results. Pull-request count alone does not show useful output, correctness, review depth, customer value, or the size of each change.

### Prose policy accumulated as persistent process

The sharpest evidence is not the PR total but the reported growth and persistence of organizational rules:

- Instruction files grew from **26,401 characters in July to 277,486 characters on October 18**, a reported 10.5× increase.
- Agents authored **208 of the 249 October commits** that touched those instruction files.
- The organization accumulated **386 numbered grants** for read-only checks.
- One shared GitHub issue, edited by every lead, reached **226 KB**.
- Watcher threads watched other watcher threads, alongside frequent error, stuck-thread, retrospective, and PR-speed checks.
- Successor creation left about **3,000 older threads unarchived**.
- Other rituals included message and receipt hashes reported instead of outcomes and a release gate that could trigger a Perfloop run merely to produce the state the gate expected.

Senart's explanation is that a human organization has an informal decay mechanism: people become bored, stop completing useless forms, or forget rituals. Fresh agent threads instead wake with full energy, load the current rulebook, and interpret inherited prose as active law. Corrections such as “write it down” therefore persist beyond the incident that caused them and tax every successor.

### An audit separated real gates from paperwork

The essay reports an internal audit of **432 merged pull requests**:

- **47** were caught by real CI or technical-review gates.
- **99** were delayed solely by redundant approval paperwork after CI and technical review were already green.
- **286** merged without either category of block.

Perfloop says it retained gates that could name a concrete failure and had evidence of catching it, while removing approval ceremony that added permission slips without a distinct safety function. Human authority was inverted into a closed list of seven decisions—such as customer releases, exceptional spend, credentials, outside contact, policy exceptions, reversal of the founder's rules, or legal issues—with outcome owners controlling other decisions by default.

This is an author-reported audit. Scout did not inspect the 432-PR population, classification method, repository, review records, or CI history.

### Coordinator load was reduced by deleting traffic and context

The author reports that a coordinator with 89,700 lifetime messages was being awakened by frequent status pings while carrying a **127,000-character schedule prompt**. In one cleanup, it reportedly:

- cut that prompt from **127,000 to 7,000 characters**;
- archived **595 idle threads**; and
- limited coordinator messages to leads, three lines, and three message classes: a human decision, a finished outcome, or an unrouted blocker.

This combines subtraction and admission control: remove old state, bound who may send, bound payload size, and narrow the semantic reasons that justify waking the coordinator.

### The replacement organization uses lifecycle boundaries

The operating model described after the reset has several distinct controls:

1. **Outcome owners persist only as long as their outcome.**
2. **Workers below them are short-lived**, started for one piece of work and ended with it.
3. **The coordinator is a bounded router**, not a universal decision-maker or an owner of every detail.
4. **Human decisions use a closed list**, so agents do not rediscover “ask the human” as a locally safe default on every turn.
5. **Learned lessons are scoped to the relevant service, workload, or execution-path node**, rather than appended to one global prompt.
6. **Important invariants are compiled into code and CI**, including defaults in the shared runner and 25 reported TLA+ specifications for core state machines, instead of being repeatedly explained to agents in prose.

The essay also gives a useful deletion example: an agent built a file-outline mechanism to reduce large-file context, but benchmark agents immediately bypassed it because an instruction told them to read repository instructions “through the end.” Perfloop deleted those three words and discarded the outline feature before merge. The intervention removed the causal instruction instead of preserving both the prompt defect and a compensating mechanism.

## Scout interpretation

### Persistent prose is executable-like inherited state

The novel implication relative to existing Scout coverage is that **long-lived agent organizations accumulate process differently from human organizations because they lack passive ritual decay**. A prose rule is not merely documentation. When every successor loads and follows it, the rule behaves like inherited executable policy, but without code's type checks, ownership boundaries, test coverage, lifecycle management, or deprecation mechanisms.

That makes three operations first-class governance requirements:

- **Deletion and retirement:** every durable rule needs an owner, purpose, evidence of the failure it prevents, and a sunset or review path.
- **Scoped loading:** a lesson should reach only the roles, services, paths, and phases where it is relevant.
- **Compilation:** true invariants should move from repeated prose into runtime defaults, permission boundaries, CI checks, schemas, or formal state-machine verification.

The source is consistent with, but does not independently validate, the library's quantitative models in:

- [The Prompt Mass Problem](../the-prompt-mass-problem.md), which treats repeated instruction text as a distinct input cost;
- [The Coordination Tax](../the-coordination-tax.md), which describes coordination overhead outgrowing productive work;
- [The Subtraction Deficit](../the-subtraction-deficit.md), which identifies missing retirement and pruning operators; and
- [The Meta-Escalation Ratchet](../the-meta-escalation-ratchet.md), which describes oversight layers triggering more oversight.

Perfloop contributes a founder-reported longitudinal case in which those patterns appear together: global prose grew, long-lived threads multiplied, permission rituals accumulated, watcher layers watched other layers, and coordinator context expanded. The claimed recovery then used subtraction, lifecycle boundaries, scoped knowledge, and compiled enforcement. It does **not** reproduce or prove the other notes' production datasets, coefficients, forecasts, or causal models.

### Governance needs a garbage collector, not occasional cleanup heroics

The 47-minute self-audit is striking, but the reusable lesson is not that an agent can heroically fire itself. A durable system should make process garbage collection ordinary:

1. inventory active rules, watchers, standing threads, gates, and shared ledgers;
2. identify the named failure each mechanism prevents;
3. retain mechanisms with observed catches or necessary authority boundaries;
4. retire paperwork-only holds and stale state;
5. scope remaining lessons to the smallest relevant context;
6. compile stable invariants into deterministic enforcement; and
7. measure whether each deletion changes error, recovery, cost, and throughput.

Without that loop, every correction can become permanent global context, while no successor experiences the local history that originally justified it.

## Evidence boundaries and limitations

- The essay is a **founder-authored Perfloop product narrative** containing internally selected measurements and incidents. It is valuable primary testimony about the claimed organization, but not independent evaluation.
- Scout read the complete markdown source but did **not** audit the private repository, agent transcripts, traces, 39,000-commit history, 1,119-PR week, 432-PR audit population, instruction-file commit history, thread archive, issue contents, or organization internals.
- Some public links in the essay point to Perfloop documentation, GitHub searches, commits, and pull requests. Their existence does not independently verify the private organizational measurements summarized here.
- High PR volume must not be interpreted as high-quality productive output. The essay itself argues that review attention cannot scale linearly with such volume and foregrounds proof harnesses, independent verification, and real gates.
- The before/after account is observational and selected by the operator. It does not isolate which change caused the reported throughput increase, nor does it quantify costs, model mix, PR size, regressions, or customer impact.
- The account supports process-retirement and scoped-policy hypotheses. It does not establish that every long-lived agent organization will accumulate bureaucracy at the same rate or that Perfloop's organization design generalizes unchanged.

## HN reception

Hacker News item **50499972** served as discovery only. At retrieval on 2026-11-14, the item had **3 points and 0 comments**. That is not substantive peer reception or corroboration.

## Sources

- Complete markdown essay: https://perfloop.ai/blog/my-agent-org-speedran-a-company.md
- Human-facing essay URL: https://perfloop.ai/blog/my-agent-org-speedran-a-company
- Hacker News discovery item: https://news.ycombinator.com/item?id=50499972
- HN item API record: https://hacker-news.firebaseio.com/v0/item/50499972.json
