# Scout tools and helpers

The Host treats top-level `.ts` and `.js` files here as agent-tool factories:
each must default-export a factory that returns a named tool. Tests and type
declarations are excluded. Keep other `.ts`/`.js` helper modules under `lib/`
so the Host does not try to register them as tools.

Xiaohongshu access uses the existing `xhs-browse.mjs` CLI through the agent's
shell tool. `lib/xhs-credential.ts` and `lib/xhs-source.ts` are workflow/observer
helpers that call this CLI and interpret its results; they are not agent tools.
Their tests live beside them. The CLI and its `.mjs` support files remain here;
the CLI path and browser configuration are unchanged.
