import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";

const expectedRootExports = [
  "AppDefinition",
  "AppDependencyObservation",
  "AppDisposition",
  "AppEvent",
  "AppEventTarget",
  "AppInboxBatchMode",
  "AppInput",
  "AppInputSource",
  "AppRead",
  "AppRequest",
  "AppResult",
  "AppTaskAttachment",
  "Condition",
  "EventSelector",
  "ExecutionResult",
  "ExecutionView",
  "Logger",
  "MetricView",
  "ObserverContext",
  "Static",
  "TaskIntent",
  "TaskMode",
  "TaskPriority",
  "TaskView",
  "TSchema",
  "Type",
  "WorkflowContext",
  "WorkflowInput",
  "defineApp",
].sort();

describe("public SDK root", () => {
  test("exports exactly the stable App authoring contract", () => {
    const sdkDir = resolve(import.meta.dir, "..");
    const configPath = resolve(sdkDir, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(config.error).toBeUndefined();

    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, sdkDir);
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const source = program.getSourceFile(resolve(import.meta.dir, "index.ts"));
    expect(source).toBeDefined();

    const checker = program.getTypeChecker();
    const moduleSymbol = checker.getSymbolAtLocation(source!);
    expect(moduleSymbol).toBeDefined();

    const actual = checker
      .getExportsOfModule(moduleSymbol!)
      .map((symbol) => symbol.name)
      .sort();

    expect(actual).toEqual(expectedRootExports);
  });
});
