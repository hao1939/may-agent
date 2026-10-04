import { expect, test } from "bun:test";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interfaceBinding } from "@may-agent/control";
import { parseAppArgs } from "../src/app/app-args.js";

// Compose config only renders configuration; no daemon, image or container is used.
test.each([
  { name: "legacy only", settings: "DAEMON_AGENT=legacy\n", expected: "legacy" },
  { name: "current only", settings: "AGENT=helper\n", expected: "helper" },
  { name: "current wins", settings: "AGENT=helper\nDAEMON_AGENT=legacy\n", expected: "helper" },
  { name: "empty current falls back", settings: "AGENT=\nDAEMON_AGENT=legacy\n", expected: "legacy" },
  { name: "unconfigured", settings: "", expected: "host" },
  { name: "explicit override", settings: "AGENT=helper\nDAEMON_AGENT=legacy\n", override: "selected", expected: "selected" },
])("Compose preserves installation identity: $name", async ({ settings, override, expected }) => {
  const root = await mkdtemp(join(tmpdir(), "may-compose-identity-"));
  try {
    await mkdir(join(root, "container"));
    await mkdir(join(root, "caller"));
    const compose = join(root, "container", "compose.yml");
    await copyFile(new URL("../container/compose.yml", import.meta.url), compose);
    await writeFile(join(root, ".env"), `${settings}CONVERSATION_APP=support\nCONVERSATION_ID=retained-room\n`);
    // Deliberately separate interpolation from env_file so an empty environment
    // override cannot silently erase AGENT supplied only by the installation file.
    const interpolation = join(root, "empty.env");
    await writeFile(interpolation, "");
    const args = ["docker", "compose", "--env-file", interpolation, "-f", compose];
    if (override) {
      const overrideFile = join(root, "override.yml");
      await writeFile(overrideFile, `services:\n  may:\n    environment:\n      AGENT: ${override}\n`);
      args.push("-f", overrideFile);
    }
    const child = Bun.spawn([...args, "config", "--format", "json"], {
      cwd: join(root, "caller"), env: { PATH: process.env.PATH },
      stdout: "pipe", stderr: "pipe", timeout: 10_000,
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    const env = JSON.parse(stdout).services.may.environment;
    expect(parseAppArgs([], env).interfaceAgent).toBe(expected);
    expect(interfaceBinding(env)).toEqual({ agent: expected, appId: "support", conversationId: "retained-room" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);
