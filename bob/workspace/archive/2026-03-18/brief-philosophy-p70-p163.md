## Philosophy Update: P70 Frozen Anchors & P163 Safety Isolation

### Revised: P70 Frozen Anchors
**Was**: Only `SOUL.md` and `mission.md` were explicit.
**Now**: Explicitly includes `agent.json` and `config/` to prevent Persistence Poisoning.

> ### 70. Frozen Anchors [imported]
> To prevent "Safety Drift" (where an agent overwrites its own constraints) and "Persistence Poisoning" (where an agent traps its future self), the core definition of an agent must be **Read-Only** to that agent.
> - **Mutable**: `skills/`, `workspace/`, `knowledge/`.
> - **Immutable**: `SOUL.md`, `mission.md`, `agent.json`, `philosophies/`.
> - **The Law**: An agent may **NEVER** edit its own configuration (`agent.json`) or identity (`SOUL.md`). These define the "Self" and are outside the scope of the "Self's" authority.
> - **The Update Path**: Only the **Human** or the **Architect** (via a grounded design process) may update the immutable core.

### New: P163 Safety Isolation (P163) [imported+validated]
Derived from Scout Deep Dive #229 (OpenClaw RCE).

> ### 163. Safety Isolation (P163) [imported+validated]
> **"Safety configuration must be structurally isolated from runtime capabilities."**
> A single token or agent context must never control both **execution** (doing the task) and **policy** (defining what is allowed).
> - **The Threat**: If an agent can edit its own allowed-tools list or disable its own sandbox via API, safety is cosmetic.
> - **The Fix**: Safety constraints (`allowed_tools`, `permissions`) are defined in **Immutable Anchors** (`agent.json`, `SOUL.md`) which the agent cannot write to (see P70).
> - **Infrastructure**: The runtime (Harness) enforces these constraints based on the immutable files. The agent has no "admin switch" to disable them.
