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

export function exactBlockedWaitStewardshipProgress(
  progress: Record<string, unknown> | null | undefined,
): boolean {
  if (!progress || progress.completionReady !== false) return false;

  const running = numericProgressField(progress, "running") ?? 0;
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
  const noRefillNow = progress.noRefillNow === true;
  const dispatchHeld = progress.dispatchHeld === true;
  const backendBlocked = progress.backendBlocked === true;
  const unrepresentedNonTerminalCount =
    numericProgressField(progress, "unrepresentedNonTerminalCount") ??
    inferredUnrepresentedNonTerminalCount(progress);
  const holdMode =
    typeof progress.holdMode === "string" && progress.holdMode.trim();
  const blockedWaitChildren =
    numericProgressField(progress, "blockedWaitChildren") ?? 0;

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
