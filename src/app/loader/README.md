# Agent definitions and file-tool scope

Agent configuration is trusted executable installation policy. `AGENTS.md`,
skills, memory and tool-call arguments cannot grant protected-file writes.
Reviewed `agent.json` may declare exact installation-relative files:

```json
{
  "protectedFileWrites": ["shared/philosophy.md", "agents/reviewer/AGENTS.md"]
}
```

These grants apply only to the existing coding `write` and `edit` tools. Missing
grants mean no exception, including for profiles named `may`, `tech-lead` or
`evaluator`. Malformed grants reject the prepared generation. No glob, directory
prefix, automatic role or self-request expands the list. An explicit grant to
an `agent.json` grants control of that profile's configuration, including its
grants; review it as authority to administer that profile, not merely to change
one setting. Do not grant it for routine guidance editing.

The loader resolves scope against the writable installation root, not the
App's working directory or its immutable source snapshot. Its discovered
canonical identity folder determines self-owned guidance; an agent with the
same name in another folder is not the same owner. Normal self-guidance and
non-protected writes retain their existing behavior. Shared guidance, identity
configuration and the legacy evaluation-truth paths retain their protection.
The legacy evaluation path list is a protection floor, not a name-based grant.

An approved reload builds new tools with the selected configuration. Existing
tools keep their captured scope; invalid replacements do not publish a new
generation. Never rely on modifying prompt text to activate a permission.

## Adoption and limits

This removes implicit privileged-name exceptions. Before deploying, review the
installation's needed protected-file writes and configure only those exact
files. Do not reconstruct a universal administrator grant. Unconfigured
protected edits will be denied rather than silently retaining an exemption.
No installed configuration is rewritten by the Host.

These are lexical file-tool guards, **not a filesystem sandbox**. They do not
confine shell commands, native agents, custom tools, symlink aliases or arbitrary
code running under the installation's OS account. Those capabilities need their
own trusted construction and operating-system isolation when required. Direct
tool constructors must supply the correct installation root and ownership
context; the hosted loader supplies them automatically.
