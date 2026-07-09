export function compactWaitOwner(reason: string): string {
  const text = reason.toLowerCase();
  if (
    text.includes("capacity") ||
    text.includes("quota") ||
    text.includes("auth") ||
    text.includes("credential") ||
    text.includes("kubeconfig") ||
    text.includes("underlay")
  ) {
    return "operator";
  }
  if (
    text.includes("owner") ||
    text.includes("product") ||
    text.includes("source") ||
    text.includes("reclassification") ||
    text.includes("promotion")
  ) {
    return "product-owner";
  }
  return "aks-explorer";
}
