# Session failure evidence

- Four failed sessions all used provider `copilot` between 09:10 and 09:17.
- The provider health log records HTTP 401 beginning at 09:09.
- Sessions using the `openai` provider in the same interval succeeded.
- No application code or prompt changed during the interval.
- A small Copilot canary can be compared with an OpenAI control without changing credentials or provider configuration.
- `tech-lead` owns provider remediation if May plans an implementation handoff.
