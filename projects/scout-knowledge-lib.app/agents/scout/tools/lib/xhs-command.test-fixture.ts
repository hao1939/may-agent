import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Local adapter process held at a known command; never contacts XHS or Chrome. */
export function xhsCommandFixture(
  command = "status",
  exitCode = 0,
  stderr = false,
) {
  const root = mkdtempSync(join(tmpdir(), "scout-xhs-command-"));
  const started = Promise.withResolvers<number>();
  const output = Promise.withResolvers<Response>();
  const calls: string[][] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 0,
    fetch(request) {
      const url = new URL(request.url);
      const pid = Number(url.searchParams.get("pid"));
      calls.push(JSON.parse(url.searchParams.get("argv")!));
      started.resolve(pid);
      return output.promise;
    },
  });
  const tools = join(root, "agents", "scout", "tools");
  mkdirSync(tools, { recursive: true });
  writeFileSync(
    join(tools, "xhs-browse.mjs"),
    `
    process.on("SIGTERM", () => {});
    if (process.argv[2] !== ${JSON.stringify(command)}) {
      console.log(JSON.stringify({ status: "success", data: { ready: true, noteCount: 1, loginWall: false } }));
    } else {
      const url = new URL(${JSON.stringify(server.url.href)});
      url.searchParams.set("pid", String(process.pid));
      url.searchParams.set("argv", JSON.stringify(process.argv.slice(2)));
      const response = await fetch(url);
      process.${stderr ? "stderr" : "stdout"}.write(await response.text());
      process.exitCode = ${exitCode};
    }
  `,
  );
  return {
    root,
    calls,
    started: started.promise,
    release(text: string) {
      output.resolve(new Response(text));
    },
    close() {
      output.resolve(new Response("fixture closed"));
      server.stop(true);
      rmSync(root, { recursive: true, force: true });
    },
  };
}
