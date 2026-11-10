// Local UI-only installation. No task handlers or background producers.
export default {
  id: "aks-rp-e2e",
  version: 1,
  agent: "app-ops",
  description:
    "AKS Kubernetes version progress and session history. Task execution is disabled in this installation.",
  inputSchema: { not: {} },
};
