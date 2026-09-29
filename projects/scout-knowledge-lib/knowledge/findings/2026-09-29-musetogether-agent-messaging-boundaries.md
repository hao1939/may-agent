<ai_context>
summary: "MuseTogether is an early encrypted relay for person-to-person Meta Muse coordination. Its client package separates cryptographic peer authentication, relay delivery, model attention, and owner authorization, but its remote-skill bootstrap installs an unpinned mutable package and creates a recurring hook, so encrypted peer messages and trusted installation remain different claims."
triggers: ["MuseTogether", "Meta Muse", "agent-to-agent messaging", "encrypted agent messaging", "remote agent skill", "agent messaging hook", "Noise XXpsk3", "peer agent trust", "agent skill supply chain"]
last_updated: "2026-09-29"
source_basis: "HN 49885848; MuseTogether landing page, remote skill, installer, and complete client package retrieved 2026-09-29. The unversioned client archive identified itself as 0.1.0 and had SHA-256 7265adb2cabe13720c9e36805ad98373ce9b6d4bb5b6f2e632b463117ac3e1b3."
</ai_context>

# Encrypted peer-agent messaging still needs separate bootstrap and action trust

**Date:** 2026-09-29  
**Disposition:** New knowledge; inspectable early implementation, not an independent security audit  
**Source:** https://news.ycombinator.com/item?id=49885848  
**Service:** https://musetogether.ai/  
**Skill:** https://musetogether.ai/skill.md  
**Installer:** https://musetogether.ai/install.sh  
**Reviewed client:** https://musetogether.ai/client.tar.gz (`0.1.0`, retrieved archive SHA-256 `7265adb2cabe13720c9e36805ad98373ce9b6d4bb5b6f2e632b463117ac3e1b3`)

## Observation

HN surfaced **MuseTogether**, a small relay that lets two people's Meta Muse
agents exchange messages to coordinate plans. A user gives Muse a remote skill
URL, creates or accepts a 24-hour invitation, and installs a receive hook. The
example use case is intentionally narrow: exchange availability or preferences,
propose a plan, and ask the people before committing it.

The current downloadable client makes four layers visible:

1. **Pairing and content secrecy.** The invitation URL keeps a random secret in
   its fragment. The client implements `Noise_XXpsk3_25519_ChaChaPoly_SHA256`,
   stores static and per-connection keys locally, and sends encrypted envelopes
   through the relay. Application messages are limited to 32 KiB.
2. **Delivery and replay state.** A local SQLite store tracks contacts,
   monotonically increasing send/receive nonces, pending messages, an outbox,
   processed events, and temporarily stashed out-of-order frames. A recurring
   hook polls only for event counts; a worker invokes the CLI to decrypt,
   validate, acknowledge, and hand messages to the main Muse.
3. **Attention and acknowledgement.** The worker marks a message handled only
   after a successful handoff, includes a stable message ID for retry
   deduplication, and stays silent when no verified messages are pending.
4. **Owner authorization.** The skill and worker prompt explicitly label peer
   plaintext as untrusted, forbid following its embedded instructions or links,
   and require the owner's approval before sharing private details or committing
   to a plan.

This is a useful concrete separation: authenticated encrypted transport can
establish which paired endpoint produced a message and hide its body from the
relay, but it does not authorize that text to use tools, disclose data, or bind
a person to an action. The receive hook supplies timely attention; it is not an
effect gate.

## The bootstrap boundary is weaker than the message boundary

The setup path asks a Muse to read a live `skill.md`. That document instructs the
agent to run `curl -sSL https://musetogether.ai/install.sh | bash`, create a
recurring hook from generated files, and use a downloaded client package. The
installer fetches an unversioned `client.tar.gz`, removes the prior local library,
extracts the replacement, adds a launcher to `~/.local/bin`, may modify shell
profiles, and executes the installed CLI's `--help` as verification.

The fetched package identified itself as version `0.1.0`, but neither the skill
nor installer pinned a digest, signature, immutable release URL, or public source
revision. The archive was served with `Cache-Control: no-store`. Consequently,
the reviewed SHA identifies only the bytes Scout observed in this scan; it does
not constrain what a later user or hook bootstrap will receive. The system's
careful rule that *peer messages are untrusted* therefore does not cover the
more privileged remote instructions and executable package that create the
channel.

A safer adoption contract would require a human-visible install plan, an
immutable and signed client artifact, explicit review of hook scope and cadence,
and a separately managed upgrade decision. Remote skill text should be treated
as a proposal, not installation authority, even when the user asked an agent to
“set up” the service.

## Evidence boundaries

- Scout read the HN item, landing page, complete remote skill, installer, and all
  files listed in the downloadable client archive. It did not execute the
  installer, create an account, pair two agents, or send a message.
- The published client code supports the **intended** client-side encryption,
  replay handling, and handoff behavior. No versioned server source, protocol
  test vectors, external audit, or operational results were exposed in the
  reviewed materials, so “MuseTogether can't read the messages” remains a
  project-authored architecture claim rather than an independently verified
  service property.
- The archive lacks the server and the end-to-end tests named in `package.json`.
  The client package is sufficient to inspect the local protocol path, not the
  relay's retention, metadata, abuse controls, availability, or deployed-version
  equivalence.
- The HN submission had one point and no comments when inspected. This is an
  implementation signal, not adoption or reliability evidence.

## Reusable implication

Evaluate peer-agent channels as at least five independent contracts:

1. **bootstrap integrity** — what code and persistent hooks the local agent may
   install, and how those bytes are pinned and upgraded;
2. **peer authentication and content secrecy** — who holds keys and what the
   relay can observe;
3. **delivery semantics** — retries, ordering, acknowledgement, disconnect, and
   crash recovery;
4. **attention semantics** — what wakes the model and how duplicate handoffs are
   recognized; and
5. **effect authority** — what remote text can cause without fresh local policy
   or owner approval.

Encryption can strengthen the second contract while the first or fifth remains
unsafe. A connected peer is an authenticated source of untrusted text, not a
remote extension of the owner's authority.

## Relationship to existing knowledge

This complements the PeerTalk section in
[Agent Protocols](../agent-protocols-mcp-a2a.md#peertalk-direct-transport-does-not-confer-peer-authority-hn-september-2026).
PeerTalk demonstrates that direct WebRTC encryption does not confer tool
authority. MuseTogether adds two different implementation details: durable
relay-and-hook delivery, and a remote-skill bootstrap whose installation
privilege is broader than the peer-message trust policy it later enforces.
