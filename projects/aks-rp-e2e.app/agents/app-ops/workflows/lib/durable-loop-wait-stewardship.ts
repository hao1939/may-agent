function numericProgressField(
  progress: Record<string, unknown>,
  key: string,
): number | null {
  const value = progress[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferredUnrepresentedNonTerminalCount(
  progress: Record<string, unknown>,
): number {
  const keys = [
    "pending",
    "residuePending",
    "error",
    "residueError",
    "fail",
    "residueFail",
    "prOpen",
    "residuePrOpen",
  ];
  return keys.reduce(
    (sum, key) => sum + (numericProgressField(progress, key) ?? 0),
    0,
  );
}

function incompleteFrontierCounts(progress: Record<string, unknown>): {
  running: number;
  openChildren: number;
  openSupportChildren: number;
  activeChildren: number;
  reviewChildren: number;
  waitingChildren: number;
  backlogChildren: number;
  openFollowups: number;
  openSpecVerifierChildren: number;
  blockedWaitChildren: number;
  unrepresentedNonTerminalCount: number;
  noRefillNow: boolean;
  dispatchHeld: boolean;
  backendBlocked: boolean;
} {
  return {
    running: numericProgressField(progress, "running") ?? 0,
    openChildren: numericProgressField(progress, "openChildren") ?? 0,
    openSupportChildren:
      numericProgressField(progress, "openSupportChildren") ?? 0,
    activeChildren: numericProgressField(progress, "activeChildren") ?? 0,
    reviewChildren: numericProgressField(progress, "reviewChildren") ?? 0,
    waitingChildren: numericProgressField(progress, "waitingChildren") ?? 0,
    backlogChildren: numericProgressField(progress, "backlogChildren") ?? 0,
    openFollowups: numericProgressField(progress, "openFollowups") ?? 0,
    openSpecVerifierChildren:
      numericProgressField(progress, "openSpecVerifierChildren") ?? 0,
    blockedWaitChildren:
      numericProgressField(progress, "blockedWaitChildren") ?? 0,
    unrepresentedNonTerminalCount:
      numericProgressField(progress, "unrepresentedNonTerminalCount") ??
      inferredUnrepresentedNonTerminalCount(progress),
    noRefillNow: progress.noRefillNow === true,
    dispatchHeld: progress.dispatchHeld === true,
    backendBlocked: progress.backendBlocked === true,
  };
}

export function exactBlockedWaitStewardshipProgress(
  progress: Record<string, unknown> | null | undefined,
): boolean {
  if (!progress || progress.completionReady !== false) return false;

  const {
    running,
    openChildren,
    openSupportChildren,
    activeChildren,
    reviewChildren,
    waitingChildren,
    backlogChildren,
    openFollowups,
    openSpecVerifierChildren,
    blockedWaitChildren,
    unrepresentedNonTerminalCount,
    noRefillNow,
    dispatchHeld,
    backendBlocked,
  } = incompleteFrontierCounts(progress);
  const holdMode =
    typeof progress.holdMode === "string" && progress.holdMode.trim();

  const blockedOnlyFrontier =
    running === 0 &&
    openChildren === 0 &&
    openSupportChildren === 0 &&
    activeChildren === 0 &&
    reviewChildren === 0 &&
    waitingChildren === 0 &&
    backlogChildren === 0 &&
    openFollowups === 0 &&
    openSpecVerifierChildren === 0;

  if (holdMode) {
    return blockedOnlyFrontier && unrepresentedNonTerminalCount === 0;
  }

  if (blockedWaitChildren <= 0) return false;

  return (
    blockedOnlyFrontier &&
    unrepresentedNonTerminalCount === 0 &&
    (noRefillNow || dispatchHeld || backendBlocked)
  );
}

export function heldDispatchRepresentedFrontierProgress(
  progress: Record<string, unknown> | null | undefined,
): boolean {
  if (!progress || progress.completionReady !== false) return false;
  const {
    running,
    openChildren,
    openSupportChildren,
    activeChildren,
    reviewChildren,
    waitingChildren,
    backlogChildren,
    openFollowups,
    openSpecVerifierChildren,
    blockedWaitChildren,
    unrepresentedNonTerminalCount,
    dispatchHeld,
    backendBlocked,
  } = incompleteFrontierCounts(progress);

  if (!dispatchHeld && !backendBlocked) return false;

  return (
    running === 0 &&
    openChildren === 0 &&
    activeChildren === 0 &&
    waitingChildren === 0 &&
    backlogChildren === 0 &&
    openFollowups === 0 &&
    openSpecVerifierChildren === 0 &&
    unrepresentedNonTerminalCount === 0 &&
    (openSupportChildren > 0 || reviewChildren > 0 || blockedWaitChildren > 0)
  );
}

function stringArrayProgressField(
  progress: Record<string, unknown>,
  key: string,
): string[] {
  const value = progress[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function arrayProgressFieldLength(
  progress: Record<string, unknown>,
  key: string,
): number {
  const value = progress[key];
  return Array.isArray(value) ? value.length : 0;
}

export function activeExternalRunWaitProgress(
  progress: Record<string, unknown> | null | undefined,
): boolean {
  if (!progress || progress.completionReady !== false) return false;

  const running = numericProgressField(progress, "running") ?? 0;
  if (running <= 0) return false;

  const activePipelineFeatureKeys = stringArrayProgressField(
    progress,
    "activePipelineFeatureKeys",
  );
  const activePipelineWaitCount = arrayProgressFieldLength(
    progress,
    "activePipelineWaits",
  );
  if (
    Math.max(activePipelineFeatureKeys.length, activePipelineWaitCount) <
    running
  ) {
    return false;
  }

  const unrepresentedNonTerminalCount =
    numericProgressField(progress, "unrepresentedNonTerminalCount") ??
    inferredUnrepresentedNonTerminalCount(progress);
  if (unrepresentedNonTerminalCount !== 0) return false;

  const openChildren = numericProgressField(progress, "openChildren") ?? 0;
  const openSupportChildren =
    numericProgressField(progress, "openSupportChildren") ?? 0;
  const activeChildren = numericProgressField(progress, "activeChildren") ?? 0;
  const reviewChildren = numericProgressField(progress, "reviewChildren") ?? 0;
  const waitingChildren =
    numericProgressField(progress, "waitingChildren") ?? 0;
  const backlogChildren =
    numericProgressField(progress, "backlogChildren") ?? 0;
  const openFollowups = numericProgressField(progress, "openFollowups") ?? 0;
  const openSpecVerifierChildren =
    numericProgressField(progress, "openSpecVerifierChildren") ?? 0;

  return (
    openChildren === 0 &&
    openSupportChildren === 0 &&
    activeChildren === 0 &&
    reviewChildren === 0 &&
    waitingChildren === 0 &&
    backlogChildren === 0 &&
    openFollowups === 0 &&
    openSpecVerifierChildren === 0
  );
}

export function runnableDurableLoopProgress(
  progress: Record<string, unknown>,
): Record<string, unknown> {
  if (exactBlockedWaitStewardshipProgress(progress)) return progress;
  const next = { ...progress };
  delete next.noRefillNow;
  delete next.dispatchHeld;
  delete next.dispatchHold;
  delete next.backendBlocked;
  delete next.backendBlock;
  return next;
}
