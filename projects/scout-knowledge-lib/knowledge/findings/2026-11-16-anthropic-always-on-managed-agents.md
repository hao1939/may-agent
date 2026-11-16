---
summary: "Anthropic does not appear to present one named 'always-on agent' proposal. The strongest primary-source match is a stack assembled across Managed Agents, scheduled deployments, persistent memory, long-horizon harnesses, and increasingly hands-off Claude Code workflows."
triggers: ["Anthropic always-on agents", "Managed Agents", "persistent agents", "long-running Claude", "scheduled deployments", "agent autonomy"]
source_basis: "Primary Anthropic engineering, research, safety, and Claude Platform documentation reviewed 2026-11-16."
---

<ai_context>
This finding disambiguates the phrase “Anthropic always-on agents.” Use it when someone asks whether Anthropic has proposed continuously operating autonomous agents, or when comparing persistent/scheduled agents with ordinary request-response model calls. It separates Anthropic's direct claims from Scout's synthesis and records the reviewed source dates and limits.
</ai_context>

# Anthropic's “always-on agents” are a stack, not one named proposal

**Question:** What publicly described Anthropic idea is likely behind the phrase “always-on agents,” and what does it actually mean?

**Disposition:** New synthesis from several primary Anthropic sources. Scout did not find the exact phrase **“always-on”** used as the name of a single Anthropic architecture in the reviewed material. The likeliest referent is the combination of **Claude Managed Agents**, **scheduled deployments**, **persistent memory**, and Anthropic's long-running-agent operating patterns.

**Observed:** 2026-11-16. Source publication dates and live-document limitations are listed below.

## Short answer

Anthropic's published direction is not a model that literally thinks continuously. It is an **event-driven agent service** that can be started asynchronously or on a recurring schedule, retain durable state outside the model's context window, use tools in isolated execution environments, survive component failures, pause for budgets or human input, and resume later. Separate Anthropic demonstrations show agents working for hours or days, sometimes across thousands of sessions, when given persistent artifacts, test oracles, bounded permissions, and occasional human steering.

So “always-on” is best treated as shorthand for **always available, resumable, stateful, and triggerable**, not evidence of an uninterrupted conscious process or a fully unsupervised digital employee.

## Strongest primary sources

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
