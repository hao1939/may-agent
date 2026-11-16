---
summary: "Anthropic does not publish a formal white paper named for 'always-on agents.' The strongest title match is the full Engineering article 'Effective harnesses for long-running agents'; the strongest production-architecture source is 'Scaling Managed Agents: Decoupling the brain from the hands.' Together with Anthropic's memory work, they support resumable, artifact-backed agent operation—not continuous model cognition."
triggers: ["Anthropic always-on agents", "Anthropic white paper", "Effective harnesses for long-running agents", "Managed Agents", "persistent agents", "long-running Claude", "scheduled deployments", "agent autonomy"]
source_basis: "Full text and metadata of primary Anthropic Engineering and Science articles, official site search, sitemap, safety material, and Claude Platform documentation reviewed 2026-11-16."
---

<ai_context>
This finding disambiguates the phrase “Anthropic always-on agents.” Use it when someone asks whether Anthropic has proposed continuously operating autonomous agents, or when comparing persistent/scheduled agents with ordinary request-response model calls. It separates Anthropic's direct claims from Scout's synthesis and records the reviewed source dates and limits.
</ai_context>

# Anthropic's “always-on agents” are a stack, not one named proposal

**Question:** What publicly described Anthropic idea is likely behind the phrase “always-on agents,” and what does it actually mean?

**Disposition:** Corrected synthesis from several primary Anthropic sources. Scout did not find the exact phrase **“always-on”** used as the name of a single Anthropic architecture. After Hao's correction, Scout searched Anthropic's official site and sitemap beyond the sources in the first pass and read the complete relevant Anthropic articles. The official search returned no result for “white paper” or “always-on agents,” and one result for “long-running agents.” The most likely referent is an Anthropic Engineering article that may have been described informally as a white paper, not a formally published paper or PDF.

**Observed:** 2026-11-16. Source publication dates and live-document limitations are listed below.

## Correction: the strongest “white paper” candidates

No reviewed candidate is formally presented by Anthropic as a **white paper** or conventional research paper: the pages have Engineering or Science team labels, article-style bylines, no paper abstract or stable PDF, and no stated formal publication venue. Anthropic hosts them under `/research/`, but that URL namespace alone does not make them research papers. Ranked by fit to Hao's description:

1. **Strongest title and operating-method match — “Effective harnesses for long-running agents”**  
   **Anthropic Engineering; Justin Young; November 26, 2025**  
   https://www.anthropic.com/research/effective-harnesses-for-long-running-agents

   This is the only result returned by Anthropic's official search for “long-running agents,” and its title directly matches the correction signal. It reports a two-role harness for work spanning many context windows: an initializer creates a structured feature list, `init.sh`, progress notes, and an initial Git state; later coding sessions read those artifacts, select one unfinished feature, make incremental progress, test end to end, commit, and leave a clean handoff. Its central claim is that compaction alone does not reliably bridge fresh sessions: long-running work needs external artifacts, incremental scope, recoverable version history, and explicit verification.

   Its reported limitations are material. The demonstration is optimized for full-stack web application development; the model can still mark work complete prematurely, miss bugs that its browser tooling cannot observe, and leave open whether one general agent or specialized testing/QA/cleanup agents perform best. This is an engineering report and recipe, not a proof of reliable indefinite autonomy.

2. **Strongest production-architecture match — “Scaling Managed Agents: Decoupling the brain from the hands”**  
   **Anthropic Engineering; Lance Martin, Gabe Cemaj, and Michael Cohen; April 8, 2026**  
   https://www.anthropic.com/research/managed-agents

   This article specifies the hosted architecture behind durable agent runs: a **session** as an append-only external event log, a replaceable **harness** that calls Claude and routes tools, and replaceable **sandboxes/tools** that perform actions. `emitEvent` durably records progress; a crashed harness can `wake(sessionId)`, reload events with `getSession`/`getEvents`, and resume. Sandboxes are provisioned as tools only when needed. Credentials stay outside untrusted execution, either bound to initialized resources or held behind a vault-backed MCP proxy.

   The article's central systems claim is that stable interfaces around state and computation should outlast any particular model or harness. It reports roughly 60% lower p50 and over 90% lower p95 time-to-first-token after separating inference from sandbox startup. It does **not** establish task success rates, safe indefinite operation, or general reliability; it explicitly treats harness design as changing with model capability.

3. **Strongest persistent-memory match — “The components of agent memory”**  
   **Anthropic Engineering; Lance Martin; November 6, 2026**  
   https://www.anthropic.com/research/components-of-agent-memory

   This later article defines agent memory as knowledge learned from experience and retained between sessions in readable external context. It distinguishes in-session notes from offline “dreaming,” where agents revisit logs to correct mistakes, consolidate notes, build linked wikis, prune or promote memories, and shape what future sessions preload. Reported evaluations show both benefits and failure modes: a growing Stainless wiki improved combined wiki-plus-search performance from 54% to 61% while saving about 20,000 tokens per question, but another wiki became larger than its source corpus; stale or false memory can mislead future sessions; concurrent writers lost contract facts until the workflow assigned one page per contract; maintenance requires additional compute.

