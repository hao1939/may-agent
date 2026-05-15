# Scout heartbeat token-expiry investigation — 2026-05-11

## Signal

May sent a P1 implementation request: Scout heartbeat has failed 3+ consecutive times with `401 litellm.AuthenticationError: Github_copilotException - IDE token expired` on the `gemini-3.1-pro-preview` Copilot lane, contributing to `agent.heartbeat-dark-count-2h`.

## Evidence

- `agent.heartbeat-dark-count-2h` is active at `current=1`, `threshold=0`, `priority=P0`.
- Recent Scout heartbeat sessions show repeated errors: `s_1778490276681_28`, `s_1778488474398_8`, `s_1778486677175_5`, with intermittent successes earlier.
- Transcript grep for `s_1778490276681_28` shows provider `github-copilot`, model `gemini-3.1-pro-preview`, and final error:
  `401 litellm.AuthenticationError: Github_copilotException - IDE token expired: unauthorized: token expired. Received Model Group=gemini-3.1-pro-preview; Available Model Group Fallbacks=None`.
- `agents/scout/agent.json` currently sets `"model": "gemini-3.1-pro"`.
- This is not caused by Scout's task prompt; Scout explore sessions continue to complete because they are shorter, while creative heartbeat tends to need more turns and is exposed to token expiry.

## Attempted fix and blocker

The smallest safe local mitigation is to switch Scout to a non-Copilot-backed model already used successfully by other agents, e.g. `"opus"`, until Copilot token refresh/fallback is repaired. I attempted to edit `agents/scout/agent.json`, but the guard correctly blocked dev from modifying another agent's identity file:

> Agent 'dev' cannot modify agents/scout/agent.json. Only the owning agent, May, or tech-lead (for agent.json) can edit another agent's identity files.

This is therefore blocked on May/Scout/tech-lead applying the identity-file change or approving an equivalent runtime fallback.

## Recommended action

1. May/Scout/tech-lead: temporarily change `agents/scout/agent.json` model from `gemini-3.1-pro` to `opus` (or another non-Copilot model with healthy runtime evidence).
2. Commit the exact identity-file change.
3. Let the next Scout heartbeat run; validate `agent.heartbeat-dark-count-2h` returns to `0` on the next metrics snapshot and recent `workflow:scout-heartbeat` sessions are `done`.
4. Longer-term: configure model-group fallback or Copilot token refresh so `gemini-3.1-pro-preview` failures do not hard-stop heartbeats with `Available Model Group Fallbacks=None`.

## Event dispositions

- May P1 implementation-request: acted by investigating and attempting the direct fix; escalated/blocked because dev cannot edit Scout identity files.
- Red `session.finish-blocked-uncommitted-count-24h`: judged as `waiting_with_evidence` / existing project-level `document_exception`; current live slice has no unresolved dirty exits and paired strict metric remains healthy.
