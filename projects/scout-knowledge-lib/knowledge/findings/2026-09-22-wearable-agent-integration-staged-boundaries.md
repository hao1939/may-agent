<ai_context>
summary: "A Reddit builder report describes a wearable voice-agent integration assembled as a sequence of preserved, observable boundaries: prove microphone events first, add transport without changing capture, swap cloud transcription for a persistent local whisper.cpp server without changing the client protocol, and isolate the wearable in a separate agent session. The reusable signal is the integration method, not proof that this unpublished implementation is secure or generally reliable."
triggers: ["wearable agent", "smart glasses", "voice interface", "boundary-preserving integration", "incremental integration", "whisper.cpp", "Even Realities G2", "OpenClaw", "PCM audio", "WebSocket diagnostics"]
last_updated: "2026-09-22"
source_basis: "Readable Reddit Atom entry t3_1wmywi2 (full 9,524-character rendered entry text inspected); exact post JSON endpoint returned HTTP 403, so comments and JSON-only details were not reviewed."
</ai_context>

# Wearable agent integration: preserve and instrument each boundary

**Date observed:** 2026-09-22  
**Disposition:** New operational signal; self-reported work in progress  
**Coverage:** Readable-complete-body Atom entry; comments unavailable  
**Source:** https://www.reddit.com/r/EvenRealities/comments/1wmywi2/g2_glasses_with_openclawhermes_ai_agent_project/  
**Stable Reddit ID:** `t3_1wmywi2`

## What the source reports

A builder reports connecting Even Realities G2 glasses to a personal assistant
through this path:

`G2 microphone → 16 kHz PCM → authenticated WebSocket → Mac mini → local whisper.cpp → OpenClaw/Codex assistant → G2 display`

The post describes an incremental bring-up procedure rather than presenting the
stack as one indivisible application:

1. Create a separate G2 project and first prove only that microphone events
   arrive. The diagnostic display shows microphone state, temple-press count,
   the return value of `audioControl()`, PCM frame count, and the last event.
2. Add an automatic microphone-start attempt after three seconds when no temple
   event arrives. This distinguishes touch-input failure from microphone
   permission, audio-control, or PCM-delivery failure.
3. Preserve the working capture path while adding an authenticated WebSocket to
   a Mac bridge; keep credentials out of the glasses package.
4. Replace cloud transcription with a persistent localhost-only `whisper.cpp`
   server while leaving the client protocol unchanged. Keeping the model loaded
   avoids process/model startup for each utterance.
5. Send transcripts through a separate assistant conversation session so the
   wearable path does not interfere with an existing Telegram session.
6. Test the package privately on the actual glasses before moving it into a beta
   group.

The author also reports normalizing the wake-word variants “Alyx” and “Alex”
only near the start of an utterance, after Whisper confused the two. They say a
single spoken sentence traversed the full path successfully, and identify
transcription accuracy, latency across a command set, and pagination as future
work.

## Reusable implication

The strongest signal is a **boundary-preserving integration discipline**:
establish one observable invariant, freeze that working boundary, and change
only the next component. For physical-agent interfaces, end-to-end failure is
otherwise difficult to localize because input events, permission, buffering,
transport, transcription, wake-word handling, agent state, and presentation can
all fail independently.

This suggests a practical bring-up contract for embodied or peripheral agent
interfaces:

- expose a small receipt at every boundary (event count, return value, frame
  count, connection state, transcript, session ID, rendered response);
- preserve the interface to a verified component while replacing the next
  component behind it;
- isolate a new surface in its own project and agent session until interference
  and lifecycle behavior are understood;
- measure the real device path before treating a successful one-shot demo as
  operational readiness.

The pattern also separates privacy claims by stage. Local speech-to-text removes
one cloud transcription dependency, but the post still routes transcripts into
OpenClaw/Codex and does not establish that the overall assistant is local or
private.

## Evidence limits

This is one author's self-report in a Reddit post. The Atom entry contains a
long, apparently complete body with code excerpts and procedures, but the author
had not yet published the promised sanitized client and Node bridge. Scout did
not reproduce the build, inspect a repository, validate the SDK calls, measure
latency or transcription accuracy, audit the reverse proxy/WebSocket
authentication, or verify the claimed package artifact. The exact JSON endpoint
returned HTTP 403 during this scan, so comments and any JSON-only details were
not reviewed. These limits prevent treating the post as an implementation
benchmark, security review, or evidence of general reliability.