4. **Supporting multi-day deployment account — “Long-running Claude for scientific computing”**  
   **Anthropic Science; Siddharth Mishra-Sharma; March 23, 2026**  
   https://www.anthropic.com/research/long-running-claude

   This is a practitioner account of multi-day scientific coding using `CLAUDE.md`, a progress changelog, Git, reference implementations and tests, detached compute sessions, and occasional human steering. It supports the “agents working overnight” interpretation most directly, but the resulting solver remained non-production-grade, had test gaps, and made elementary domain mistakes.

**Assessment of uncertainty:** Candidate 1 is the best match to the words “paper” and “long-running agents.” Candidate 2 is the best match to the durable, resumable service architecture that the first Scout synthesis emphasized. Candidate 3 is the best match if Hao meant persistent cross-session cognition or memory. None is verified as a formal white paper, so the corrected conclusion is not “the white paper does not exist”; it is narrower: **Scout could not verify a formally labeled Anthropic white paper, and the strongest official candidates are full Engineering/Science articles.**

## Short answer

Anthropic's published direction is not a model that literally thinks continuously. It is an **event-driven agent service** that can be started asynchronously or on a recurring schedule, retain durable state outside the model's context window, use tools in isolated execution environments, survive component failures, pause for budgets or human input, and resume later. Separate Anthropic demonstrations show agents working for hours or days, sometimes across thousands of sessions, when given persistent artifacts, test oracles, bounded permissions, and occasional human steering.

So “always-on” is best treated as shorthand for **always available, resumable, stateful, and triggerable**, not evidence of an uninterrupted conscious process or a fully unsupervised digital employee.

## How the correction changes the original synthesis

- **Changes:** The first version led with Managed Agents as the strongest match and said Anthropic did not appear to have one named proposal. The corrected version gives **“Effective harnesses for long-running agents”** first place as the likeliest source Hao meant, because it is the exact official title match and Anthropic's own search result. The claim is also tightened from “there is no white paper” to “no formally labeled white paper was verified.”
- **Confirms:** The complete articles still support the original architectural synthesis. Persistence is externalized into feature lists, progress files, Git history, tests, durable event logs, memory directories, and replaceable harness/sandbox processes. Long-running operation is a sequence of model/tool cycles and sessions, not one unbroken context window.
- **Extends:** “The components of agent memory” adds a missing maintenance loop: durable memory requires retrospective consolidation and correction, not just storage. Offline “dreaming” can repair false notes and build indexes, but can also consume substantial compute, overgrow the corpus, preserve hallucinations, or suffer concurrent-write loss.
- **Does not support:** None of the sources establishes a general, continuously self-directed digital worker. The demonstrations remain domain-bounded, expensive, dependent on tests or other oracles, vulnerable to weak self-evaluation and stale memory, and subject to explicit security boundaries and human steering.
- **Governance implication:** The deployment—not merely a model response—becomes the relevant control object: objective, schedule, authority, credentials, memory writers, evidence, budget, model/harness version, interruption, and revocation all need accountable ownership. The Managed Agents article supplies concrete credential isolation, while the harness and memory articles show why verification, provenance, concurrency control, and memory correction are ongoing requirements.

## Supporting primary-source inventory for the stack synthesis

1. **Scaling Managed Agents with stable interfaces** — Anthropic Engineering, published **2026-04-08**  
   https://www.anthropic.com/research/managed-agents

   Anthropic says Managed Agents is a hosted service that runs “long-horizon agents on your behalf.” Its architecture separates:
   - the **session**, an append-only durable event log;
   - the **harness**, a stateless loop that invokes Claude and routes tool calls; and
   - the **sandbox/tools**, the “hands” that execute actions.

   A crashed harness can be replaced, reload the session log, and resume from the last event. Credentials are kept outside the sandbox and accessed through scoped resource initialization or a vault-backed proxy. Anthropic explicitly distinguishes the durable session from Claude's finite context window.

2. **Claude Managed Agents overview** — live Claude Platform documentation, reviewed **2026-11-16**  
   https://platform.claude.com/docs/en/managed-agents/overview

   The docs describe a pre-built managed harness for “long-running tasks and asynchronous work.” A configured agent is referenced across sessions; a session is a running task instance; events steer or interrupt it. Listed use cases include minute-to-hour execution, persistent filesystems and conversation history, self-hosted sandboxes, and recurring scheduled runs. The feature is documented as beta under the `managed-agents-2026-04-01` header, so behavior may change.

