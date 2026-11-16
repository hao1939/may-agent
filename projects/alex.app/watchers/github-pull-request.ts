import type { Condition } from "@may-agent/sdk/app";
import {
  createGitHubPullRequestObservers,
  validateGitHubPullRequestCondition,
} from "../../../shared/tools/github-pull-request.js";

// Read-only provider scope, not permission to publish from Alex's App workspace.
// The assigned Task retains its actual target repository and authorized checkout.
export const alexGitHubPullRequestScope = {
  repository: "hao1939/may-agent",
  author: "hao1939",
  appId: "alex",
  project: "alex",
  feedback: true,
};

export function createAlexGitHubPullRequestWatchers(
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
) {
  return createGitHubPullRequestObservers(
    alexGitHubPullRequestScope,
    fetchImpl,
    now,
  );
}

export const validateAlexGitHubPullRequestCondition = (condition: Condition) =>
  validateGitHubPullRequestCondition(condition, "alex");
