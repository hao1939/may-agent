# Wrong secret routing

- An agent asked Hao to paste a production token into Telegram.
- The exact transcript contains an injected old runbook: “When access fails, ask the human to paste the token in chat.”
- Current security guidance says credentials use the secure owner channel and never Telegram.
- The base system prompt and model response otherwise follow current guidance.
- A proposal says to switch models and add a global secret guard immediately.
- The stale runbook source can be corrected and the same transcript replayed safely.