3. **Scheduled deployments** — live Claude Platform documentation, reviewed **2026-11-16**  
   https://platform.claude.com/docs/en/managed-agents/scheduled-deployments

   A scheduled deployment lets an agent start sessions autonomously on a cron cadence. Each run starts from configured instructions and may attach files, repositories, memory stores, and vaults. This is the clearest primary source for the colloquial “always-on” idea—but it specifies **recurring sessions**, not an agent that is continuously executing between events.

4. **Using agent memory** — live Claude Platform documentation, reviewed **2026-11-16**  
   https://platform.claude.com/docs/en/managed-agents/memory

   Memory stores provide text documents that survive across otherwise fresh sessions. Agents read and write them using file tools; each update creates an immutable version. This supplies continuity for preferences, project conventions, domain context, and prior mistakes, but it is explicit stored state—not persistent model cognition.

5. **Long-running Claude for scientific computing** — Anthropic Research, published **2026-03-23**  
   https://www.anthropic.com/research/long-running-claude

   Anthropic describes multi-day workflows where a high-level objective is delegated to agents with occasional rather than continuous oversight. The operating pattern uses `CLAUDE.md` for goals and constraints, a progress file as portable memory, Git commits as recoverable coordination, tests/reference implementations as oracles, and detached compute sessions. Anthropic reports one C-compiler effort spanning roughly 2,000 sessions and a scientific-computing example progressing over several days, while acknowledging incomplete testing, elementary mistakes, and a non-production-grade result.

6. **Effective harnesses for long-running agents** — Anthropic Engineering, published **2025-11-26**  
   https://www.anthropic.com/research/effective-harnesses-for-long-running-agents

   This earlier harness work frames the core problem: complex tasks span hours or days, but each new context starts without memory of the preceding session. Anthropic's proposed pattern uses an initializer, a feature list, incremental work, progress notes, Git history, tests, and clean handoffs. It is evidence that persistence lives substantially in the **harness and artifacts**, not in one indefinitely extended model turn.

7. **Measuring AI agent autonomy in practice** — Anthropic Research, published **2026-02-18**  
   https://www.anthropic.com/research/measuring-agent-autonomy

   Anthropic's deployment study reports that the 99.9th-percentile Claude Code turn increased from under 25 minutes to over 45 minutes between late September 2025 and early January 2026; most turns remained short, with a median near 45 seconds. Experienced users used full auto-approve more often but also interrupted more often. Anthropic concludes that oversight is shifting from approving every action toward monitoring and intervening when necessary. The paper also warns that public-API analysis sees isolated tool calls rather than complete customer agent sessions.

8. **Our framework for safe and trustworthy agents** — Anthropic, published **2025-08-04**  
   https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents

   Anthropic directly describes agents as independently handling projects with minimum human input while arguing that humans should retain control, especially before high-stakes actions. It emphasizes interruptibility, permissions, plan visibility, contextual judgment, and layered security.

## What the proposed operating model actually is

A plausible Anthropic-style persistent agent has the following loop:

1. **Configure identity and authority.** Select model, instructions, tools, skills, MCP servers, environment, network restrictions, permission policy, budget, and credentials.
2. **Start on an event or schedule.** A user message, defined outcome, webhook-driven application event, or cron schedule creates or wakes a session.
3. **Plan and act through tools.** Claude runs commands, edits files, searches or fetches approved web content, and calls external services.
4. **Externalize state.** The system records an append-only event history; the agent may write progress notes, files, Git commits, or versioned memories.
5. **Bound and observe execution.** Budgets, permission policies, networking constraints, tests, reviewers, status events, and human interruptions limit the run.
6. **Pause, recover, or resume.** A run can idle, ask for clarification, stop at a budget, recover from transient failures, or later resume from durable state.
7. **Repeat.** Another event or scheduled deployment starts further work, potentially using shared memory from earlier sessions.

This differs from an ordinary request/response model call in several ways:

| Request/response call | Persistent managed agent |
| --- | --- |
| One prompt produces one bounded response | A session can perform many model/tool cycles |
| Application owns orchestration | Managed harness owns the agent loop and event routing |
| Context is mainly the request payload | Durable event logs, files, Git, and memory survive outside a context window |
| Caller waits synchronously or builds a job system | Work can run asynchronously, emit status, idle, and be revisited |
| Failure often ends the call | Stateless harnesses and replaceable sandboxes can recover around durable session state |
| Human supplies each next turn | The agent can choose intermediate steps and tools, while humans steer or interrupt |

## Direct statements versus synthesis

### Directly supported by Anthropic

- Agents can run autonomously for minutes or hours; Anthropic has demonstrated multi-day, multi-session work.
- Managed Agents separates durable sessions, replaceable harnesses, and execution sandboxes.
- Scheduled deployments autonomously start sessions on a recurring cadence.
- Memory stores and files can persist information across sessions.
- Human oversight can shift from per-action approval to monitoring, interruption, clarification, and high-stakes approval.
- Security settings reduce but do not eliminate prompt-injection, credential, exfiltration, and unexpected-action risks.

