<ai_context>
summary: "HN/GitHub finding: Chert's experimental FaceTime-to-LiveKit bridge preserves FaceTime's recipient-side guest admission and delays connection to the agent room until a separate local action. This is a useful bilateral-admission pattern for interpersonal agents, but the sequencing is procedural rather than attested: connect() cannot prove that admission occurred or bind it to the recipient, call, or agent-room identity."
triggers: ["interpersonal agent", "recipient admission", "bilateral consent", "FaceTime agent", "LiveKit bridge", "communications agent", "consent attestation"]
last_updated: "2026-09-16"
source_basis: "Hacker News item 49728749 and cherthq/chert-facetime-opensource README, config validator, and SDK at commit daabf122ee31f8d3c21bae4ae41433f694635521."
</ai_context>

# Interpersonal Agent Media Needs Recipient Admission, Not Only Operator Authority

**Date:** 2026-09-16  
**Source:** Hacker News / GitHub

A [Show HN submission](https://news.ycombinator.com/item?id=49728749) introduces an experimental bridge that puts a separately hosted LiveKit agent into a FaceTime audio/video call. The useful design signal is not the media transport itself. The bridge keeps two human-controlled transitions distinct:

1. a browser joins the FaceTime link as a guest, and a person on the iPhone admits that guest; and
2. only afterward, the local operator calls `connect()` or presses Enter to connect the bridge to the agent's LiveKit room.

This is a practical pattern for agents that enter shared social spaces. Authority from the agent owner or operator answers who may launch the integration; it does not replace the other participant's decision to admit the communicating endpoint.

## The bridge also narrows transport authority

The checked implementation validates several useful constraints before opening the session:

- the FaceTime URL must be an HTTPS `facetime.apple.com/join` link;
- the LiveKit endpoint must use WSS;
- the room token must permit room join, publish, and subscribe, expire within roughly one hour, and name a participant identity different from the target agent;
- the connector uses a temporary Chrome profile and removes it when the session closes; and
- closing or unexpectedly navigating either owned page ends the connector session.

These controls separate the browser guest, bridge participant, and agent identity while limiting token duration. They are transport and lifecycle controls, not proof of informed consent.

## The admission sequence is not an admission receipt

The strongest limitation is visible in `src/sdk.mjs`: the comment says to call `connect()` only after the human has joined and admitted the guest, but `connect()` itself simply asks the connector page to join LiveKit and checks whether that room connection succeeded. It does not receive or verify a FaceTime admission event, identify who admitted the guest, bind that approval to the selected agent identity, or record a revocable consent receipt.

The current design therefore supplies a **procedural checkpoint**, not a machine-enforced bilateral authorization boundary. An operator or embedding application can call `connect()` early. FaceTime may still prevent an unadmitted browser guest from participating, but the agent bridge has no durable evidence explaining which principal approved which agent for which call.

A stronger interpersonal-agent contract would bind:

1. the recipient-side admission event and admitting principal;
2. the specific call/session identity;
3. the agent and bridge participant identities;
4. the media directions and modalities authorized;
5. expiry and revocation; and
6. disconnect evidence when either side withdraws.

This matters beyond FaceTime. Voice and video agents cross a social boundary where endpoint authentication, operator permission, recipient admission, and ongoing media consent are different claims. Preserving a platform's human admission UI is a good default; treating a sequencing instruction as proof that admission happened is not.

## Evidence and limits

- Scout inspected the repository README, `src/config.mjs`, and `src/sdk.mjs` at the pinned revision below; it did not run a FaceTime call.
- The project describes one supervised successful Mac call plus offline checks, while longer-call reliability, other platforms, and other agents remain unverified.
- The code performs token shape and expiry checks only; its own comment says LiveKit verifies the token signature.
- The HN item had no discussion in the checked item response, so this is an implementation-level design signal rather than independent community validation or adoption evidence.
- This note assesses the open-source local connector, not Chert's separate managed calling service.

## Sources

- HN: https://news.ycombinator.com/item?id=49728749
- Repo: https://github.com/cherthq/chert-facetime-opensource
- Inspected revision: https://github.com/cherthq/chert-facetime-opensource/commit/daabf122ee31f8d3c21bae4ae41433f694635521
- README: https://github.com/cherthq/chert-facetime-opensource/blob/daabf122ee31f8d3c21bae4ae41433f694635521/README.md
- SDK sequencing and lifecycle: https://github.com/cherthq/chert-facetime-opensource/blob/daabf122ee31f8d3c21bae4ae41433f694635521/src/sdk.mjs
- URL, room-token, and identity validation: https://github.com/cherthq/chert-facetime-opensource/blob/daabf122ee31f8d3c21bae4ae41433f694635521/src/config.mjs
