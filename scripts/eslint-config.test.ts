import { expect, it } from "bun:test";
import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";

it("keeps loader imports independent of the runtime barrel that exports them", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  const source = [
    'import { loadAgents } from "../../lib/index.js"; void loadAgents;',
    'export { createReadTool } from "../../lib/index";',
    'import type { SubagentManager } from "../../lib/manager.js"; export type Manager = SubagentManager;',
    'import { createReadTool } from "../../lib/tools/read.js"; void createReadTool;',
  ].join("\n");
  for (const filePath of ["src/app/agent-loader.ts", "src/app/loader/toolset-loader.ts"]) {
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages.map(({ ruleId, line }) => [ruleId, line])).toEqual([
      ["no-restricted-imports", 1],
      ["no-restricted-imports", 2],
    ]);
  }
});

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
      const appModules = ["core/events/bus", "core/tasks/app-task-runtime", "cron"];
      forbidden.push(...libModules.flatMap((name) => ["", ".js", ".ts"].map((ext) => `./${name}${ext}`)));
      forbidden.push(...appModules.flatMap((name) => ["", ".js", ".ts"].map((ext) => `../app/${name}${ext}`)));
      forbidden.push("bun:sqlite");
      forbidden.push("../app/core/events/bus.js", "../app/core/tasks/controller.js");
    } else {
      const rel = filePath === "src/app/app-runtime.ts" ? "./core/tasks/app-task-runtime" : "../core/tasks/app-task-runtime";
      forbidden.push(...["", ".js", ".ts"].map((ext) => `${rel}${ext}`));
    }
    const allowed = filePath.startsWith("src/lib/")
      ? "./manager-utils.js"
      : filePath === "src/app/app-runtime.ts"
        ? "./core/tasks/app-task-capability.js"
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

it("keeps capability implementations out of core, but allows wiring and boundary tests", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  const source = [
    'import { adapter } from "../../adapters/workspaces/git.js"; void adapter;',
    'import type { Wiring } from "../../composition/task-execution.js"; export type Check = Wiring;',
    'export { adapter } from "../../adapters/workspaces/git";',
    'import { createConversationTurnHandler } from "../../conversations/turn-handler.js"; void createConversationTurnHandler;',
    'export { prepareConversationInput } from "../../conversations/context";',
    'import type { TaskWorkspaces } from "./workspace.js"; export type Contract = TaskWorkspaces;',
    'import { appOwnerReviewEvent } from "../../app-input-event.js"; void appOwnerReviewEvent;',
    'export { appOwnerReviewEvent } from "../../app-input-event";',
    'import { getDb } from "../../../lib/requests.js"; void getDb;',
    'export { closeDb } from "../../../lib/requests";',
    'import { getDb as connection } from "../../../lib/db/connection.js"; void connection;',
  ].join("\n");
  for (const filePath of [
    "src/app/core/tasks/controller.ts",
    "src/app/core/inbox/input-context.ts",
    "src/app/core/state/inbox.ts",
    "src/app/core/inbox/app-inbox-host.ts",
    "src/app/core/tasks/app-task-runtime.ts",
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages.map(({ ruleId, line }) => [ruleId, line])).toEqual([
      ["no-restricted-imports", 1],
      ["no-restricted-imports", 2],
      ["no-restricted-imports", 3],
      ["no-restricted-imports", 4],
      ["no-restricted-imports", 5],
      ["no-restricted-imports", 7],
      ["no-restricted-imports", 8],
      ["no-restricted-imports", 9],
      ["no-restricted-imports", 10],
    ]);
  }
  for (const filePath of [
    "src/app/composition/task-execution.ts",
    "src/app/composition/conversation-inbox.ts",
    "src/app/core/tasks/controller.test.ts",
    "src/app/core/inbox/input-context.test.ts",
    "src/app/core/state/inbox.test.ts",
    "src/app/core/inbox/app-inbox-host.test.ts",
  ]) {
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages).toEqual([]);
  }
});

it("keeps executor value imports out of lifecycle mutation modules while allowing contract types", async () => {
  const eslint = new ESLint({ cwd: fileURLToPath(new URL("../", import.meta.url)) });
  const modules = [
    "tasks/app-task-runtime",
    "tasks/app-task-reconciler",
    "tasks/app-task-store",
    "state/app-task-resource-store",
  ];
  for (const filePath of ["src/app/adapters/executors/managed-agent.ts", "src/app/adapters/executors/codex/probe.ts"]) {
    const prefix = filePath.includes("/codex/") ? "../../../core/" : "../../core/";
    const forbidden = modules.flatMap((name) => ["", ".js", ".ts"].map((ext) => `${prefix}${name}${ext}`));
    const source = [
      ...forbidden.map((path, index) => `import { value${index} } from ${JSON.stringify(path)}; void value${index};`),
      ...forbidden.map(
        (path, index) =>
          `import type { Type${index} } from ${JSON.stringify(path)}; export type Contract${index} = Type${index};`,
      ),
      `import { APP_TASK_RECOVERY_OWNER } from "${prefix}tasks/session-binding.js"; void APP_TASK_RECOVERY_OWNER;`,
    ].join("\n");
    const [result] = await eslint.lintText(source, { filePath });
    expect(result.messages.map(({ ruleId, line }) => [ruleId, line])).toEqual(
      forbidden.map((_, index) => ["no-restricted-imports", index + 1]),
    );
    const [testResult] = await eslint.lintText(source, { filePath: filePath.replace(/\.ts$/, ".test.ts") });
    expect(testResult.messages).toEqual([]);
  }
});