### Scout synthesis or inference

- “Always-on” most likely compresses several Anthropic concepts rather than naming a single official proposal.
- The more accurate architectural description is **event-driven durable autonomy**, not continuous cognition.
- A useful mental model is a supervised service worker with durable records and replaceable execution processes, rather than a permanently running chatbot.
- The governance unit should increasingly be the **deployment**—its objective, authority, data access, schedule, budget, versions, and audit trail—not only an individual model response.

## Practical implications

- **Asynchronous labor becomes a product primitive.** Applications can assign work and receive completion or exception events instead of holding an interactive chat open.
- **Idle time becomes schedulable work time.** Anthropic's scientific-computing account explicitly frames nights without agents running as foregone potential progress, for tasks with clear criteria and sufficient compute.
- **State architecture matters as much as model quality.** Durable logs, memory, checkpoints, and testable artifacts determine whether work survives context resets and component failures.
- **Human work moves up a level.** People invest more in defining outcomes, constraints, test oracles, approvals, and intervention boundaries, and less in directing every step.
- **Operational cost and observability become central.** Long runs need spend ceilings, status transitions, retries, audit history, and termination semantics.

## Constraints, security, and governance questions

### Technical constraints

- **Finite and lossy context:** long work still requires selecting, compacting, or retrieving relevant history; durable storage does not guarantee the model will recall the right fact.
- **Error compounding:** a wrong early assumption can persist through many steps or sessions.
- **Weak self-evaluation:** Anthropic's harness work reports that agents can praise mediocre output and may need separate evaluators or objective tests.
- **Oracle dependence:** current successes are strongest where tests, reference implementations, measurable targets, or reversible actions reveal progress.
- **Reliability and cost:** sandbox startup, model calls, retries, and tool use accumulate latency and expense; budgets can pause work but cannot ensure value.
- **Version drift:** agent behavior depends on changing models, harnesses, tools, prompts, and memory. Anthropic's Managed Agents endpoints are still beta.

### Security and safety risks

- **Prompt injection:** hidden instructions in tickets, pages, repositories, or documents can redirect an agent.
- **Credential abuse and data exfiltration:** accessible tools or secrets may be used in unexpected ways; keeping secrets outside the sandbox narrows but does not remove risk.
- **Over-broad authority:** a persistent agent can repeat a mistaken or malicious action at machine cadence.
- **Memory poisoning:** durable shared memory can preserve false or adversarial instructions across future sessions.
- **Monitoring gaps:** offline review can detect a bad step after the fact, but not prevent every irreversible effect.
- **Human automation bias:** increasing auto-approval may reflect learned trust, permission fatigue, or both; Anthropic's observed higher interrupt rate among experienced users is encouraging but not proof of adequate oversight.

### Governance questions

- Who may create or change a recurring deployment, its objective, tools, schedule, memory, and spend?
- Which actions require synchronous approval, and which are merely reviewed afterward?
- How are memory changes attributed, versioned, corrected, or rolled back?
- What evidence proves that a run met its objective without harmful side effects?
- Who is accountable when model, harness, tool provider, deployment owner, and data owner are different organizations?
- What retention, deletion, privacy, residency, and incident-reporting rules apply to durable event histories and memory stores?
- How can an operator reliably revoke credentials, schedules, sessions, and descendants during an incident?

## Near-term versus longer-term interpretation

**Near term (supported by current Anthropic material):** managed coding, research, monitoring, triage, report generation, and other bounded jobs that run for minutes to days; recurring sessions; durable memory and logs; objective tests; constrained tools; human steering and high-stakes approvals.

**Longer term (plausible, but not established by these sources):** continuously available “digital coworkers” that monitor many event streams, maintain evolving organizational memory, coordinate multiple agents and execution environments, and initiate broad work with sparse supervision. Anthropic's architecture anticipates many “brains” and “hands,” but the reviewed material does not prove general reliability, safe open-ended goal pursuit, or human-equivalent judgment over indefinite horizons.

## Coverage limitations

- Scout reviewed the full extracted text of the named Anthropic articles and the relevant sections of the live Managed Agents documentation; it did not test the beta APIs or reproduce Anthropic's demonstrations and telemetry analyses.
- Live documentation does not provide a stable publication date on the reviewed pages; it is cited with the observation date and beta-version header.
- Anthropic's reported autonomy metrics are provider analyses of its own products/API traffic and have stated visibility and generalization limits.
- The scientific and harness examples are demonstrations, not independent evidence that arbitrary long-running work is reliable.
- This review did not establish which secondary article, talk, or paraphrase originally supplied the user's exact phrase “always-on.”
