import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import ts from "typescript";

const expectedRootExports = [
  "AgentCallOptions",
  "AppAction",
  "AppAnalysisRequest",
  "AppWorkView",
  "AppConversationMessage",
  "AppConversationResource",
  "AppContinueDisposition",
  "AppDefinition",
  "AppDependencyObservation",
  "AppDisposition",
  "AppEvent",
  "AppEventSubscription",
  "AppEventTarget",
  "AppInboxBatchMode",
  "AppInput",
  "AppInputSource",
  "AppObserver",
  "AppRead",
  "AppRequest",
  "AppResourceRef",
  "AppResult",
  "AppSchedule",
  "AppTaskAttachment",
  "AppTaskPolicy",
  "AppWorkspace",
  "AppWorkDisposition",
  "Condition",
  "Demand",
  "EventSelector",
  "ExecutionResult",
  "ExecutionView",
  "Logger",
  "GuardModule",
  "MIN_CONDITION_REVIEW_AFTER_MS",
  "MetricDefinition",
  "MetricRecordOptions",
  "MetricView",
  "ObserverContext",
  "Static",
  "StructuredWorkflowResult",
  "TaskAcceptanceBasis",
  "TaskAction",
  "TaskIntent",
  "TaskMode",
  "TaskPriority",
  "TaskReconciliationChild",
  "TaskReconciliationContext",
  "TaskReconcileAdmission",
  "TaskReconcileAdmissionOptions",
  "TaskReconcileResult",
  "TaskReconcileState",
  "TaskView",
  "TaskVerificationContext",
  "TaskVerificationResult",
  "TaskVerifier",
  "TSchema",
  "Type",
  "WorkflowContext",
  "WorkflowCheckResult",
  "WorkflowGuard",
  "WorkflowGuardCompletedStep",
  "WorkflowGuardEvent",
  "WorkflowGuardStepResult",
  "WorkflowInput",
  "WorkflowIoContract",
  "WorkflowMetricCapability",
  "WorkflowProblem",
  "WorkflowResultStatus",
  "WorkflowSubject",
  "admitTaskReconcileResult",
  "admitTaskVerificationResult",
  "conditionSchema",
  "defineApp",
  "isTypedConditionSubject",
  "matchesEventSelector",
  "taskActionSchema",
  "taskOwnerResultSchema",
  "taskReconcileResultSchema",
  "taskVerificationResultSchema",
  "workflowResult",
  "workflowResultVersion",
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
