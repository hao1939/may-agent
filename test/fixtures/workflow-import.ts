import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** An observed, releasable top-level await; never leaves a fixture import hanging. */
export async function controlledWorkflowImport(root: string) {
  const gatePath = join(root, "import-gate.mjs");
  writeFileSync(gatePath, `
let enter, finish, release;
export const started = new Promise(resolve => { enter = resolve; });
export const completed = new Promise(resolve => { finish = resolve; });
export const waiting = new Promise(resolve => { release = resolve; });
export { enter, finish, release };
`);
  const gate = await import(pathToFileURL(gatePath).href) as {
    started: Promise<void>;
    completed: Promise<void>;
    release(): void;
  };
  return {
    ...gate,
    source: `
import { enter, finish, waiting } from ${JSON.stringify(pathToFileURL(gatePath).href)};
enter();
await waiting;
finish();
export const name = "slow-import";
export const description = "Controlled top-level await";
export async function execute(ctx) { return ctx.done("imported"); }
`,
  };
}

/** A test watchdog, not the execution timeout being tested. */
export async function observeBoundedResult<T>(run: Promise<T>): Promise<{ result: T } | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run.then((result) => ({ result })),
      new Promise<undefined>((resolve) => { timer = setTimeout(() => resolve(undefined), 1_500); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
