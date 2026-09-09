import { expect, it } from "bun:test";
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";

it("enforces bounded imports with and without extensions, but allows neutral helpers", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  for (const filePath of [
    "src/lib/agent-runner.ts",
    "src/lib/agent-execution.ts",
    "src/app/app-runtime.ts",
    "src/app/transport/socket.ts",
  ]) {
    const forbidden: string[] = [];
    if (filePath.startsWith("src/lib/")) {
      const libModules = ["requests", "persistence", "metrics", "manager"];
      const appModules = ["event-bus", "app-task-runtime", "cron"];
      forbidden.push(...libModules.flatMap((name) => ["", ".js", ".ts"].map((ext) => `./${name}${ext}`)));
      forbidden.push(...appModules.flatMap((name) => ["", ".js", ".ts"].map((ext) => `../app/${name}${ext}`)));
      forbidden.push("bun:sqlite");
      forbidden.push("../app/core/events/bus.js", "../app/core/tasks/controller.js");
    } else {
      const rel = filePath === "src/app/app-runtime.ts" ? "./app-task-runtime" : "../app-task-runtime";
      forbidden.push(...["", ".js", ".ts"].map((ext) => `${rel}${ext}`));
    }
    const allowed = filePath.startsWith("src/lib/")
      ? "./manager-utils.js"
      : filePath === "src/app/app-runtime.ts"
        ? "./app-task-capability.js"
        : "../../../packages/control/src/server.js";
    // Multiline imports caught incorrectly by the old line-text tests, and
    // extensionless imports that previously bypassed the new lint rule.
    const source =
      forbidden
        .map((path, index) => `import {\n  value${index}\n} from ${JSON.stringify(path)};\nvoid value${index};`)
        .join("\n") + `\nimport * as helper from ${JSON.stringify(allowed)};\nvoid helper;\n`;
    const [result] = await eslint.lintText(source, { filePath });
    const violations = result.messages.filter((message) => message.ruleId === "no-restricted-imports");
    expect(violations.map((message) => message.line)).toEqual(forbidden.map((_, index) => index * 4 + 1));
    expect(result.messages).toHaveLength(forbidden.length);
  }
});

it("keeps concrete adapters and composition out of core, but allows wiring and boundary tests", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  const source = [
    'import { adapter } from "../../adapters/workspaces/git.js"; void adapter;',
    'import type { Wiring } from "../../composition/task-execution.js"; export type Check = Wiring;',
    'export { adapter } from "../../adapters/workspaces/git";',
    'import type { TaskWorkspaces } from "./workspace.js"; export type Contract = TaskWorkspaces;',
  ].join("\n");
  for (const filePath of ["src/app/core/tasks/controller.ts", "src/app/app-task-runtime.ts"]) {
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages.map(({ ruleId, line }) => [ruleId, line])).toEqual([
      ["no-restricted-imports", 1],
      ["no-restricted-imports", 2],
      ["no-restricted-imports", 3],
    ]);
  }
  for (const filePath of ["src/app/composition/task-execution.ts", "src/app/core/tasks/controller.test.ts"]) {
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages).toEqual([]);
  }
});
